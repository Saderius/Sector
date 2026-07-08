import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createServer as createViteServer } from 'vite';
import chokidar from 'chokidar';
import cors from 'cors';
import matter from 'gray-matter';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_REGISTRY_PATH = path.join(DATA_DIR, '.kanban-projects.json');

interface ProjectItem {
  id: string;
  name: string;
  path: string;
}

let activeProjects: ProjectItem[] = [];

// Ensure data directory exists and projects are registered
async function initRegistry() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const content = await fs.readFile(PROJECTS_REGISTRY_PATH, 'utf-8');
      activeProjects = JSON.parse(content);
    } catch (e) {
      activeProjects = [];
      await fs.writeFile(PROJECTS_REGISTRY_PATH, JSON.stringify(activeProjects, null, 2), 'utf-8');
    }
    // Watch other external directories too
    for (const proj of activeProjects) {
      if (proj.path !== DATA_DIR) {
        watcher.add(proj.path);
      }
    }
  } catch (err) {
    console.error('Failed to initialize projects registry', err);
  }
}
async function saveRegistry() {
  try {
    await fs.writeFile(PROJECTS_REGISTRY_PATH, JSON.stringify(activeProjects, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save projects registry', e);
  }
}

// --- SSE Setup ---
const clients = new Set<express.Response>();

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.add(res);

  // Send an initial ping so the connection establishes well
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  req.on('close', () => {
    clients.delete(res);
  });
});

function broadcast(type: string, payload: any) {
  for (const client of clients) {
    client.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  }
}

// --- Watcher ---
let isWriting = false; // Simple lock to avoid reflecting our own writes

const watcher = chokidar.watch(DATA_DIR, {
  persistent: true,
  ignoreInitial: true,
});

const getProjectAndArchiveStatus = (filePath: string) => {
  // Try to match against the absolute path of registered projects
  // Sort registered projects by path depth descending so more specific paths match first
  const sortedProjects = [...activeProjects].sort((a, b) => b.path.length - a.path.length);
  const matched = sortedProjects.find(p => filePath.startsWith(path.resolve(p.path)));
  const project = matched ? matched.name : '';
  const projectPath = matched ? matched.path : DATA_DIR;
  
  const relative = path.relative(projectPath, filePath);
  const parts = relative.split(path.sep);
  const isArchived = parts[0] === 'archive';
  const isTrashed = parts[0] === 'trash';
  
  return { project, isArchived, isTrashed };
};

watcher
  .on('add', async (filePath) => {
    if (isWriting) return;
    const filename = path.basename(filePath);
    if (!filename.endsWith('.md')) return;
    const { project, isArchived, isTrashed } = getProjectAndArchiveStatus(filePath);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      broadcast('file_added', { filename, content, project, archived: isArchived, trashed: isTrashed });
    } catch (e) {
      console.error(e);
    }
  })
  .on('change', async (filePath) => {
    if (isWriting) return;
    const filename = path.basename(filePath);
    if (!filename.endsWith('.md') && filename !== '.kanban-config.json') return;
    const { project, isArchived, isTrashed } = getProjectAndArchiveStatus(filePath);
    try {
      // Delay slightly to ensure write is finished on all OSs
      await new Promise(res => setTimeout(res, 50));
      const content = await fs.readFile(filePath, 'utf-8');
      broadcast('file_changed', { filename, content, project, archived: isArchived, trashed: isTrashed });
    } catch (e) {
      console.error(e);
    }
  })
  .on('unlink', (filePath) => {
    if (isWriting) return;
    const filename = path.basename(filePath);
    if (!filename.endsWith('.md')) return;
    const { project, isArchived, isTrashed } = getProjectAndArchiveStatus(filePath);
    broadcast('file_deleted', { filename, project, archived: isArchived, trashed: isTrashed });
  });

const getProjectDir = (projectName?: string) => {
  if (!projectName) return DATA_DIR;
  const matched = activeProjects.find(p => p.name === projectName || p.id === projectName);
  if (matched) return matched.path;
  // Basic path traversal prevention fallback
  const safeName = path.basename(projectName);
  return path.join(DATA_DIR, safeName);
};

