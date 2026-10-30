// Continuous 24 kHz mono PCM16 in 100 ms packets, including silence.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
    this.flushed = false;
    this.port.onmessage = ({ data }) => {
      if (data === 'flush') {
        if (this.samples.length) this.packet(this.samples.splice(0));
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
  packet(samples) {
    const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
    this.port.postMessage({ level: Math.min(1, rms * 8) });
    this.send(samples);
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
