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
     EDGEE_MODEL=anthropic/claude-sonnet-4.5
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

## Requirements

- macOS (for keyboard shortcuts and clipboard automation)
- Node.js 16+
- Edgee API key (get one at https://www.edgee.ai)

## Configuration

Edit `.env` to customize:
- `EDGEE_API_KEY`: Your Edgee API key
- `EDGEE_MODEL`: AI model to use (default: anthropic/claude-sonnet-4.5)
- `SHORTCUT_DELAY_MS`: Time window for double ⌘C (default: 500ms)

## Troubleshooting

**Global shortcuts not working:**
- Make sure to grant Accessibility permissions to the app in System Preferences → Security & Privacy → Privacy → Accessibility

**Translation fails:**
- Check that your Edgee API key is valid
- Ensure you have internet connection
- Check console logs for error details

## License

MIT
