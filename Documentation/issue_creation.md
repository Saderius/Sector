# Issue Creation System

## User Perspective
Users can instantly create a new issue (or task) by using a global keyboard shortcut: pressing **Cmd + N** (on Mac) or **Ctrl + N** (on Windows/Linux) from anywhere within the application workspace. 

When invoked:
1. A new blank task named "New Task" is immediately spawned.
2. It's placed into the default 'To Do' column (or your customized default sort column).
3. The Task Editor Sheet automatically pops open, focusing the user to begin typing out the new Title, Tags, and Description.
4. From the moment of creation, the task is safely autosaved to the persistent local file storage as a `.md` (Markdown) file.

## Technical Explanation
The issue creation lifecycle utilizes a tightly integrated local pipeline between React event handlers, Zustand global state, Express endpoints, and the raw file system.

1. **Global Capture (`App.tsx`)**:
   A `useEffect` hook in the main `App` component listens globally for `keydown` events. If it detects the active `Ctrl`/`Cmd` key pressed alongside `N` (`e.key.toLowerCase() === 'n'`), it prevents default browser behaviors and fires the `createTask()` method.

2. **State & Orchestration (`src/store.ts`)**:
   The `createTask` function determines the fallback or preferred target column for the new task. It then generates:
   - A unique, timestamp-based filename (`task-{Date.now()}.md`).
   - A base JavaScript object containing initial fields (`title`, `status`, `tags`, `order`).

   It invokes the `gray-matter` node library to serialize these JavaScript objects into standard Markdown with a YAML frontmatter block. It then issues a `POST` request to the backend `/api/tasks/:id` endpoint.
   
   Finally, `loadTasks()` is called to force an immediate frontend refresh and `setSelectedTaskId` is triggered to immediately unfold the Task Editor UI.

3. **Backend Persistence (`server.ts`)**:
   The `POST /api/tasks/:filename` express route catches the payload and writes it explicitly to the project space's directory on the disk utilizing `fs.writeFile`. 
   
   Since it is stored physically as `.md`, the application leverages a local `chokidar` polling watcher. Although in this specific scenario `createTask` also forces a data reload, the watcher guarantees external data syncs by broadcasting `file_added`, `file_changed`, or `file_deleted` Server-Sent Events (SSE) out to all connected clients over the `/api/events` connection, locking data consistency between the filesystem and multi-tab use cases.