// --- REST Endpoints ---
app.get('/api/projects', async (req, res) => {
  try {
    const projects = activeProjects.map(p => p.name);
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, path: customPath } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Invalid project name' });
    }
    const targetPath = customPath ? path.resolve(customPath) : path.join(DATA_DIR, name);
    
    // Register if new
    const exists = activeProjects.some(p => p.name === name);
    if (!exists) {
      activeProjects.push({
        id: name,
        name,
        path: targetPath
      });
      await saveRegistry();
      watcher.add(targetPath);
    }
    
    await fs.mkdir(targetPath, { recursive: true });
    res.json({ success: true, project: name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Scanning API to verify correctness of Markdown files
app.post('/api/projects/check', async (req, res) => {
  try {
    const { name, path: rawPath } = req.body;
    if (!name || !rawPath) {
      return res.status(400).json({ error: 'Missing name or path parameter' });
    }

    const selectedPath = path.resolve(rawPath);
    await fs.mkdir(selectedPath, { recursive: true });
    const items = await fs.readdir(selectedPath, { withFileTypes: true });
    
    const mdFiles = [];
    for (const item of items) {
      if (item.isFile() && item.name.endsWith('.md')) {
        mdFiles.push(item.name);
      }
    }

    // Capture files with incorrect yaml formatter
    const invalidFiles = [];
    let validCount = 0;

    for (const filename of mdFiles) {
      const filePath = path.join(selectedPath, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      try {
        const parsed = matter(content);
        const hasValidYaml = parsed.data && Object.keys(parsed.data).length > 0;
        if (hasValidYaml) {
          validCount++;
        } else {
          invalidFiles.push({ filename, content });
        }
      } catch (e) {
        invalidFiles.push({ filename, content });
      }
    }

    let status = 'mixed';
    if (mdFiles.length === 0) {
      // Scenario 1: Folder is completely empty of markdown files. Initialize default welcome tasks!
      status = 'empty';
      const welcomeContent = matter.stringify("Welcome to Kanban Space! You can drag and drop cards across columns to track your work.", {
        title: "Welcome Task",
        status: "To Do",
        tags: ["guide", "welcome"],
        order: Date.now()
      });
      const featureContent = matter.stringify("Each task card is stored as a standard Markdown file on your system. You can even open and edit them in external text editors!", {
        title: "Markdown Persistence",
        status: "In Progress",
        tags: ["feature"],
        order: Date.now() + 1000
      });
      await fs.writeFile(path.join(selectedPath, 'Welcome-Task.md'), welcomeContent, 'utf-8');
      await fs.writeFile(path.join(selectedPath, 'Markdown-Persistence.md'), featureContent, 'utf-8');
      
      // Write sample kanban config
      const defaultColumns = [
        { id: 'To Do', title: 'To Do', color: 'blue', size: 'medium', order: 0 },
        { id: 'In Progress', title: 'In Progress', color: 'amber', size: 'medium', order: 1 },
        { id: 'Done', title: 'Done', color: 'emerald', size: 'medium', order: 2 }
      ];
      await fs.writeFile(path.join(selectedPath, '.kanban-config.json'), JSON.stringify(defaultColumns, null, 2), 'utf-8');
      
      // Register since empty is fully solved now!
      const exists = activeProjects.some(p => p.name === name);
      if (!exists) {
        activeProjects.push({ id: name, name, path: selectedPath });
        await saveRegistry();
        watcher.add(selectedPath);
      }
    } else if (invalidFiles.length === 0) {
      // Scenario 2: All markdown files are formatted properly, auto-register project space!
      status = 'valid-only';
      const exists = activeProjects.some(p => p.name === name);
      if (!exists) {
        activeProjects.push({ id: name, name, path: selectedPath });
        await saveRegistry();
        watcher.add(selectedPath);
      }
    } else if (validCount === 0) {
      // Scenario 4: All MD files are unformatted
      status = 'invalid-only';
      // Register anyway so they switch to it, but show resolve dialog
      const exists = activeProjects.some(p => p.name === name);
      if (!exists) {
        activeProjects.push({ id: name, name, path: selectedPath });
        await saveRegistry();
        watcher.add(selectedPath);
      }
    } else {
      // Scenario 3: Mixed files detected
      status = 'mixed';
      // Register anyway so they switch to it, but show resolve dialog
      const exists = activeProjects.some(p => p.name === name);
      if (!exists) {
        activeProjects.push({ id: name, name, path: selectedPath });
        await saveRegistry();
        watcher.add(selectedPath);
      }
    }

    res.json({
      status, 
      project: {
        id: name,
        name,
        path: selectedPath
      },
      invalidFiles,
      validCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to inspect folder contents' });
  }
});

// Format single markdown file API
app.post('/api/projects/format-import', async (req, res) => {
  try {
    const { projectName, filename } = req.body;
    if (!projectName || !filename) {
       return res.status(400).json({ error: 'Missing parameters' });
    }
    const matched = activeProjects.find(p => p.name === projectName);
    if (!matched) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const filePath = path.join(matched.path, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Clean frontmatter first in case there is some broken text, or raw text blocks
    const cleanedBody = content.replace(/^---[\s\S]*?---/, '').trim();
    const formattedMeta = {
       title: filename.replace('.md', '').replace(/-/g, ' '),
       status: 'To Do',
       tags: ['imported'],
       order: Date.now()
    };
    
    const stringified = matter.stringify(cleanedBody || 'Write description...', formattedMeta);
    isWriting = true;
    await fs.writeFile(filePath, stringified, 'utf-8');
    setTimeout(() => { isWriting = false; }, 300);
    
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to format and import. Check file write permissions.' });
  }
});

// Rename project space
app.post('/api/projects/rename', async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Invalid project space name parameters' });
    }
    const project = activeProjects.find(p => p.name === oldName);
    if (!project) {
      return res.status(404).json({ error: 'Project space not found' });
    }
    const exists = activeProjects.some(p => p.name === newName);
    if (exists) {
      return res.status(400).json({ error: 'A project space with this name already exists' });
    }
    project.name = newName;
    project.id = newName;
    await saveRegistry();
    res.json({ success: true, project: newName });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename project space' });
  }
});

// Remove project space from app (without touching raw directory files)
app.post('/api/projects/remove', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Invalid project name parameter' });
    }
    const index = activeProjects.findIndex(p => p.name === name);
    if (index === -1) {
      return res.status(404).json({ error: 'Project space not found' });
    }
    const project = activeProjects[index];
    watcher.unwatch(project.path);
    activeProjects.splice(index, 1);
    await saveRegistry();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove project space' });
  }
});

app.get('/api/bing-image', async (req, res) => {
  try {
    const response = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US');
    if (!response.ok) throw new Error('Bing API request failed');
    const data = await response.json();
    if (data.images && data.images.length > 0) {
      res.json({ url: `https://www.bing.com${data.images[0].url}` });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('Bing API Error:', error);
    res.status(500).json({ error: 'Failed to fetch Bing image' });
  }
});

app.get('/api/unsplash-image', async (req, res) => {
  try {
    const tags = req.query.tags || 'nature';
    const boardId = req.query.boardId || '';
    
    // If the user has configured an Unsplash API key, use it for genuine 4K tag-based photos
    if (process.env.UNSPLASH_ACCESS_KEY) {
      const response = await fetch(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(tags as string)}&orientation=landscape`, {
        headers: {
          'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.urls && data.urls.full) {
           res.json({ url: data.urls.full });
           return;
        }
      }
    }

    // Fallback if no API key is provided, or if the API key fails
    // loremflickr has issues with extreme resolutions (padding with red backgrounds)
    // picsum provides excellent 4k photos, we use the tag string and boardId as a consistent seed
    const seed = encodeURIComponent((tags as string) + (boardId as string)).replace(/[^a-zA-Z0-9]/g, '');
    const url = `https://picsum.photos/seed/${seed}/3840/2160`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to proxy Unsplash image' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const projectDir = getProjectDir(req.query.project as string);
    await fs.mkdir(projectDir, { recursive: true });
    
    const archiveDir = path.join(projectDir, 'archive');
    await fs.mkdir(archiveDir, { recursive: true });
    
    const trashDir = path.join(projectDir, 'trash');
    await fs.mkdir(trashDir, { recursive: true });

    // Read active files
    const files = await fs.readdir(projectDir, { withFileTypes: true });
    const tasks = [];
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.md')) {
        const content = await fs.readFile(path.join(projectDir, file.name), 'utf-8');
        tasks.push({ filename: file.name, content, archived: false, trashed: false });
      }
    }

    // Read archived files
    let archiveFiles: any[] = [];
    try {
      archiveFiles = await fs.readdir(archiveDir, { withFileTypes: true });
    } catch (e) {
      // ignore
    }

    for (const file of archiveFiles) {
      if (file.isFile() && file.name.endsWith('.md')) {
        const content = await fs.readFile(path.join(archiveDir, file.name), 'utf-8');
        tasks.push({ filename: file.name, content, archived: true, trashed: false });
      }
    }

    // Read trashed files
    let trashFiles: any[] = [];
    try {
      trashFiles = await fs.readdir(trashDir, { withFileTypes: true });
    } catch (e) {
      // ignore
    }

    for (const file of trashFiles) {
      if (file.isFile() && file.name.endsWith('.md')) {
        const content = await fs.readFile(path.join(trashDir, file.name), 'utf-8');
        tasks.push({ filename: file.name, content, archived: false, trashed: true });
      }
    }

    const configPath = path.join(projectDir, '.kanban-config.json');
    let config = null;
    try {
      const configStr = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configStr);
    } catch (e) {
      // ignore
    }

    res.json({ tasks, config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.post('/api/tasks/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { content } = req.body;
    const projectDir = getProjectDir(req.query.project as string);
    
    // Check if the file is flagged as archived or trashed
    let isArchived = req.query.archived === 'true';
    let isTrashed = req.query.trashed === 'true';
    
    if (content) {
      try {
        const parsed = matter(content);
        if (parsed.data && parsed.data.archived === true) {
          isArchived = true;
        }
        if (parsed.data && parsed.data.trashed === true) {
          isTrashed = true;
        }
      } catch (e) {}
    }

    isWriting = true;
    
    const archiveDir = path.join(projectDir, 'archive');
    await fs.mkdir(archiveDir, { recursive: true });
    
    const trashDir = path.join(projectDir, 'trash');
    await fs.mkdir(trashDir, { recursive: true });

    let targetPath;
    let fallbackToRemove1;
    let fallbackToRemove2;

    if (isTrashed) {
      targetPath = path.join(trashDir, filename);
      fallbackToRemove1 = path.join(projectDir, filename);
      fallbackToRemove2 = path.join(archiveDir, filename);
    } else if (isArchived) {
      targetPath = path.join(archiveDir, filename);
      fallbackToRemove1 = path.join(projectDir, filename);
      fallbackToRemove2 = path.join(trashDir, filename);
    } else {
      targetPath = path.join(projectDir, filename);
      fallbackToRemove1 = path.join(archiveDir, filename);
      fallbackToRemove2 = path.join(trashDir, filename);
    }

    await fs.writeFile(targetPath, content, 'utf-8');
    
    // Remove from the other directories if they exist to perform clean moves
    try {
      await fs.unlink(fallbackToRemove1);
    } catch (e) {}
    try {
      await fs.unlink(fallbackToRemove2);
    } catch (e) {}
    
    // reset writing lock after standard OS propagation time
    setTimeout(() => {
      isWriting = false;
    }, 500);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to write task' });
    isWriting = false;
  }
});

app.delete('/api/tasks/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const projectDir = getProjectDir(req.query.project as string);
    const archiveDir = path.join(projectDir, 'archive');
    const trashDir = path.join(projectDir, 'trash');

    isWriting = true;

    const activePath = path.join(projectDir, filename);
    const archivePath = path.join(archiveDir, filename);
    const trashPath = path.join(trashDir, filename);

    try { await fs.unlink(activePath); } catch (e) {}
    try { await fs.unlink(archivePath); } catch (e) {}
    try { await fs.unlink(trashPath); } catch (e) {}

    setTimeout(() => {
      isWriting = false;
    }, 500);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
    isWriting = false;
  }
});


// Vite middleware for development
async function startServer() {
  await initRegistry();
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
