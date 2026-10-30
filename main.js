import { app, BrowserWindow, ipcMain, Notification, nativeImage, nativeTheme, desktopCapturer, session, systemPreferences } from 'electron';
import path from 'path';
import fs from 'node:fs';
import { RealtimeTranslationSession } from './realtime-translation-session.js';
import config from './config.js';
import { DEFAULT_PAIR, validatePair } from './languages.js';
import { fileURLToPath } from 'url';
import Translator from './translator.js';
import ShortcutHandler from './shortcut-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appIconPath = path.join(__dirname, 'assets', 'icon.png');

let mainWindow;
let translator;
let shortcutHandler;
let audioSession;
let settingsPath;

// Electron 40 uses CoreAudio taps for macOS 14.2+ system audio capture.
app.commandLine.appendSwitch('enable-features', 'MacCatapLoopbackAudioForScreenShare');

function trusted(event) {
  if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error('Untrusted window.');
  }
}
function closeAudio() { audioSession?.close(); audioSession = null; }


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    minWidth: 760,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Edgee Translate',
    icon: appIconPath,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1924' : '#ffffff'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', closeAudio);
  mainWindow.webContents.on('render-process-gone', closeAudio);
  mainWindow.webContents.on('did-start-loading', closeAudio);

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      // macOS gets the sender icon from the app bundle. An explicit icon adds
      // a second image to the notification instead of changing the sender.
      ...(process.platform === 'darwin' ? {} : { icon: nativeImage.createFromPath(appIconPath) }),
      silent: true
    }).show();
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.setIcon(nativeImage.createFromPath(appIconPath));
  // Initialize translator
  translator = new Translator();
  settingsPath = path.join(app.getPath('userData'), 'language-settings.json');
  try { translator.setLanguagePair(JSON.parse(fs.readFileSync(settingsPath, 'utf8')).pair); }
  catch { translator.setLanguagePair(DEFAULT_PAIR); }

  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(contents === mainWindow?.webContents && ['media', 'display-capture'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission) =>
    contents === mainWindow?.webContents && ['media', 'display-capture'].includes(permission));
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (request.frame !== mainWindow?.webContents.mainFrame || !request.userGesture) return callback({});
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      if (!sources.length) return callback({});
      callback({ video: sources[0], audio: 'loopback' });
    } catch { callback({}); }
  });

  // Create window first
  createWindow();

  // Native modules are unpacked by electron-builder. Pass the helper's real
  // filesystem path explicitly because executables cannot run from app.asar.
  const keyServerPath = app.isPackaged
    ? path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        'node-global-key-listener',
        'bin',
        'MacKeyServer'
      )
    : undefined;

  shortcutHandler = new ShortcutHandler(translator, showNotification, keyServerPath);
  shortcutHandler.start()
    .then(() => console.log(`Keyboard shortcuts enabled (${app.isPackaged ? 'packaged' : 'development'} mode)`))
    .catch((error) => {
      console.error('Failed to initialize keyboard shortcuts:', error.message);
      showNotification(
        'Keyboard Shortcuts Unavailable',
        'Allow Translate App in System Settings → Privacy & Security → Accessibility, then restart it.'
      );
    });

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
  closeAudio();
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

ipcMain.handle('get-settings', event => {
  trusted(event);
  return { pair: translator.languagePair, audioConfigured: Boolean(config.OPENAI_API_KEY) };
});
ipcMain.handle('set-language-pair', (event, pair) => {
  trusted(event);
  try {
    if (audioSession && !audioSession.closed) throw new Error('Stop audio capture before changing languages.');
    const validated = validatePair(pair);
    fs.writeFileSync(settingsPath, JSON.stringify({ pair: validated }));
    translator.setLanguagePair(validated);
    return { success: true, pair: validated };
  } catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('audio-start', async (event, request) => {
  trusted(event);
  try {
    if (audioSession && !audioSession.closed) throw new Error('Audio capture is already running.');
    const { sources } = request || {};
    const owner = event.sender;
    const current = new RealtimeTranslationSession({ apiKey: config.OPENAI_API_KEY,
      pair: translator.languagePair, sources, targetLanguage: translator.languagePair[1],
      emit: message => { if (!owner.isDestroyed()) owner.send('audio-event', message); }
    });
    audioSession = current;
    const id = await current.start();
    return { success: true, sessionId: id };
  } catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('microphone-permission', async event => {
  trusted(event);
  return process.platform !== 'darwin' || systemPreferences.askForMediaAccess('microphone');
});
ipcMain.on('audio-input', (event, { sessionId, source, ...packet } = {}) => {
  if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) return;
  if (audioSession?.id === sessionId) audioSession.input(source, packet);
});
ipcMain.handle('audio-stop', async (event, id) => {
  trusted(event);
  const current = audioSession;
  if (current?.id === id) {
    await current.stop();
    if (audioSession === current) audioSession = null;
  }
});

ipcMain.on('audio-clear', (event, id) => {
  trusted(event);
  if (audioSession?.id === id) audioSession.clear?.();
});
