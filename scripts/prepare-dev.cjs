// electron-builder sets these keys in the packaged app, but npm start runs the
// stock Electron.app. CoreAudio taps require the usage description there too.
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');

if (process.platform === 'darwin') {
  const electronExecutable = require('electron');
  const plist = path.resolve(path.dirname(electronExecutable), '..', 'Info.plist');
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
