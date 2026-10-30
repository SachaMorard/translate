import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveTranslator } from '../live-translator.js';
function response(parts) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ start(controller) {
    for (const part of parts) controller.enqueue(encoder.encode(part));
    controller.close();
  } }));
}
test('streams text incrementally, including frames and UTF-8 split across reads', async () => {
  const progress = [];
  const translator = new LiveTranslator({ apiKey:'test', fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model,'gpt-4.1-mini:openai'); assert.equal(body.stream,true);
    assert.match(body.messages[0].content,/Spanish and Portuguese/);
    return response(['data: {"choices":[{"delta":{"content":"Ol', 'á"}}]}\r\n\r\n',
      'data:{"choices":[{"delta":{"content":" mundo"}}]}\n\n', 'data: [DONE]']);
  } });
  assert.deepEqual(await translator.autoTranslate('Hola mundo',['es','pt'],{onProgress:text=>progress.push(text)}),{translation:'Olá mundo'});
  assert.deepEqual(progress,['Olá','Olá mundo']);
});
test('rejects incomplete, empty, failed and truncated streams', async () => {
  for (const parts of [
    ['data: {"choices":[{"delta":{"content":"Bonjour"}}]}\n'],
    ['data: [DONE]\n'],
    ['data: {"error":{"message":"Service unavailable"}}\n'],
    ['data: {"choices":[{"finish_reason":"length"}]}\n']
  ]) {
    const translator = new LiveTranslator({fetchImpl:async()=>response(parts)});
    await assert.rejects(translator.autoTranslate('Hello',['fr','en']));
  }
});
test('propagates cancellation to the HTTP request', async () => {
  const controller = new AbortController();
  const translator = new LiveTranslator({fetchImpl:async(_url,{signal})=>{
    controller.abort(); signal.throwIfAborted();
  }});
  await assert.rejects(translator.autoTranslate('Hello',['fr','en'],{signal:controller.signal}),{name:'AbortError'});
});
