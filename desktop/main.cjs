const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT_DIR = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
const APP_URL = 'http://127.0.0.1:8000/';
const APP_TITLE = '\u5185\u9601';
let backendProcess = null;
let mainWindow = null;

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8000/health', (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForBackend(maxAttempts = 45) {
  for (let i = 0; i < maxAttempts; i += 1) {
    if (await checkHealth()) return true;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return false;
}

async function ensureBackend() {
  if (await checkHealth()) return true;

  backendProcess = spawn('python', ['launch.py', '--no-browser', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: ROOT_DIR,
    windowsHide: true,
    shell: false,
    stdio: 'ignore',
  });

  backendProcess.on('exit', () => {
    backendProcess = null;
  });

  return waitForBackend();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: APP_TITLE,
    backgroundColor: '#0f0b08',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(APP_URL, { userAgent: 'NeigeDesktop Electron' });
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle(APP_TITLE);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const ready = await ensureBackend();
  if (!ready) {
    dialog.showErrorBox(
      '\u5185\u9601\u542f\u52a8\u5931\u8d25',
      '\u540e\u7aef\u670d\u52a1\u6ca1\u6709\u6210\u529f\u542f\u52a8\u3002\u8bf7\u68c0\u67e5 Python \u73af\u5883\u548c requirements.txt\u3002',
    );
    app.quit();
    return;
  }

  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
