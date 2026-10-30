// Render the vector macOS tile once, then derive every ICNS resolution from it.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(async () => {
  let window, temporary;
  try {
    if (process.platform !== 'darwin') throw new Error('Generate macOS icons on macOS.');
    const svg = fs.readFileSync(path.join(root, 'build/icon.svg'), 'utf8');
    window = new BrowserWindow({ show: false, width: 1024, height: 1024,
      useContentSize: true, transparent: true, frame: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false } });
    await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<style>body{margin:0;background:transparent}svg{display:block}</style>' + svg));
    await new Promise(resolve => setTimeout(resolve, 150));
    const captured = await window.webContents.capturePage();
    if (captured.isEmpty()) throw new Error('The icon renderer returned an empty image.');
    const image = captured.resize({ width: 1024, height: 1024, quality: 'best' });
    const png = path.join(root, 'assets/icon.png');
    fs.writeFileSync(png, image.toPNG());
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'translate-icon-'));
    const iconset = path.join(temporary, 'icon.iconset'); fs.mkdirSync(iconset);
    for (const size of [16, 32, 128, 256, 512]) {
      for (const scale of [1, 2]) {
        const output = path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`);
        execFileSync('sips', ['-z', String(size * scale), String(size * scale), png, '--out', output], { stdio: 'ignore' });
      }
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(root, 'build/icon.icns')]);
    console.log('Generated 1024px runtime icon and macOS ICNS from build/icon.svg.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally {
    window?.destroy();
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
    app.quit();
  }
});
