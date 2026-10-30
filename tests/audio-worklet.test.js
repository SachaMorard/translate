import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function processor() {
  let Processor; const events=[];
  const context=vm.createContext({AudioWorkletProcessor:class {constructor(){this.port={postMessage:event=>events.push(event)};}},
    registerProcessor:(_name,Class)=>{Processor=Class;}});
  vm.runInContext(fs.readFileSync(new URL('../audio-worklet.js',import.meta.url),'utf8'),context);
  return {node:new Processor(),events};
}
function feed(node,value,seconds) {
  const data = new Float32Array(128).fill(value);
  for(let i=0;i<Math.ceil(seconds*24000/128);i++) node.process([[data]]);
}
test('silence is not sent; speech is PCM16 with a pause commit and bounded turns',()=>{
  const {node,events}=processor(); feed(node,0,2);
  assert.ok(!events.some(e=>e.pcm));
  feed(node,0.1,1); feed(node,0,1);
  assert.equal(events.filter(e=>e.commit).length,1);
  assert.ok(events.filter(e=>e.pcm).every(e=>e.pcm.length===4800));
  feed(node,0.1,11);
  assert.ok(events.filter(e=>e.commit).length>=3);
  node.port.onmessage({data:'flush'});
  assert.ok(events.at(-1).flushed);
  assert.equal(node.process([]),false);
});
test('commits a pause at 400 ms and continuous speech at 5 s without dropping quiet syllables',()=>{
  const {node,events}=processor();
  node.packet(new Array(2400).fill(0.1));
  for(let i=0;i<3;i++) node.packet(new Array(2400).fill(0));
  assert.equal(events.filter(e=>e.commit).length,0);
  node.packet(new Array(2400).fill(0));
  assert.equal(events.filter(e=>e.commit).length,1);
  for(let i=0;i<50;i++) node.packet(new Array(2400).fill(0.1));
  assert.equal(events.filter(e=>e.commit).length,2);
  const packets=events.filter(e=>e.pcm).length;
  node.packet(new Array(2400).fill(0.003));
  assert.equal(events.filter(e=>e.pcm).length,packets+1);
});
