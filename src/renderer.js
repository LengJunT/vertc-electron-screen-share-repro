/** @type {import('@volcengine/vertc-electron-sdk').default | undefined} */
let rtcVideo;

const $ = (id) => document.getElementById(id);
const logEl = $('log');

function log(...args) {
  const line = args
    .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
    .join(' ');
  const ts = new Date().toISOString().slice(11, 23);
  const text = `[${ts}] ${line}\n`;
  logEl.textContent += text;
  logEl.scrollTop = logEl.scrollHeight;
  console.log('[repro]', ...args);
}

function getAppId() {
  const value = $('app-id').value.trim();
  if (!value) {
    throw new Error('请先填写 AppId');
  }
  return value;
}

function getLocalContainer() {
  return $('local-video-container');
}

function getScreenContainer() {
  return $('screen-video-container');
}

function buildDefaultScreenCaptureParams(source) {
  return {
    region_rect: source.region_rect ?? {},
    capture_mouse_cursor: 0,
    filter_config: [],
    highlight_config: {
      enable_highlight: true,
      border_color: 0xff29cca3,
      border_width: 4
    }
  };
}

function ensureRtcVideo() {
  if (!rtcVideo) {
    throw new Error('请先点击「初始化 SDK」');
  }
  return rtcVideo;
}

async function loadRuntimeInfo() {
  const info = await window.ipcRenderer.invoke('get-runtime-info');
  $('runtime-info').textContent =
    `Electron ${info.electron} | Chrome ${info.chrome} | Node ${info.node} | ` +
    `${info.platform}/${info.arch} | SDK @volcengine/vertc-electron-sdk 3.58.4`;
  log('runtime', info);
}

function bindLocalVideoWhenReady(retry = 0) {
  const container = getLocalContainer();
  const visible = document.visibilityState === 'visible';
  const w = container.clientWidth;
  const h = container.clientHeight;

  if (!visible || w === 0 || h === 0) {
    if (retry >= 30) {
      log('bindLocalVideoWhenReady 超时，强制绑定', { visible, w, h, retry });
    } else {
      log('bindLocalVideoWhenReady 等待容器就绪', { visible, w, h, retry });
      setTimeout(() => bindLocalVideoWhenReady(retry + 1), 100);
      return;
    }
  }

  const video = ensureRtcVideo();
  const r1 = video.startVideoCapture();
  const r2 = video.setupLocalVideo(container);
  log('restore camera: startVideoCapture=', r1, 'setupLocalVideo=', r2, 'w=', w, 'h=', h);

  setTimeout(() => {
    const hasCanvas = container.querySelector('canvas') !== null;
    log('[+1.5s] container w=', container.clientWidth, 'h=', container.clientHeight, 'hasCanvas=', hasCanvas);
  }, 1500);
}

async function initSdk() {
  if (!window.veRTCVideo) {
    throw new Error('preload 未注入 veRTCVideo，请确认在 Electron 中运行');
  }

  const appId = getAppId();
  rtcVideo = new window.veRTCVideo();
  window.rtcVideo = rtcVideo;

  const logPath = window.veTools.getLogPath();
  log('SDK log path:', logPath);

  const ret = rtcVideo.createRTCVideo(appId, JSON.stringify({ log_path: logPath }));
  log('createRTCVideo ret=', ret);

  $('btn-camera').disabled = false;
  $('btn-share').disabled = false;
}

async function startCamera() {
  const video = ensureRtcVideo();
  const r1 = video.startVideoCapture();
  const r2 = video.setupLocalVideo(getLocalContainer());
  log('startCamera: startVideoCapture=', r1, 'setupLocalVideo=', r2);
}

async function startScreenShare() {
  const granted = await window.ipcRenderer.invoke('check-screen-privilege');
  if (!granted) {
    log('屏幕录制权限未授予');
    return;
  }

  const video = ensureRtcVideo();
  const sources = video.getScreenCaptureSourceList();
  log('getScreenCaptureSourceList count=', sources?.length ?? 0);

  const screenSource = sources?.[0];
  if (!screenSource) {
    log('未找到可分享的屏幕源');
    return;
  }

  log('使用屏幕源:', {
    source_id: screenSource.source_id,
    source_name: screenSource.source_name,
    type: screenSource.type
  });

  const params = buildDefaultScreenCaptureParams(screenSource);

  const stopRet = video.stopScreenVideoCapture();
  log('pre-start stopScreenVideoCapture=', stopRet);

  video.stopVideoCapture();
  video.removeLocalVideo();
  log('stopped camera before screen share');

  const startRet = video.startScreenVideoCapture(screenSource, params);
  const audioRet = video.startScreenAudioCapture();
  const setupRet = video.setupLocalScreen(getScreenContainer(), { render_mode: 1, mirror: false });

  log(
    'startScreenShare:',
    'startScreenVideoCapture=', startRet,
    'startScreenAudioCapture=', audioRet,
    'setupLocalScreen=', setupRet
  );

  // 模拟业务：共享期间主窗最小化
  window.ipcRenderer.send('minimize-main-window');
  log('主窗已最小化（模拟业务行为）');

  $('btn-stop').disabled = false;
  $('btn-share').disabled = true;
}

function stopScreenShareAndRestore() {
  const video = ensureRtcVideo();

  const r1 = video.stopScreenVideoCapture();
  const r2 = video.stopScreenAudioCapture();
  const r3 = video.removeLocalScreen();
  log('stopScreenShare:', 'stopScreenVideoCapture=', r1, 'stopScreenAudioCapture=', r2, 'removeLocalScreen=', r3);

  window.ipcRenderer.send('restore-main-window');
  log('主窗已还原');

  bindLocalVideoWhenReady();

  $('btn-stop').disabled = true;
  $('btn-share').disabled = false;
}

function wireEvents() {
  $('btn-init').addEventListener('click', () => {
    initSdk().catch((e) => log('initSdk error:', e.message));
  });

  $('btn-camera').addEventListener('click', () => {
    startCamera().catch((e) => log('startCamera error:', e.message));
  });

  $('btn-share').addEventListener('click', () => {
    startScreenShare().catch((e) => log('startScreenShare error:', e.message));
  });

  $('btn-stop').addEventListener('click', () => {
    try {
      stopScreenShareAndRestore();
    } catch (e) {
      log('stopScreenShare error:', e.message);
    }
  });

  $('btn-clear-log').addEventListener('click', () => {
    logEl.textContent = '';
  });

  $('btn-camera').disabled = true;
  $('btn-share').disabled = true;
}

wireEvents();
loadRuntimeInfo().catch((e) => log('loadRuntimeInfo error:', e.message));
