const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  translate: (text, sourceLang, targetLang) =>
    ipcRenderer.invoke('translate', { text, sourceLang, targetLang }),

  detectLanguage: (text) =>
    ipcRenderer.invoke('detect-language', text),

  autoTranslate: (text) =>
    ipcRenderer.invoke('auto-translate', text),

  spellCheck: (text) =>
    ipcRenderer.invoke('spell-check', text)
});
