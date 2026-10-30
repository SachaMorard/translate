// Shared build/runtime config loader.
// Packaged config injected at build time (config.build.json in app.asar).
// Falls back to .env / process.env in development.
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildConfigPath = path.join(__dirname, 'config.build.json');
let buildConfig = {};
if (fs.existsSync(buildConfigPath)) {
  try {
    buildConfig = JSON.parse(fs.readFileSync(buildConfigPath, 'utf8'));
  } catch (e) {
    console.error('Failed to read config.build.json:', e.message);
  }
}

// dotenv is a dev convenience (reads .env from cwd). Harmless in packaged mode.
dotenv.config();

// process.env takes precedence over the baked-in build config so dev overrides win.
export const config = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || buildConfig.OPENAI_API_KEY || '',
  EDGEE_API_KEY: process.env.EDGEE_API_KEY || buildConfig.EDGEE_API_KEY || '',
  EDGEE_MODEL: process.env.EDGEE_MODEL || buildConfig.EDGEE_MODEL || 'gpt-6-luna:openai',
  EDGEE_LIVE_MODEL: process.env.EDGEE_LIVE_MODEL || buildConfig.EDGEE_LIVE_MODEL || 'gpt-4.1-mini:openai',
  SHORTCUT_DELAY_MS: process.env.SHORTCUT_DELAY_MS || buildConfig.SHORTCUT_DELAY_MS || '500',
};

export default config;
