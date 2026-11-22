const { contextBridge, ipcRenderer } = require('electron');

const invoke = (name, ...args) => ipcRenderer.invoke(name, ...args);
contextBridge.exposeInMainWorld('hub', {
  state: () => invoke('state'),
  fold: () => invoke('fold'),
  expand: () => invoke('expand'),
  quit: () => invoke('quit'),
  setting: (key, value) => invoke('setting', key, value),
  appVisible: (id, visible) => invoke('appVisible', id, visible),
  focusStart: (mode, seconds) => invoke('focusStart', mode, seconds),
  focusStop: () => invoke('focusStop'),
  clipClear: () => invoke('clipClear'),
  clipCopy: (id) => invoke('clipCopy', id),
  trayAdd: () => invoke('trayAdd'),
  trayDrop: (name, bytes) => invoke('trayDrop', name, bytes),
  trayRemove: (id) => invoke('trayRemove', id),
  trayOpen: (id) => invoke('trayOpen', id),
  noteSave: (body) => invoke('noteSave', body),
  agendaAdd: (title, start, end) => invoke('agendaAdd', title, start, end),
  agendaRemove: (id) => invoke('agendaRemove', id),
  musicOpen: () => invoke('musicOpen'),
  mediaControl: (action, seconds) => invoke('mediaControl', action, seconds),
  volumeSet: (value) => invoke('volumeSet', value),
  brightnessSet: (value) => invoke('brightnessSet', value),
  radioSet: (target, enabled) => invoke('radioSet', target, enabled),
  openSystemSettings: (target) => invoke('openSystemSettings', target),
  hooks: (action, provider) => invoke('hooks', action, provider),
  decide: (id, behavior) => invoke('decide', id, behavior),
  roboAsk: (prompt, captureTarget) => invoke('roboAsk', prompt, captureTarget),
  roboTargets: () => invoke('roboTargets'),
  roboKey: (key) => invoke('roboKey', key),
  onUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update', handler);
    return () => ipcRenderer.removeListener('update', handler);
  },
  onMotion: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('motion', handler);
    return () => ipcRenderer.removeListener('motion', handler);
  },
  onPresence: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('presence', handler);
    return () => ipcRenderer.removeListener('presence', handler);
  },
});
