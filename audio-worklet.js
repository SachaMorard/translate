// 24 kHz mono PCM16, sent in 100 ms packets. A short pre-roll preserves word onsets.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
    this.preRoll = [];
    this.active = false;
    this.silence = 0;
    this.duration = 0;
    this.flushed = false;
    this.port.onmessage = ({ data }) => {
      if (data === 'flush') {
        if (this.samples.length) this.packet(this.samples.splice(0));
        this.commit();
        this.flushed = true;
        this.port.postMessage({ flushed: true });
      }
    };
  }
  send(samples) {
    const buffer = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buffer);
    samples.forEach((sample, i) => view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true));
    this.port.postMessage({ pcm: new Uint8Array(buffer) }, [buffer]);
  }
  commit() {
    if (this.active) this.port.postMessage({ commit: true });
    this.active = false;
    this.silence = 0;
    this.duration = 0;
    this.preRoll = [];
  }
  packet(samples) {
    const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
    const speaking = rms > 0.008;
    this.port.postMessage({ level: Math.min(1, rms * 8) });
    if (!this.active) {
      this.preRoll.push(samples);
      if (this.preRoll.length > 3) this.preRoll.shift();
      if (!speaking) return;
      this.active = true;
      for (const previous of this.preRoll) { this.send(previous); this.duration += previous.length; }
      this.preRoll = [];
    } else { this.send(samples); this.duration += samples.length; }
    this.silence = speaking ? 0 : this.silence + samples.length;
    if (this.silence >= 16800 || this.duration >= 120000) this.commit();
  }
  process(inputs) {
    if (this.flushed) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      this.samples.push(channels.reduce((sum, channel) => sum + channel[i], 0) / channels.length);
      if (this.samples.length === 2400) this.packet(this.samples.splice(0));
    }
    return true; // Output stays silent; never play captured audio through speakers.
  }
}
registerProcessor('capture-processor', CaptureProcessor);
