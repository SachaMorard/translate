import { waitForLiveAudio } from './audio-tracks.js';
const $ = id => document.getElementById(id);
const sourceName = source => source === 'microphone' ? 'Microphone' : 'Computer';

export class AudioController {
  constructor(lock) {
    this.lock = lock;
    this.streams = [];
    this.nodes = [];
    this.rows = new Map();
    this.clearedAt = 0;
    this.run = 0;
    this.state = 'idle';
    for (const [id, source] of [['captureMicrophone', 'microphone'], ['captureSystem', 'system']]) {
      $(id).addEventListener('click', () => {
        if (this.state !== 'idle') return;
        $(id).setAttribute('aria-pressed', String($(id).getAttribute('aria-pressed') !== 'true'));
        this.setLevel(source, 0);
      });
    }
    $('startAudio').addEventListener('click', () => this.start());
    $('stopAudio').addEventListener('click', () => this.stop());
    $('copySubtitles').addEventListener('click', () => this.copy());
    $('cleanSubtitles').addEventListener('click', () => this.clearSubtitles());
    this.unsubscribe = window.electronAPI.onAudioEvent(event => this.onEvent(event));
  }
  setLevel(source, level) {
    const meter = $(source + 'Level');
    const value = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    meter.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    const thresholds = [0.015, 0.08, 0.22, 0.5];
    [...meter.children].forEach((bar, index) => bar.classList.toggle('lit', value >= thresholds[index]));
  }
  showError(message = '') {
    $('audioError').textContent = message;
    $('audioError').classList.toggle('hidden', !message);
  }
  status(text) { $('audioStatus').textContent = text; }
  setState(state) {
    this.state = state;
    document.querySelector('.audio-main').dataset.state = state;
    $('startAudio').classList.toggle('hidden', state === 'recording' || state === 'stopping');
    $('stopAudio').classList.toggle('hidden', state !== 'recording' && state !== 'stopping');
    $('startAudioLabel').textContent = state === 'starting' ? 'Connecting…' : 'Start capture';
    $('stopAudioLabel').textContent = state === 'stopping' ? 'Finishing…' : 'Stop capture';
    this.lock(state !== 'idle');
    $('stopAudio').disabled = state !== 'recording';
    for (const id of ['captureMicrophone', 'captureSystem']) $(id).disabled = state !== 'idle';
    $('recordingBadge').classList.toggle('hidden', state !== 'recording');
  }
  async start() {
    if (this.state !== 'idle') return;
    const sources = [];
    if ($('captureMicrophone').getAttribute('aria-pressed') === 'true') sources.push('microphone');
    if ($('captureSystem').getAttribute('aria-pressed') === 'true') sources.push('system');
    if (!sources.length) return this.showError('Select at least one audio source.');
    const run = ++this.run;
    this.showError(); this.setState('starting'); this.status('Connecting…');
    // Request display media during the click's transient user activation, before any network await.
    const display = sources.includes('system')
      ? navigator.mediaDevices.getDisplayMedia({ audio: true, video: { width: 320, height: 180, frameRate: 1 } })
          .then(stream => {
            if (run !== this.run || this.state !== 'starting') stream.getTracks().forEach(track => track.stop());
            else this.streams.push(stream);
            return { stream };
          }, error => ({ error }))
      : null;
    try {
      const session = await window.electronAPI.startAudio({ sources });
      if (!session.success) throw new Error(session.error);
      if (run !== this.run || this.state !== 'starting') { await window.electronAPI.stopAudio(session.sessionId); return; }
      this.sessionId = session.sessionId;
      this.status('Waiting for capture permissions…');
      for (const source of sources) {
        let stream;
        if (source === 'microphone') {
          const allowed = await window.electronAPI.microphonePermission();
          if (!allowed) throw new Error('Microphone access denied. Enable it in System Settings → Privacy & Security → Microphone, then restart the app.');
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        } else {
          const result = await display;
          if (result.error) throw result.error;
          stream = result.stream;
        }
        if (run !== this.run || this.state !== 'starting') { stream.getTracks().forEach(track => track.stop()); return; }
        if (source === 'microphone') this.streams.push(stream);
        let tracks;
        try { tracks = await waitForLiveAudio(stream); }
        catch (error) {
          const help = source === 'system'
            ? 'Computer audio requires macOS 14.2+ and System Audio Recording permission. With npm start, quit and reopen your terminal or IDE after granting permission, then restart the app.'
            : 'Allow Microphone access in macOS Privacy & Security and check your input device.';
          throw new Error(`${sourceName(source)} audio is unavailable: ${error.message} ${help}`);
        }
        if (run !== this.run || this.state !== 'starting') return;
        for (const track of stream.getTracks()) {
          track.addEventListener('ended', () => {
            if (this.state === 'recording' || this.state === 'starting') {
              this.showError(`${sourceName(source)} capture ended. Restart capture to continue.`);
              void this.stop();
            }
          });
        }
        // Only audio tracks enter the processing graph. No screen images leave this process.
        const audioStream = new MediaStream(tracks);
        if (!this.context) {
          this.context = new AudioContext({ sampleRate: 24000 });
          await this.context.suspend();
        }
        if (run !== this.run || this.state !== 'starting') return;
        if (this.context.sampleRate !== 24000) throw new Error('This audio device cannot provide 24 kHz capture.');
        if (!this.workletLoaded) {
          await this.context.audioWorklet.addModule('./audio-worklet.js');
          this.workletLoaded = true;
        }
        if (run !== this.run || this.state !== 'starting') return;
        const node = new AudioWorkletNode(this.context, 'capture-processor');
        const input = this.context.createMediaStreamSource(audioStream);
        const entry = { node, input, source };
        node.port.onmessage = ({ data }) => {
          if (data.flushed) { entry.onFlushed?.(); return; }
          if (run !== this.run) return;
          if (typeof data.level === 'number') { this.setLevel(source, data.level); return; }
          window.electronAPI.sendAudio({ sessionId: this.sessionId, source, ...data });
        };
        this.nodes.push(entry);
        input.connect(node);
        node.connect(this.context.destination); // Worklet outputs silence.
      }
      if (run !== this.run || this.state !== 'starting') return;
      this.rows.clear(); $('subtitles').replaceChildren(); $('copySubtitles').disabled = true;
      await this.context.resume();
      if (run !== this.run || this.state !== 'starting') return;
      this.setState('recording'); this.status('Live');
    } catch (error) {
      if (run !== this.run || this.state !== 'starting') return;
      const hint = ['NotAllowedError', 'NotReadableError'].includes(error.name)
        ? ' Allow microphone and system audio recording in macOS Privacy & Security, then restart the app (or terminal when using npm start).'
        : '';
      this.showError(error.message + hint);
      await this.stop();
    }
  }
  async stop() {
    if (this.state === 'idle' || this.state === 'stopping') return;
    this.setState('stopping'); this.status('Finishing subtitles…');
    try {
      await Promise.all(this.nodes.map(entry => new Promise(resolve => {
        const timer = setTimeout(resolve, 500);
        entry.onFlushed = () => { clearTimeout(timer); resolve(); };
        entry.node.port.postMessage('flush');
      })));
      this.releaseCapture();
      if (this.sessionId) await window.electronAPI.stopAudio(this.sessionId);
    } catch (error) { this.showError(error.message); }
    finally {
      ++this.run;
      this.releaseCapture();
      this.sessionId = null;
      this.setState('idle'); this.status('Stopped');
    }
  }
  releaseCapture() {
    for (const stream of this.streams) stream.getTracks().forEach(track => track.stop());
    this.streams = [];
    for (const { node, input } of this.nodes) { node.disconnect(); input.disconnect(); node.port.close(); }
    this.nodes = [];
    if (this.context) void this.context.close();
    this.context = null; this.workletLoaded = false;
    this.setLevel('microphone', 0); this.setLevel('system', 0);
  }
  onEvent(event) {
    if (event.sessionId !== this.sessionId) return;
    if (event.type === 'error') { this.showError(event.error); void this.stop(); return; }
    if (event.type !== 'subtitle') return;
    // Late results for cleared segments must not repopulate the history.
    if (event.timestamp <= this.clearedAt) return;
    const list = $('subtitles');
    const follow = list.scrollHeight - list.clientHeight - list.scrollTop < 80;
    let row = this.rows.get(event.id);
    if (event.status === 'empty') {
      row?.element.remove(); this.rows.delete(event.id); return;
    }
    if (!row) {
      const element = document.createElement('article'); element.className = 'subtitle';
      const translated = document.createElement('div'); translated.className = 'subtitle-translation';
      const original = document.createElement('div'); original.className = 'subtitle-original';
      element.append(original, translated);
      row = { element, translated, original, event };
      this.rows.set(event.id, row);
      list.append(element);
    }
    row.event = event;
    // Commit events identify the previous turn even if completion events arrive out of order.
    for (let pass = 0; pass < this.rows.size; pass++) {
      let changed = false;
      for (const candidate of this.rows.values()) {
        const previous = this.rows.get(candidate.event.previousId);
        if (previous && previous !== candidate &&
            (previous.element.compareDocumentPosition(candidate.element) & Node.DOCUMENT_POSITION_PRECEDING)) {
          previous.element.after(candidate.element); changed = true;
        }
      }
      if (!changed) break;
    }
    row.original.textContent = event.transcript;
    row.translated.textContent = event.status === 'error' ? event.error : event.translation || (event.status === 'translating' ? 'Translating…' : 'Listening…');
    row.translated.classList.toggle('subtitle-error', event.status === 'error');
    if (this.rows.size > 200) {
      const first = list.firstElementChild;
      for (const [id, candidate] of this.rows) if (candidate.element === first) { this.rows.delete(id); first.remove(); break; }
    }
    $('copySubtitles').disabled = ![...this.rows.values()].some(r => r.event.translation);
    if (follow) list.scrollTop = list.scrollHeight;
  }
  clearSubtitles() {
    this.clearedAt = Date.now();
    if (this.sessionId) window.electronAPI.clearAudio(this.sessionId);
    this.rows.clear();
    $('subtitles').replaceChildren();
    $('subtitles').scrollTop = 0;
    $('copySubtitles').disabled = true;
  }
  async copy() {
    const ordered = [...$('subtitles').children].map(element => [...this.rows.values()].find(row => row.element === element));
    const text = ordered.filter(row => row?.event.translation).map(row => row.event.translation).join('\n\n');
    try { await navigator.clipboard.writeText(text); }
    catch { this.showError('Could not copy subtitles to clipboard.'); }
  }
  dispose() {
    ++this.run; this.unsubscribe(); this.releaseCapture();
    if (this.sessionId) void window.electronAPI.stopAudio(this.sessionId);
  }
}
