const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  translate: (text, sourceLang, targetLang) =>
    ipcRenderer.invoke('translate', { text, sourceLang, targetLang }),

  autoTranslate: (text) =>
    ipcRenderer.invoke('auto-translate', text),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  setLanguagePair: pair => ipcRenderer.invoke('set-language-pair', pair),
  startAudio: sources => ipcRenderer.invoke('audio-start', sources),
  microphonePermission: () => ipcRenderer.invoke('microphone-permission'),
  sendAudio: packet => ipcRenderer.send('audio-input', packet),
  stopAudio: id => ipcRenderer.invoke('audio-stop', id),
  onAudioEvent: callback => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('audio-event', listener);
    return () => ipcRenderer.removeListener('audio-event', listener);
  },
  spellCheck: (text) =>
    ipcRenderer.invoke('spell-check', text)
});
