import { clipboard } from 'electron';
import robot from 'robotjs';
import { GlobalKeyboardListener } from 'node-global-key-listener';

class ShortcutHandler {
  constructor(translator, notificationCallback) {
    this.translator = translator;
    this.notificationCallback = notificationCallback;
    this.listener = new GlobalKeyboardListener();
    this.cmdCPressCount = 0;
    this.lastCmdCTime = 0;
    this.cmdCTimer = null;
    this.shortcutDelay = parseInt(process.env.SHORTCUT_DELAY_MS || '500');
    this.isProcessing = false;
    this.isSpellChecking = false;
    this.cKeyWasPressed = false;
  }

  start() {
    try {
      this.listener.addListener((e, down) => {
      // 'down' is a map of currently pressed keys
      // Check if Command (META) key is currently pressed
      const cmdPressed = down['LEFT META'] || down['RIGHT META'];

      // Track if C key is currently pressed (to avoid repeats)
      const cPressed = down['C'];

      // Detect Cmd+C - only on the initial press, not repeats
      if (e.name === 'C' && cmdPressed && cPressed && !this.cKeyWasPressed) {
        console.log('✓ Cmd+C detected!');
        this.cKeyWasPressed = true;
        this.handleCmdC();
      }

      // Reset flag when C key is released
      if (e.name === 'C' && !cPressed) {
        this.cKeyWasPressed = false;
      }
      });

      console.log('Global keyboard shortcut handler started (double Cmd+C for translate, triple Cmd+C for spell check)');
    } catch (error) {
      console.error('Failed to start keyboard listener:', error.message);
      throw error;
    }
  }

  handleCmdC() {
    const now = Date.now();
    const timeSinceLastCmdC = now - this.lastCmdCTime;

    // If too much time has passed, reset the count
    if (timeSinceLastCmdC > this.shortcutDelay) {
      this.cmdCPressCount = 0;
    }

    // Increment press count
    this.cmdCPressCount++;
    this.lastCmdCTime = now;

    console.log(`Cmd+C press #${this.cmdCPressCount} (time since last: ${timeSinceLastCmdC}ms)`);

    // Clear any existing timer
    if (this.cmdCTimer) {
      clearTimeout(this.cmdCTimer);
    }

    // Set a timer to execute the action after the delay
    // This allows us to wait and see if more presses come
    this.cmdCTimer = setTimeout(() => {
      if (this.cmdCPressCount === 2) {
        // Double Cmd+C - Translation
        console.log('🎯 Double Cmd+C detected! Triggering translation...');
        if (!this.isProcessing) {
          this.triggerQuickTranslate();
        }
      } else if (this.cmdCPressCount >= 3) {
        // Triple Cmd+C - Spell Check
        console.log('🎯 Triple Cmd+C detected! Triggering spell check...');
        if (!this.isSpellChecking) {
          this.triggerSpellCheck();
        }
      }

      // Reset count
      this.cmdCPressCount = 0;
    }, this.shortcutDelay);
  }

  async triggerQuickTranslate() {
    this.isProcessing = true;

    try {
      // Show loading notification immediately
      if (this.notificationCallback) {
        this.notificationCallback('🔄 Translating...', 'Please wait while we translate your text');
      }

      // Small delay to ensure clipboard is populated
      await this.sleep(100);

      const text = clipboard.readText();

      if (!text || text.trim().length === 0) {
        console.log('Clipboard is empty, skipping translation');
        if (this.notificationCallback) {
          this.notificationCallback('⚠️ No Text Found', 'Clipboard is empty');
        }
        this.isProcessing = false;
        return;
      }

      console.log('Quick translate triggered for:', text.substring(0, 50) + '...');

      // Translate
      const result = await this.translator.autoTranslate(text);

      // Write translation to clipboard
      clipboard.writeText(result.translation);

      // Show success notification
      if (this.notificationCallback) {
        this.notificationCallback(
          `✅ Translated ${result.detectedLang.toUpperCase()} → ${result.targetLang.toUpperCase()}`,
          result.translation.substring(0, 100)
        );
      }

      // Small delay before pasting
      await this.sleep(100);

      // Simulate Cmd+V to paste
      robot.keyTap('v', ['command']);

      console.log('Translation pasted successfully');
    } catch (error) {
      console.error('Quick translate error:', error);

      if (this.notificationCallback) {
        this.notificationCallback('❌ Translation Error', error.message);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async triggerSpellCheck() {
    this.isSpellChecking = true;

    try {
      // Show loading notification immediately
      if (this.notificationCallback) {
        this.notificationCallback('🔄 Checking Spelling...', 'Please wait while we check your text');
      }

      // Small delay to ensure clipboard is populated
      await this.sleep(100);

      const text = clipboard.readText();

      if (!text || text.trim().length === 0) {
        console.log('Clipboard is empty, skipping spell check');
        if (this.notificationCallback) {
          this.notificationCallback('⚠️ No Text Found', 'Clipboard is empty');
        }
        this.isSpellChecking = false;
        return;
      }

      console.log('Spell check triggered for:', text.substring(0, 50) + '...');

      // Spell check
      const correctedText = await this.translator.spellCheck(text);

      // Check if any corrections were made
      const hasChanges = correctedText !== text;

      // Write corrected text to clipboard
      clipboard.writeText(correctedText);

      // Show success notification
      if (this.notificationCallback) {
        if (hasChanges) {
          this.notificationCallback(
            '✅ Spell Check Complete',
            'Text corrected and ready to paste'
          );
        } else {
          this.notificationCallback(
            '✅ Spell Check Complete',
            'No errors found'
          );
        }
      }

      // Small delay before pasting
      await this.sleep(100);

      // Simulate Cmd+V to paste the corrected text
      robot.keyTap('v', ['command']);

      console.log('Spell check completed and pasted successfully');
    } catch (error) {
      console.error('Spell check error:', error);

      if (this.notificationCallback) {
        this.notificationCallback('❌ Spell Check Error', error.message);
      }
    } finally {
      this.isSpellChecking = false;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    if (this.listener) {
      this.listener.kill();
      console.log('Keyboard shortcut handler stopped');
    }
  }
}

export default ShortcutHandler;
