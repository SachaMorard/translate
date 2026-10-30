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
test('realtime mode sends silence continuously without commits',()=>{
  const {node,events}=processor();
  feed(node,0,2); feed(node,0.1,6);
  assert.ok(events.filter(e=>e.pcm).length>=80);
  assert.ok(events.filter(e=>e.pcm).every(e=>e.pcm.length===4800));
  assert.ok(events.find(e=>e.pcm).pcm.every(byte=>byte===0));
  assert.equal(events.filter(e=>e.commit).length,0);
  node.port.onmessage({data:'flush'});
  assert.ok(events.at(-1).flushed);
  assert.equal(events.filter(e=>e.commit).length,0);
});
