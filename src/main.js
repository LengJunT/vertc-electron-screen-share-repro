const {
  app,
  BrowserWindow,
  ipcMain,
  systemPreferences,
  dialog
} = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const SDK_RELEASE_REL = 'node_modules/@volcengine/vertc-electron-sdk/build/Release';

/** macOS：让 dlopen 能找到 VolcEngineRTC.framework */
function setupVolcEngineNativePath() {
  if (process.platform !== 'darwin') return;

  const releaseDir = path.join(app.getAppPath(), SDK_RELEASE_REL);
  if (!fs.existsSync(releaseDir)) {
    console.warn('[main] VolcEngine Release 目录不存在:', releaseDir);
    return;
  }

  process.env.DYLD_FRAMEWORK_PATH = [releaseDir, process.env.DYLD_FRAMEWORK_PATH]
    .filter(Boolean)
    .join(':');
}

setupVolcEngineNativePath();

/** @type {BrowserWindow | null} */
let mainWindow = null;

function getWebPreferences() {
  return {
    preload: path.join(__dirname, 'preload.js'),
    // 与业务项目一致：SDK 在 preload 中 require 并挂到 window
    contextIsolation: false,
    nodeIntegration: true,
    sandbox: false,
    webSecurity: true
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    webPreferences: getWebPreferences()
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));
  mainWindow.webContents.openDevTools({ mode: 'detach' });
}

async function checkScreenPrivilege() {
  const status = systemPreferences.getMediaAccessStatus('screen');
  if (status !== 'granted' && process.platform === 'darwin') {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'none',
      message: '需要屏幕录制权限',
      detail: '请在「系统设置 → 隐私与安全性 → 屏幕录制」中允许本应用，然后重启应用。',
      buttons: ['取消', '打开系统设置'],
      defaultId: 1
    });
    if (response === 1) {
      exec(
        'open x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      );
    }
    return false;
  }
  return status === 'granted';
}

app.whenReady().then(() => {
  ipcMain.on('get-user-data-path', (event) => {
    event.returnValue = app.getPath('userData');
  });

  ipcMain.handle('check-screen-privilege', checkScreenPrivilege);
  ipcMain.on('minimize-main-window', () => {
    mainWindow?.minimize();
  });
  ipcMain.on('restore-main-window', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  ipcMain.handle('get-runtime-info', () => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch
  }));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
