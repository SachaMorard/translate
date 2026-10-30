import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { validatePair } from './languages.js';

// Translation is continuous (including silence), with no commit/response turns.
// Audio and credentials remain in the main process; generated speech is discarded.
export class RealtimeTranslationSession {
  constructor({ apiKey, pair, sources, targetLanguage, emit, Socket = WebSocket, drainTimeout = 20000 }) {
    if (!apiKey) throw new Error('Add OPENAI_API_KEY to .env, then restart the app.');
    this.pair = validatePair(pair);
    if (!this.pair.includes(targetLanguage)) throw new Error('Choose a target language from the selected pair.');
    if (!Array.isArray(sources) || !sources.length || sources.length > 2 || new Set(sources).size !== sources.length ||
        !sources.every(source => ['microphone', 'system'].includes(source))) throw new Error('Choose microphone, system audio, or both.');
    Object.assign(this, { apiKey, sources, targetLanguage, Socket, drainTimeout });
    this.id = randomUUID();
    this.channels = new Map();
    this.sequence = 0;
    this.generation = 0;
    this.closed = false;
    this.stopping = false;
    this.emit = event => { if (!this.closed) emit({ sessionId: this.id, ...event }); };
  }
  async start() {
    try { await Promise.all(this.sources.map(source => this.connect(source))); }
    catch (error) { this.close(); throw error; }
    if (this.closed) throw new Error('Audio session was cancelled.');
    return this.id;
  }
  connect(source) {
    return new Promise((resolve, reject) => {
      const socket = new this.Socket('wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate', {
        headers: { Authorization: `Bearer ${this.apiKey}` }, handshakeTimeout: 15000, maxPayload: 1024 * 1024
      });
      const channel = { socket, ready: false, finished: false, items: new Map(), elapsed: 0 };
      this.channels.set(source, channel);
      const timer = setTimeout(() => fail('Translation connection timed out. Please retry.'), 20000);
      const fail = message => {
        clearTimeout(timer);
        if (!channel.ready) reject(new Error(message));
        else this.fail(message);
      };
      channel.cancel = () => { clearTimeout(timer); reject(new Error('Audio session was cancelled.')); channel.drained?.(); };
      socket.on('open', () => {
        if (this.closed) return socket.terminate();
        socket.send(JSON.stringify({ type: 'session.update', session: { audio: {
          input: { transcription: { model: 'gpt-realtime-whisper' } },
          output: { language: this.targetLanguage }
        } } }));
      });
      socket.on('message', data => {
        if (this.closed) return;
        try {
          const event = JSON.parse(data.toString());
          if (event.type === 'session.updated') {
            channel.ready = true; clearTimeout(timer); resolve();
          } else if (event.type === 'error') fail(event.error?.message || 'Realtime translation failed.');
          else if (['session.input_transcript.delta', 'session.output_transcript.delta'].includes(event.type)) {
            this.subtitle(channel, source, event);
          } else if (event.type === 'session.closed') {
            channel.finished = true;
            if (!this.stopping) return fail('Translation session ended. Restart capture to continue.');
            channel.drained?.();
            socket.close();
          }
        } catch (error) { fail(error.message); }
      });
      socket.on('error', () => fail('Cannot connect to OpenAI realtime translation. Check your API access and connection.'));
      socket.on('close', () => {
        if (!this.closed && !channel.finished) fail('Translation disconnected before final subtitles arrived.');
      });
    });
  }
  subtitle(channel, source, event) {
    if (typeof event.delta !== 'string' || !event.delta) return;
    // API deltas have no turn IDs. Group by stream time, not arrival order:
    // source/target text in a block is approximate alignment, not sentence pairs.
    const elapsed = Number.isFinite(event.elapsed_ms) ? Math.max(0, event.elapsed_ms) : channel.elapsed;
    channel.elapsed = Math.max(channel.elapsed, elapsed);
    const bucket = Math.floor(elapsed / 10000);
    // Ignore extremely late events for blocks already evicted from memory.
    if (bucket < Math.floor(channel.elapsed / 10000) - 199) return;
    let item = channel.items.get(bucket);
    if (!item) {
      item = { id: `${this.generation}:${source}:${bucket}`, sequence: ++this.sequence,
        timestamp: Date.now(), transcript: '', translation: '', targetLang: this.targetLanguage };
      channel.items.set(bucket, item);
    }
    item[event.type === 'session.input_transcript.delta' ? 'transcript' : 'translation'] += event.delta;
    // Bound a malformed or stalled stream's display/memory as well as row count.
    item.transcript = item.transcript.slice(-20000);
    item.translation = item.translation.slice(-20000);
    this.emit({ type: 'subtitle', source, ...item, status: 'translating' });
    if (channel.items.size > 200) channel.items.delete(Math.min(...channel.items.keys()));
  }
  input(source, packet) {
    if (this.closed || this.stopping) return;
    const channel = this.channels.get(source);
    if (!channel?.ready || packet.commit) return;
    if (!(packet.pcm instanceof Uint8Array) || !packet.pcm.length || packet.pcm.length > 48000 || packet.pcm.length % 2) {
      return this.fail('Invalid audio packet. Please restart capture.');
    }
    if (channel.socket.bufferedAmount > 1024 * 1024) return this.fail('Connection too slow for live translation. Please restart capture.');
    channel.socket.send(JSON.stringify({ type: 'session.input_audio_buffer.append', audio: Buffer.from(packet.pcm).toString('base64') }));
  }
  clear() {
    this.generation++;
    for (const channel of this.channels.values()) channel.items.clear();
  }
  async stop() {
    if (this.closed) return;
    if (this.stopPromise) return this.stopPromise;
    this.stopping = true;
    this.stopPromise = (async () => {
      let timer;
      const drained = Promise.all([...this.channels.values()].map(channel => new Promise(resolve => {
        channel.drained = resolve;
        if (!channel.ready || channel.finished) return resolve();
        channel.socket.send(JSON.stringify({ type: 'session.close' }));
      })));
      try {
        await Promise.race([drained, new Promise(resolve => { timer = setTimeout(() => {
          this.emit({ type: 'error', error: 'Some final subtitles could not finish within 20 seconds.' }); resolve();
        }, this.drainTimeout); })]);
      } finally { clearTimeout(timer); this.close(); }
    })();
    return this.stopPromise;
  }
  fail(error) { this.emit({ type: 'error', error }); this.close(); }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const channel of this.channels.values()) { channel.cancel(); channel.socket.terminate(); channel.items.clear(); }
    this.apiKey = '';
  }
}
