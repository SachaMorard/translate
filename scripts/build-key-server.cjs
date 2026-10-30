const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const helperPath = path.join('node_modules', 'node-global-key-listener', 'bin', 'MacKeyServer');

function compile(output, arch) {
  const target = { arm64: 'arm64-apple-macos11.0', x64: 'x86_64-apple-macos11.0' }[arch];
  if (!target) throw new Error(`Unsupported MacKeyServer architecture: ${arch}`);
  const cache = mkdtempSync(path.join(tmpdir(), 'translate-swift-'));
  try {
    execFileSync('xcrun', [
      'swiftc', path.join(root, 'native', 'MacKeyServer', 'main.swift'),
      '-O', '-target', target, '-module-cache-path', cache, '-o', output
    ], { stdio: 'inherit' });
    execFileSync('codesign', ['--force', '--sign', '-', output], { stdio: 'inherit' });
    execFileSync('lipo', [output, '-verify_arch', arch === 'x64' ? 'x86_64' : arch]);
    console.log(`MacKeyServer compiled for ${arch}`);
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
}

// Compile the unpacked helper before electron-builder signs the app.
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const { Arch } = require('builder-util');
  const output = path.join(context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    'Contents', 'Resources', 'app.asar.unpacked', helperPath);
  compile(output, Arch[context.arch]);
};

if (require.main === module && process.platform === 'darwin') {
  compile(path.join(root, helperPath), process.arch);
}
