const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const SAVE_DIR = path.join(app.getPath('userData'), 'saves');

function ensureSaveDir() {
  if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1680,
    height: 1020,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#0d1016',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  ensureSaveDir();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('save:snapshot', async (_event, payload) => {
  ensureSaveDir();
  const fileName = `snapshot-${Date.now()}.json`;
  const outPath = path.join(SAVE_DIR, fileName);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
  return outPath;
});

ipcMain.handle('load:snapshot', async () => {
  ensureSaveDir();
  const result = await dialog.showOpenDialog({
    title: 'Load Ironbound Snapshot',
    defaultPath: SAVE_DIR,
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const content = fs.readFileSync(result.filePaths[0], 'utf-8');
  return JSON.parse(content);
});
