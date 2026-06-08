# VolcEngine vertc-electron-sdk 屏幕共享最小复现

独立 Electron 工程，用于向火山官方复现：**同一 `@volcengine/vertc-electron-sdk` 版本下，Electron 13.6.9 行为正常，Electron 28/33/39 停止屏幕共享后存在异常**。

## 环境要求

- macOS（问题主要在 macOS 屏幕录制 / ScreenCaptureKit）
- Node.js >= 22
- pnpm

## 依赖版本

| 包 | 版本 |
|---|---|
| `@volcengine/vertc-electron-sdk` | 3.58.4（固定） |
| `electron` | 默认 3.4.11，可切换 28 / 39 |

## 安装与运行

```bash
cd vertc-electron-screen-share-repro
pnpm install
pnpm start
```

启动后在页面填写 **火山 RTC AppId**，按顺序点击按钮：

1. **初始化 SDK**
2. **开启摄像头回显** — 确认 `#local-video-container` 有画面
3. **开始屏幕共享** — 主窗会自动最小化（模拟业务行为），`#screen-video-container` 显示屏幕预览
4. **停止共享并恢复摄像头** — 主窗还原，尝试重新绑定摄像头

同时观察 **macOS 菜单栏顶部「屏幕录制中」指示** 是否消失。

## 切换 Electron 版本对照

```bash
# 对照组：预期正常
pnpm use:electron13 && pnpm install && pnpm start

# 复现组：预期异常
pnpm use:electron28 && pnpm install && pnpm start
pnpm use:electron31 && pnpm install && pnpm start
```

## 预期 vs 实际

### Electron 13.6.9（对照）

- `stopScreenVideoCapture` / `stopScreenAudioCapture` / `removeLocalScreen` 返回 `0`
- 停止共享后 `#local-video-container` **恢复摄像头画面**

### Electron 28.x / 33.x / 39.x（复现）

- 上述停止接口 **均返回 `0`（成功）**
- 停止共享后 `#local-video-container` **黑屏，摄像头回显未恢复**

## 关键日志示例

```
stopScreenShare: stopScreenVideoCapture= 0 stopScreenAudioCapture= 0 removeLocalScreen= 0
restore camera: startVideoCapture= 0 setupLocalVideo= 0 w= xxx h= xxx
[+1.5s] container w= xxx h= xxx hasCanvas= true/false
```

**矛盾点**：所有 SDK 调用返回成功，但系统录屏会话未释放、本地回显未恢复。

## 与业务项目的关系

本用例从业务项目 `studio.zhcnews.com` 抽取最小 SDK 调用链，**不包含**：

- 进房 / 推流 / CDN 混流
- 工具条 / 悬浮窗 UI
- Vue 业务逻辑

保留与业务一致的关键配置：

- `contextIsolation: false`
- `nodeIntegration: true`
- `sandbox: false`
- preload 中 `require('@volcengine/vertc-electron-sdk')`
- macOS `DYLD_FRAMEWORK_PATH` 指向 SDK `build/Release`
- 屏幕共享时主窗 `minimize`，停止时 `restore`

## SDK 调用序列（停止共享）

与业务项目 `rtcVideoDomain.stopScreenShare()` 一致：

```js
rtcVideo.stopScreenVideoCapture();  // ret 0
rtcVideo.stopScreenAudioCapture();  // ret 0
rtcVideo.removeLocalScreen();       // ret 0
rtcVideo.startVideoCapture();       // 恢复摄像头
rtcVideo.setupLocalVideo(container);
```

SDK 无额外的 `stopScreenCapture` / `destroyScreen` 等聚合销毁接口。

## 系统权限

首次运行需在 **系统设置 → 隐私与安全性 → 屏幕录制** 中允许 Electron（或打包后的应用）。

SDK 日志目录：`~/Library/Application Support/vertc-electron-screen-share-repro/logs/vertc-repro/`