# Translation App

A macOS translation app for French, English, Spanish and Portuguese, using Edgee for text translation and OpenAI for live audio transcription.

## Features

- **UI Mode**: Scrollable text translation and spell checking, with a saved language pair shared by the interface and global shortcuts
- **Live Audio**: Microphone and/or computer audio capture, live transcripts and translated subtitles, with source labels and copy support
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
     EDGEE_MODEL=gpt-6-luna:openai
     ```

3. **Enable live audio (optional):**
   Add `OPENAI_API_KEY=your-openai-key` to `.env`. The audio feature uses OpenAI's
   `gpt-live-transcribe` Realtime API, then translates each segment with the configured
   Edgee model. An Edgee key alone cannot access the transcription endpoint.

4. **Run the app:**
   ```bash
   npm start
   ```

## Usage

### UI Mode
1. Launch the app with `npm start`
2. Select two different languages in the shared language bar
3. Type or paste text in either selected language in the left textarea
4. The model detects the language and translates into the other selected language
5. The pair is saved locally and also applies to double ⌘C and live audio

If the input is in neither selected language, it is translated into the second
language. Spell checking preserves the original language and supports all four languages.

### Live Audio
1. Select your language pair, then open **Live audio**.
2. Select **Microphone**, **Computer audio**, or both, and click **Start capture**.
3. Allow the macOS microphone and system/screen audio recording permissions when requested.
4. Transcripts appear as speech arrives; translations follow at pauses or after about
   five seconds of continuous speech, plus network/model latency. Both directions
   of the selected pair are translated automatically.
5. Click **Stop** to release capture immediately and finish pending subtitles
   (up to 20 seconds). **Copy subtitles** copies the translated history currently shown.

Use headphones when capturing both sources to avoid transcribing speaker output
again through the microphone. The two sources have separate transcription sessions.
The history retains the latest 200 segments. Starting a new capture clears the history.
Audio is streamed to OpenAI and transcripts are sent to Edgee for translation;
this app does not write audio or subtitle history to disk. Closing the window stops capture.

System audio capture requires **macOS 14.2 or later**. The packaged app includes
microphone and audio capture usage descriptions and the audio input entitlement.
Prefer the installed app for testing system audio permissions. With `npm start`,
macOS may attribute system audio recording to the terminal/IDE instead of Electron.
If access is denied or the audio track is muted, enable the relevant app in
**System Settings → Privacy & Security → Microphone / Screen & System Audio Recording**
(or **System Audio Recording**, depending on macOS), then quit and reopen it.
The capture API also supplies a screen video track; only audio enters processing,
and no video is sent to the transcription service.

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

Builds require Xcode Command Line Tools (`xcode-select --install`). The keyboard
helper is compiled from the vendored source for the target architecture, so
Apple silicon builds do not need Rosetta. `npm start` also rebuilds this helper
for the local Node.js architecture; use an ARM64 Node.js installation on Apple silicon.

### Install and enable global shortcuts

1. Open the generated `.dmg` from `dist`.
2. Drag **Translate App** into **Applications**.
3. Launch it from **Applications** once, then keep it in the Dock if desired.
4. Open **System Settings → Privacy & Security → Accessibility**.
5. Enable **Translate App**, then quit and reopen it.

The installed app must remain at the same path after Accessibility permission is granted. Rebuilding or moving the app can make macOS request permission again.

## Requirements

- macOS (14.2+ for computer audio capture)
- Node.js 22+
- Edgee API key (get one at https://www.edgee.ai)

## Configuration

Edit `.env` to customize:
- `OPENAI_API_KEY`: OpenAI API key for live transcription (optional for text-only use)
- `EDGEE_API_KEY`: Your Edgee API key
- `EDGEE_MODEL`: AI model to use (default: gpt-6-luna:openai, an OpenAI model accessed through Edgee)
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

## Validation

- `npm test`: language validation, translation contract, audio session lifecycle,
  error handling, buffering, silence detection and PCM segmentation.
- `npm run test:ui`: Electron integration tests with synthetic audio streams;
  checks language selection, scrolling, subtitle ordering and capture cleanup.
- Real microphone/system capture still requires a manual check of macOS permissions
  and audio devices on the target Mac. API access requires a key with Realtime access.

## License

MIT
