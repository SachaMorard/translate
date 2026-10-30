// electron-builder sets these keys in the packaged app, but npm start runs the
// stock Electron.app. CoreAudio taps require the usage description there too.
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

if (process.platform === 'darwin') {
  const electronExecutable = require('electron');
  const plist = path.resolve(path.dirname(electronExecutable), '..', 'Info.plist');
  // macOS notifications use the host bundle icon, not just BrowserWindow.icon.
  // Keep Electron's bundle ID/path stable so this does not create a new identity.
  const sourceIcon = path.join(__dirname, '..', 'build', 'icon.icns');
  const resources = path.resolve(path.dirname(electronExecutable), '..', 'Resources');
  const iconName = execFileSync('/usr/bin/plutil', ['-extract', 'CFBundleIconFile', 'raw', '-o', '-', plist], { encoding: 'utf8' }).trim();
  const targetIcon = path.join(resources, iconName.endsWith('.icns') ? iconName : `${iconName}.icns`);
  const icon = fs.readFileSync(sourceIcon);
  if (!fs.existsSync(targetIcon) || !fs.readFileSync(targetIcon).equals(icon)) {
    fs.copyFileSync(sourceIcon, targetIcon);
    console.log('Edgee development app icon updated.');
  }
  const descriptions = require('../package.json').build.mac.extendInfo;
  let changed = false;
  for (const key of ['NSMicrophoneUsageDescription', 'NSAudioCaptureUsageDescription', 'NSScreenCaptureUsageDescription']) {
    const value = descriptions[key];
    if (!value) throw new Error(`Missing macOS usage description: ${key}`);
    const current = spawnSync('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist], { encoding: 'utf8' });
    if (current.status === 0 && current.stdout.trim() === value) continue;
    execFileSync('/usr/bin/plutil', [current.status === 0 ? '-replace' : '-insert', key, '-string', value, plist]);
    changed = true;
  }
  console.log(changed ? 'Electron development audio usage descriptions updated.' : 'Electron development audio usage descriptions ready.');
}
