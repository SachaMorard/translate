import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { RealtimeTranslationSession } from '../realtime-translation-session.js';
class Socket extends EventEmitter {
  static instances = [];
  constructor(url) { super(); this.url = url; this.sent = []; this.bufferedAmount = 0; Socket.instances.push(this); }
  send(data) { this.sent.push(JSON.parse(data)); }
  terminate() { this.terminated = true; }
  close() { this.emit('close'); }
  event(event) { this.emit('message', Buffer.from(JSON.stringify(event))); }
}
async function setup(sources = ['microphone'], options = {}) {
  Socket.instances = [];
  const events = [];
  const session = new RealtimeTranslationSession({ apiKey: 'test', pair: ['fr','en'], sources, targetLanguage: 'fr', emit: e => events.push(e), Socket, ...options });
  const started = session.start();
  for (const socket of Socket.instances) { socket.emit('open'); socket.event({ type: 'session.updated' }); }
  await started;
  return { session, events, sockets: [...Socket.instances] };
}
test('continuous audio uses translation protocol and independent source channels', async () => {
  const {session,sockets} = await setup(['microphone','system']);
  try {
    assert.match(sockets[0].url, /realtime\/translations\?model=gpt-realtime-translate/);
    assert.equal(sockets[0].sent[0].session.audio.output.language, 'fr');
    assert.equal(sockets[0].sent[0].session.audio.input.transcription.model, 'gpt-realtime-whisper');
    session.input('microphone', {pcm:new Uint8Array(4800)});
    session.input('microphone', {commit:true});
    assert.equal(sockets[0].sent.length, 2);
    assert.equal(sockets[1].sent.length, 1);
    assert.equal(sockets[0].sent[1].type, 'session.input_audio_buffer.append');
  } finally {session.close();}
});
test('source and translated fragments append without inserted spaces, including identical timestamps; Clean allows new text', async () => {
  const {session,sockets:[s],events} = await setup();
  try {
    s.event({type:'session.output_transcript.delta',delta:'Bon',elapsed_ms:1200});
    s.event({type:'session.output_transcript.delta',delta:'jour',elapsed_ms:1200});
    s.event({type:'session.input_transcript.delta',delta:'Hello',elapsed_ms:1200});
    assert.equal(events.at(-1).translation,'Bonjour');
    assert.equal(events.at(-1).transcript,'Hello');
    const id=events.at(-1).id;
    session.clear();
    s.event({type:'session.output_transcript.delta',delta:' Nouveau',elapsed_ms:1400});
    assert.notEqual(events.at(-1).id,id);
    assert.equal(events.at(-1).translation,' Nouveau');
  } finally {session.close();}
});
test('stop drains final subtitles from both sources before closing', async () => {
  const {session,sockets,events} = await setup(['microphone','system']);
  const stop=session.stop();
  assert.ok(sockets.every(s=>s.sent.at(-1).type==='session.close'));
  session.input('microphone',{pcm:new Uint8Array(4800)});
  assert.equal(sockets[0].sent.at(-1).type,'session.close');
  sockets[0].event({type:'session.closed'});
  assert.equal(session.closed,false);
  sockets[1].event({type:'session.output_transcript.delta',delta:'Final'});
  sockets[1].event({type:'session.closed'});
  await stop;
  assert.equal(events.at(-1).translation,'Final');
  assert.ok(sockets.every(s=>s.terminated));
});
test('startup failure closes all channels', async () => {
  Socket.instances=[];
  const session=new RealtimeTranslationSession({apiKey:'test',pair:['fr','en'],targetLanguage:'fr',sources:['microphone','system'],emit:()=>{},Socket});
  const start=session.start();
  Socket.instances[0].event({type:'error',error:{message:'Not available'}});
  await assert.rejects(start,/Not available/);
  assert.ok(Socket.instances.every(s=>s.terminated));
});
test('drain timeout and backpressure close sockets with a visible error', async () => {
  const first=await setup(['microphone'],{drainTimeout:5});
  await first.session.stop();
  assert.match(first.events.at(-1).error,/final subtitles/);
  assert.equal(first.session.closed,true);
  const second=await setup();
  second.sockets[0].bufferedAmount=2*1024*1024;
  second.session.input('microphone',{pcm:new Uint8Array(4800)});
  assert.match(second.events.at(-1).error,/too slow/);
  assert.equal(second.session.closed,true);
});
test('target language must belong to selected pair', () => {
  assert.throws(()=>new RealtimeTranslationSession({apiKey:'test',pair:['fr','en'],targetLanguage:'es',sources:['microphone'],emit:()=>{}}),/target language/);
});
