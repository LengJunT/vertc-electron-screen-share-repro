/**
 * 与业务项目 packages/desktop/src/preload/index.ts 一致：
 * contextIsolation: false，直接将 SDK 挂到 window。
 */
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

let RTCVideoCtor;

try {
  RTCVideoCtor = require('@volcengine/vertc-electron-sdk').RTCVideo;
} catch (error) {
  console.error('[preload] VolcEngine SDK 加载失败:', error);
  RTCVideoCtor = class RTCVideoUnavailable {
    constructor() {
      throw new Error('VolcEngine RTC SDK 未加载');
    }
  };
}

function mkdirsSync(dirname) {
  if (fs.existsSync(dirname)) return true;
  if (mkdirsSync(path.dirname(dirname))) {
    fs.mkdirSync(dirname);
    return true;
  }
  return false;
}

function getLogPath() {
  const userData = ipcRenderer.sendSync('get-user-data-path');
  const logDir = path.join(userData, 'logs', 'vertc-repro');
  mkdirsSync(logDir);
  return logDir;
}

window.veRTCVideo = RTCVideoCtor;
window.ipcRenderer = ipcRenderer;
window.mainPlatform = process.platform;
window.veTools = {
  getLogPath,
  getPlatform: () => process.platform
};

console.log('[preload] VolcEngine SDK mounted');
