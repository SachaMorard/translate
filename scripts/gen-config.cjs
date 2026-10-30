// Pre-build step: reads local .env (gitignored) and writes config.build.json.
// config.build.json is packaged into app.asar and read at runtime by translator.js,
// so the built app has the API key without setup and without committing the key.
// The raw .env is never committed; only this generated file ships in the bundle.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const outPath = path.join(root, 'config.build.json');

function parseEnv(filePath) {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const cfg = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    cfg[key] = val;
  }
  return cfg;
}

const env = parseEnv(envPath);

// Process env overrides (lets CI inject without .env), but only known keys.
const keys = ['OPENAI_API_KEY', 'EDGEE_API_KEY', 'EDGEE_MODEL', 'EDGEE_LIVE_MODEL', 'SHORTCUT_DELAY_MS'];
const config = {};
for (const k of keys) {
  config[k] = process.env[k] || env[k] || '';
}

if (!config.EDGEE_API_KEY) {
  console.warn('⚠️  EDGEE_API_KEY not found in .env or environment. The built app will not be able to translate until a key is provided.');
} else {
  console.log('✓ EDGEE_API_KEY found — injecting into config.build.json');
}

fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
console.log(`Wrote ${path.relative(root, outPath)}`);
