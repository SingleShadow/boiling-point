'use strict';

/**
 * 预加载脚本：在 contextIsolation 隔离环境下，向渲染进程暴露一个最小、白名单化的桥接。
 * 渲染进程只能通过 window.bpApi 调用下列受控方法，无法直接访问 Node / Electron 全量 API。
 */

const { contextBridge, ipcRenderer } = require('electron');

// 允许渲染进程调用的主进程通道（白名单）
const ALLOWED_INVOKE = new Set([
  'export-report',
  'show-notification',
  'copy-text',
  'open-external',
  'start-backend',
  'stop-backend',
  'backend-running',
]);

// 允许主进程主动推送给渲染进程的通道（白名单）
const ALLOWED_ON = new Set([
  'backend-log',
  'backend-error',
  'backend-status',
  'action',
]);

contextBridge.exposeInMainWorld('bpApi', {
  /** 调用主进程处理（invoke / handle 模型） */
  invoke(channel, payload) {
    if (!ALLOWED_INVOKE.has(channel)) {
      return Promise.reject(new Error(`禁止的通道：${channel}`));
    }
    return ipcRenderer.invoke(channel, payload);
  },

  /** 订阅主进程主动推送的事件，返回取消订阅函数 */
  on(channel, callback) {
    if (!ALLOWED_ON.has(channel)) {
      throw new Error(`禁止的通道：${channel}`);
    }
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
