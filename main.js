import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Translator from './translator.js';
import ShortcutHandler from './shortcut-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let translator;
let shortcutHandler;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Translate App',
    backgroundColor: '#ffffff'
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      silent: true
    }).show();
  }
}

app.whenReady().then(() => {
  // Initialize translator
  translator = new Translator();

  // Initialize shortcut handler
  shortcutHandler = new ShortcutHandler(translator, showNotification);
  shortcutHandler.start();

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (shortcutHandler) {
      shortcutHandler.stop();
    }
    app.quit();
  }
});

app.on('will-quit', () => {
  if (shortcutHandler) {
    shortcutHandler.stop();
  }
});

// IPC Handlers
ipcMain.handle('translate', async (event, { text, sourceLang, targetLang }) => {
  try {
    const translation = await translator.translate(text, sourceLang, targetLang);
    return { success: true, translation };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('detect-language', async (event, text) => {
  try {
    const lang = translator.detectLanguage(text);
    return { success: true, language: lang };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auto-translate', async (event, text) => {
  try {
    const result = await translator.autoTranslate(text);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('spell-check', async (event, text) => {
  try {
    const correctedText = await translator.spellCheck(text);
    return { success: true, correctedText };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
