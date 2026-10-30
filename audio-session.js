import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { validatePair } from './languages.js';

// Keys and provider sockets stay in the main process. No audio is saved to disk.
export class AudioSession {
  constructor({ apiKey, translator, pair, sources, emit, Socket = WebSocket }) {
    if (!apiKey) throw new Error('Add OPENAI_API_KEY to .env, then restart the app to enable audio transcription.');
    this.pair = validatePair(pair);
    if (!Array.isArray(sources) || !sources.length || sources.length > 2 ||
        new Set(sources).size !== sources.length || !sources.every(s => ['microphone', 'system'].includes(s))) {
      throw new Error('Choose microphone, system audio, or both.');
    }
    this.id = randomUUID();
    this.apiKey = apiKey;
    this.translator = translator;
    this.sources = sources;
    this.emit = event => { if (!this.closed) emit({ sessionId: this.id, ...event }); };
    this.Socket = Socket;
    this.channels = new Map();
    this.sequence = 0;
    this.closed = false;
    this.stopping = false;
  }

  async start() {
    try { await Promise.all(this.sources.map(source => this.connect(source))); }
    catch (error) { this.close(); throw error; }
    if (this.closed) throw new Error('Audio session was cancelled.');
    return this.id;
  }

  connect(source) {
    return new Promise((resolve, reject) => {
      const socket = new this.Socket('wss://api.openai.com/v1/realtime?intent=transcription', {
        headers: { Authorization: `Bearer ${this.apiKey}` }, handshakeTimeout: 15000,
        maxPayload: 1024 * 1024
      });
      const channel = { socket, ready: false, bufferedBytes: 0, pending: 0, items: new Map() };
      this.channels.set(source, channel);
      const timeout = setTimeout(() => fail('Audio connection timed out. Please retry.'), 20000);
      const fail = message => {
        clearTimeout(timeout);
        if (!channel.ready) reject(new Error(message));
        else this.fail(message);
      };
      channel.cancel = () => { clearTimeout(timeout); reject(new Error('Audio session was cancelled.')); };
      socket.on('open', () => {
        if (this.closed) return socket.close();
        socket.send(JSON.stringify({ type: 'session.update', session: {
          type: 'transcription', audio: { input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model: 'gpt-live-transcribe', languages: this.pair, delay: 'low' },
            turn_detection: null
          } }
        } }));
      });
      socket.on('message', data => {
        if (this.closed) return;
        try {
          const event = JSON.parse(data.toString());
          if (event.type === 'session.updated') {
            channel.ready = true; clearTimeout(timeout); resolve();
          } else if (event.type === 'error') {
            fail(event.error?.message || 'Audio service rejected the request.');
          } else if (event.type === 'input_audio_buffer.committed') {
            this.item(channel, source, event.item_id, event.previous_item_id);
          } else if (event.type === 'conversation.item.input_audio_transcription.delta') {
            const item = this.item(channel, source, event.item_id);
            item.transcript += event.delta || '';
            this.emit({ type: 'subtitle', source, ...item, status: 'transcribing' });
          } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
            void this.complete(channel, source, event).catch(error => fail(error.message));
          } else if (event.type === 'conversation.item.input_audio_transcription.failed') {
            fail(event.error?.message || 'Transcription failed. Please restart capture.');
          }
        } catch (error) { fail(error.message); }
      });
      socket.on('error', () => fail('Cannot connect to OpenAI audio. Check your API key and connection.'));
      socket.on('close', () => { if (!this.closed) fail('Audio connection closed. Please restart capture.'); });
    });
  }

  item(channel, source, id, previousId) {
    if (!id) throw new Error('Audio service returned a missing segment ID.');
    if (!channel.items.has(id)) {
      channel.items.set(id, { id: `${source}:${id}`, sequence: ++this.sequence,
        transcript: '', translation: '', timestamp: Date.now() });
    }
    const item = channel.items.get(id);
    if (previousId) item.previousId = `${source}:${previousId}`;
    return item;
  }

  async complete(channel, source, event) {
    const item = this.item(channel, source, event.item_id);
    if (item.completed) return;
    item.completed = true;
    item.transcript = event.transcript?.trim() || '';
    try {
      if (item.transcript) {
        this.emit({ type: 'subtitle', source, ...item, status: 'translating' });
        const result = await this.translator.autoTranslate(item.transcript, this.pair);
        this.emit({ type: 'subtitle', source, ...item, ...result, status: 'complete' });
      } else this.emit({ type: 'subtitle', source, ...item, status: 'empty' });
    } catch (error) {
      this.emit({ type: 'subtitle', source, ...item, status: 'error', error: error.message });
    } finally {
      channel.pending = Math.max(0, channel.pending - 1);
      // Keep only recent IDs for duplicate-event protection during long sessions.
      if (channel.items.size > 200) {
        for (const [id, old] of channel.items) {
          if (old.completed && old !== item) { channel.items.delete(id); break; }
        }
      }
    }
  }

  input(source, packet) {
    if (this.closed || this.stopping) return;
    const channel = this.channels.get(source);
    if (!channel?.ready) return;
    if (packet.commit) return this.commit(channel);
    if (!(packet.pcm instanceof Uint8Array) || !packet.pcm.length ||
        packet.pcm.length > 48000 || packet.pcm.length % 2) {
      return this.fail('Invalid audio packet. Please restart capture.');
    }
    if (channel.socket.bufferedAmount > 1024 * 1024 || channel.pending >= 8) {
      return this.fail('The connection is too slow for live subtitles. Capture stopped to avoid losing audio.');
    }
    channel.bufferedBytes += packet.pcm.length;
    channel.socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: Buffer.from(packet.pcm).toString('base64') }));
    if (channel.bufferedBytes >= 48000 * 10) this.commit(channel);
  }

  commit(channel) {
    if (channel.bufferedBytes < 4800) return; // Provider requires at least 100 ms.
    channel.socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    channel.bufferedBytes = 0;
    channel.pending++;
  }

  async stop() {
    if (this.closed) return;
    this.stopping = true;
    for (const channel of this.channels.values()) if (channel.ready) this.commit(channel);
    const deadline = Date.now() + 20000;
    while (!this.closed && [...this.channels.values()].some(c => c.pending > 0) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!this.closed && [...this.channels.values()].some(c => c.pending > 0)) {
      this.emit({ type: 'error', error: 'Capture stopped, but some final subtitles could not finish within 20 seconds.' });
    }
    this.close();
  }

  fail(error) { this.emit({ type: 'error', error }); this.close(); }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const channel of this.channels.values()) {
      channel.cancel();
      channel.socket.terminate();
    }
    this.apiKey = '';
  }
}
