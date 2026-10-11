'use strict';

/**
 * 沸点创意 Boiling Point — 桌面工作台主进程
 *
 * 职责：
 *  - 创建 BrowserWindow（1200×800，minWidth 1024）并加载本地渲染页
 *  - 顶部原生菜单（文件 / 视图 / 帮助）
 *  - 系统托盘（可选）
 *  - 原生能力桥接（导出 .md / 桌面通知 / 复制到剪贴板 / 打开外链）
 *  - 一键启动 / 停止后端（spawn node server/src/index.js）
 *  - 启动时若后端已就绪，提示一次「今日趋势报告已更新」
 *
 * 注意：本进程不内嵌任何后端逻辑，所有数据都来自 http://localhost:8787 的 API。
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  Notification,
  dialog,
  shell,
  clipboard,
  ipcMain,
} = require('electron');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..'); // apps/desktop -> 项目根
const SERVER_JS = path.join(PROJECT_ROOT, 'server', 'src', 'index.js');
const API_BASE = process.env.BOILING_API || 'http://localhost:8787';

let mainWindow = null;
let tray = null;
let backendProc = null;
let startupNotified = false;

/* ----------------------------- 窗口 ----------------------------- */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#16181D',
    show: false,
    title: '沸点创意 Boiling Point',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 启动后若后端已就绪，提示一次今日报告
    maybeNotifyOnStartup();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ----------------------------- 原生菜单 ----------------------------- */

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '导出今日报告 (.md)',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow && mainWindow.webContents.send('action', 'export-report'),
        },
        {
          label: '立即抓取今日数据',
          click: () => mainWindow && mainWindow.webContents.send('action', 'run-now'),
        },
        { type: 'separator' },
        { role: 'reload', label: '重新加载' },
        { role: 'toggledevtools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'resetzoom', label: '重置缩放' },
        { role: 'zoomin', label: '放大' },
        { role: 'zoomout', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '项目说明',
          click: () =>
            mainWindow &&
            mainWindow.webContents.send('action', 'nav', 'system'),
        },
        {
          label: '访问后端 API',
          click: () => shell.openExternal(`${API_BASE}/api/health`),
        },
        {
          label: '关于沸点创意',
          click: async () => {
            const { app } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '沸点创意 Boiling Point',
              detail:
                '抖音爆款内容每日拆解与趋势报告系统\n桌面工作台 v1.0.0\n\n后端 API 需运行在 ' +
                API_BASE,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ----------------------------- 托盘 ----------------------------- */

function createTray() {
  // 无图标时跳过，避免崩溃（图标为可选项）
  try {
    tray = new Tray(nativeImageFallback());
  } catch (_e) {
    tray = null;
    return;
  }
  const ctx = Menu.buildFromTemplate([
    { label: '打开工作台', click: () => mainWindow && mainWindow.show() },
    {
      label: '今日趋势报告已更新',
      click: () => sendNotification('沸点创意', '今日趋势报告已更新'),
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setToolTip('沸点创意 Boiling Point');
  tray.setContextMenu(ctx);
  tray.on('click', () => mainWindow && mainWindow.show());
}

// 生成一个 1x1 透明图标，确保托盘在不提供图标文件时也能创建
function nativeImageFallback() {
  const { nativeImage } = require('electron');
  const buf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Y2wAAAAAElFTkSuQmCC',
    'base64'
  );
  return nativeImage.createFromBuffer(buf);
}

/* ----------------------------- 后端进程管理 ----------------------------- */

function startBackend() {
  if (backendProc) {
    return { ok: false, message: '后端已在运行', running: true };
  }
  if (!fs.existsSync(SERVER_JS)) {
    return { ok: false, message: `未找到后端入口：${SERVER_JS}`, running: false };
  }
  const nodeBin = process.env.BOILING_NODE || 'node';
  try {
    backendProc = spawn(nodeBin, [SERVER_JS], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, BOILING_DATA_MODE: process.env.BOILING_DATA_MODE || 'auto' },
      windowsHide: true,
    });
    backendProc.stdout &&
      backendProc.stdout.on('data', (d) =>
        mainWindow && mainWindow.webContents.send('backend-log', String(d))
      );
    backendProc.stderr &&
      backendProc.stderr.on('data', (d) =>
        mainWindow && mainWindow.webContents.send('backend-error', String(d))
      );
    backendProc.on('exit', (code) => {
      backendProc = null;
      mainWindow && mainWindow.webContents.send('backend-status', false);
      if (code && code !== 0) {
        mainWindow &&
          mainWindow.webContents.send(
            'backend-error',
            `后端进程退出，code=${code}`
          );
      }
    });
    return { ok: true, running: true, message: '后端启动中…' };
  } catch (e) {
    return { ok: false, message: e.message, running: false };
  }
}

function stopBackend() {
  if (backendProc) {
    try {
      backendProc.kill('SIGTERM');
    } catch (_e) {
      /* noop */
    }
    backendProc = null;
    mainWindow && mainWindow.webContents.send('backend-status', false);
    return { ok: true, running: false };
  }
  return { ok: true, running: false, message: '后端未运行' };
}

function isBackendRunning() {
  return Boolean(backendProc);
}

/* ----------------------------- 通知 ----------------------------- */

function sendNotification(title, body) {
  if (!Notification.isSupported()) return false;
  try {
    const n = new Notification({ title, body, silent: false });
    n.show();
    return true;
  } catch (_e) {
    return false;
  }
}

/* ----------------------------- 启动检测 ----------------------------- */

function pingHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${API_BASE}/api/health`, (res) => {
      let s = '';
      res.on('data', (c) => (s += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(s);
          resolve(json && json.ok ? json.data : null);
        } catch (_e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function maybeNotifyOnStartup() {
  if (startupNotified) return;
  const health = await pingHealth();
  if (health && health.stats && health.stats.days > 0) {
    startupNotified = true;
    sendNotification('沸点创意', '今日趋势报告已更新');
  }
}

/* ----------------------------- IPC ----------------------------- */

function registerIpc() {
  // 导出报告：主进程负责选择路径 + 写入文件
  ipcMain.handle('export-report', async (_e, payload) => {
    const { content, filename } = payload || {};
    if (!content) return { ok: false, message: '内容为空' };
    const defaultName = filename || `沸点创意趋势报告_${new Date().toISOString().slice(0, 10)}.md`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出趋势报告',
      defaultPath: defaultName,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }
    try {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { ok: true, path: result.filePath };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  });

  // 桌面通知
  ipcMain.handle('show-notification', (_e, payload) => {
    const { title, body } = payload || {};
    return { ok: sendNotification(title || '沸点创意', body || '') };
  });

  // 复制到剪贴板（原生 clipboard.writeText）
  ipcMain.handle('copy-text', (_e, text) => {
    try {
      clipboard.writeText(String(text || ''));
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  });

  // 打开外链
  ipcMain.handle('open-external', (_e, url) => {
    if (!url || typeof url !== 'string') return { ok: false };
    try {
      shell.openExternal(url);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  });

  // 后端启停
  ipcMain.handle('start-backend', () => startBackend());
  ipcMain.handle('stop-backend', () => stopBackend());
  ipcMain.handle('backend-running', () => isBackendRunning());
}

/* ----------------------------- 生命周期 ----------------------------- */

app.whenReady().then(() => {
  registerIpc();
  buildMenu();
  createWindow();
  if (process.platform === 'win32' || process.platform === 'darwin') {
    createTray();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});
