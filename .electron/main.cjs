const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'sector',
    width: 1200,
    height: 800,
    // Specifying the path for the application window icon
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Completely remove the horizontal File/Edit/View/Window menu ribbon on Windows and Linux,
  // while keeping the native OS title bar and border intact.
  Menu.setApplicationMenu(null);

  // Load the Express server that serves our Vite/React frontend
  mainWindow.loadURL('http://localhost:3000');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle native file selection
ipcMain.handle('select-directory', async () => {
  try {
    if (!mainWindow) {
      console.error("[Electron main.cjs]: Error: mainWindow is not initialized yet.");
      throw new Error("Main window is not initialized yet.");
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  } catch (err) {
    console.error("[Electron main.cjs]: select-directory error:", err);
    throw err;
  }
});

function startServerAndApp() {
  const isDev = !app.isPackaged;
  
  // Decide whether to run the ts-node/tsx server or the compiled commonJS server
  const scriptToRun = isDev ? 'server.ts' : 'dist/server.cjs';
  let command = isDev ? 'npx' : 'node';
  let args = isDev ? ['tsx', scriptToRun] : [path.join(__dirname, '..', scriptToRun)];
  
  serverProcess = spawn(command, args, {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    shell: true,
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Express]: ${data}`);
    // Wait until server says it's running before creating the window
    if (data.toString().includes('running on http://localhost:3000')) {
      if (!mainWindow) createWindow();
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Express Error]: ${data}`);
  });
}

app.whenReady().then(() => {
  startServerAndApp();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (!mainWindow && serverProcess) createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
