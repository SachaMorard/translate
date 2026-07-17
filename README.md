# Translation App

A macOS-focused translation app for French ↔ English translation using Edgee Gateway (OpenAI-compatible AI gateway).

## Features

- **UI Mode**: DeepL-like interface with dual textareas for translating longer texts and spell checking
- **Quick Translate Mode**: System-wide keyboard shortcut (double ⌘C) to instantly translate selected text in any application and replace it
- **Quick Spell Check Mode**: System-wide keyboard shortcut (triple ⌘C) to instantly spell check and correct selected text

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Key:**
   - Copy `.env.example` to `.env`
   - Add your Edgee API key:
     ```
     EDGEE_API_KEY=your-api-key-here
     EDGEE_MODEL=anthropic/claude-sonnet-4.6
     ```

3. **Run the app:**
   ```bash
   npm start
   ```

## Usage

### UI Mode
1. Launch the app with `npm start`
2. Select source and target languages
3. Type or paste text in the left textarea
4. Translation appears automatically in the right textarea
5. Use the swap button (↔) to switch languages

### Quick Translate Mode
1. Select text in any application
2. Press ⌘C twice quickly (within 500ms)
3. The selected text will be automatically translated and replaced

### Quick Spell Check Mode
1. Select text in any application
2. Press ⌘C three times quickly (within 500ms for each press)
3. The selected text will be automatically spell checked and replaced

## Building

To create a macOS application bundle:

```bash
npm run build
```

The built app will be in the `dist` folder.

### Install and enable global shortcuts

1. Open the generated `.dmg` from `dist`.
2. Drag **Translate App** into **Applications**.
3. Launch it from **Applications** once, then keep it in the Dock if desired.
4. Open **System Settings → Privacy & Security → Accessibility**.
5. Enable **Translate App**, then quit and reopen it.

The installed app must remain at the same path after Accessibility permission is granted. Rebuilding or moving the app can make macOS request permission again.

## Requirements

- macOS (for keyboard shortcuts and clipboard automation)
- Node.js 16+
- Edgee API key (get one at https://www.edgee.ai)

## Configuration

Edit `.env` to customize:
- `EDGEE_API_KEY`: Your Edgee API key
- `EDGEE_MODEL`: AI model to use (default: anthropic/claude-sonnet-4.6)
- `SHORTCUT_DELAY_MS`: Time window for double ⌘C (default: 500ms)

## Troubleshooting

**Global shortcuts not working:**
- Install the app in `/Applications`; do not run it directly from the mounted `.dmg`
- Grant Accessibility permission in System Settings → Privacy & Security → Accessibility
- Quit and reopen the app after changing permission
- Remove an older Translate App entry from Accessibility and add the installed app again if macOS retained stale permission data

**Translation fails:**
- Check that your Edgee API key is valid
- Ensure you have internet connection
- Check console logs for error details

## License

MIT
