import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { AudioSession } from '../audio-session.js';
class Socket extends EventEmitter {
  static instances = [];
  constructor() { super(); this.sent = []; this.bufferedAmount = 0; Socket.instances.push(this); queueMicrotask(() => this.emit('open')); }
  send(raw) {
    const message = JSON.parse(raw); this.sent.push(message);
    if (message.type === 'session.update') queueMicrotask(() => this.event({type:'session.updated'}));
  }
  event(event) { this.emit('message', Buffer.from(JSON.stringify(event))); }
  terminate() { this.terminated = true; this.emit('close'); }
}
function setup(sources = ['microphone']) {
  const events = [];
  const session = new AudioSession({apiKey:'test', pair:['es','pt'], sources, Socket,
    translator: {autoTranslate: async (text,pair) => { assert.deepEqual(pair,['es','pt']); return {translation:'Olá',detectedLang:'es',targetLang:'pt'}; }},
    emit: event => events.push(event)});
  return {session,events};
}
test('connects two sources, transcribes deltas, translates and drains on stop', async () => {
  const {session,events} = setup(['microphone','system']); await session.start();
  const channel = session.channels.get('microphone'); const socket = channel.socket;
  assert.deepEqual(socket.sent[0].session.audio.input.transcription.languages,['es','pt']);
  session.input('microphone',{pcm:new Uint8Array(4800)});
  session.input('microphone',{commit:true});
  assert.equal(socket.sent.at(-1).type,'input_audio_buffer.commit');
  socket.event({type:'input_audio_buffer.committed',item_id:'one'});
  socket.event({type:'conversation.item.input_audio_transcription.delta',item_id:'one',delta:'Hola'});
  const stopped = session.stop();
  socket.event({type:'conversation.item.input_audio_transcription.completed',item_id:'one',transcript:'Hola'});
  await stopped;
  assert.equal(events.at(-1).translation,'Olá');
  assert.equal(events[0].transcript,'Hola');
  assert.ok([...session.channels.values()].every(c=>c.socket.terminated));
  assert.equal(channel.pending,0);
});
test('rejects invalid data and stops all capture sockets on backpressure', async () => {
  const {session,events} = setup(); await session.start();
  session.channels.get('microphone').socket.bufferedAmount = 2 * 1024 * 1024;
  session.input('microphone',{pcm:new Uint8Array(4800)});
  assert.ok(session.closed); assert.match(events.at(-1).error,/too slow/);
});
test('connection loss and malformed messages produce visible errors', async () => {
  for (const event of ['close','invalid']) {
    const {session,events} = setup(); await session.start();
    const socket=session.channels.get('microphone').socket;
    if(event==='close') socket.emit('close'); else socket.emit('message',Buffer.from('{'));
    assert.ok(session.closed); assert.equal(events.at(-1).type,'error');
  }
});
test('translation errors retain the original transcript', async () => {
  const {session,events}=setup(); await session.start();
  session.translator.autoTranslate = async () => {throw new Error('Unavailable');};
  const socket=session.channels.get('microphone').socket;
  socket.event({type:'conversation.item.input_audio_transcription.completed',item_id:'one',transcript:'Hola'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.at(-1).transcript,'Hola'); assert.equal(events.at(-1).status,'error');
  session.close();
});
test('missing key and invalid source selections fail before connecting', () => {
  assert.throws(()=>new AudioSession({apiKey:''}),/OPENAI_API_KEY/);
  assert.throws(()=>setup(['microphone','microphone']),/Choose/);
});
