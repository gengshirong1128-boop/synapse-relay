const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT_DIR = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
const APP_URL = 'http://127.0.0.1:8000/';
const APP_TITLE = 'Agent Relay';
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

async function waitForBackend(maxAttempts = 180) {
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

function createWindow(showStartup = false) {
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

  if (showStartup) {
    const startupHtml = `
      <!doctype html>
      <html lang="zh-CN">
        <meta charset="UTF-8">
        <title>Agent Relay</title>
        <style>
          body { margin: 0; background: #07090d; color: #e8edf5; font-family: "Segoe UI", sans-serif; display: grid; place-items: center; min-height: 100vh; }
          main { text-align: center; }
          strong { display: block; font-size: 30px; letter-spacing: -1px; }
          p { color: #8290a5; font-size: 13px; }
          span { display: inline-block; width: 7px; height: 7px; margin: 18px 3px 0; border-radius: 50%; background: #69e2b4; animation: pulse 1.2s infinite alternate; }
          span:nth-child(2) { animation-delay: .2s; } span:nth-child(3) { animation-delay: .4s; }
          @keyframes pulse { to { opacity: .18; transform: translateY(-6px); } }
        </style>
        <main><strong>Agent Relay</strong><p>正在准备本地 Agent 协作调度服务...</p><div><span></span><span></span><span></span></div></main>
      </html>`;
    mainWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(startupHtml)}`);
  } else {
    mainWindow.loadURL(APP_URL, { userAgent: 'AgentRelay Electron' });
  }
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle(APP_TITLE);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createWindow(true);
  const ready = await ensureBackend();
  if (!ready) {
    dialog.showErrorBox(
      'Agent Relay \u542f\u52a8\u5931\u8d25',
      '\u540e\u7aef\u670d\u52a1\u6ca1\u6709\u6210\u529f\u542f\u52a8\u3002\u8bf7\u68c0\u67e5 Python \u73af\u5883\u548c requirements.txt\u3002',
    );
    app.quit();
    return;
  }
  mainWindow.loadURL(APP_URL, { userAgent: 'AgentRelay Electron' });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
