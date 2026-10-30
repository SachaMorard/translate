import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForLiveAudio } from '../audio-tracks.js';
class Track extends EventTarget {
  readyState = 'live';
  constructor(muted = false) { super(); this.muted = muted; }
}
const stream = (...tracks) => ({ getAudioTracks: () => tracks });
test('accepts a ready audio track without waiting', async () => {
  const track = new Track();
  assert.deepEqual(await waitForLiveAudio(stream(track)), [track]);
});
test('waits for a temporarily muted audio track to initialize', async () => {
  const track = new Track(true);
  const ready = waitForLiveAudio(stream(track), 200);
  setTimeout(() => { track.muted = false; track.dispatchEvent(new Event('unmute')); }, 10);
  assert.deepEqual(await ready, [track]);
});
test('reports missing, ended and permanently muted tracks', async () => {
  await assert.rejects(waitForLiveAudio(stream()), /No audio track/);
  const ended = new Track(); ended.readyState = 'ended';
  await assert.rejects(waitForLiveAudio(stream(ended)), /ended/);
  await assert.rejects(waitForLiveAudio(stream(new Track(true)), 10), /stayed muted/);
});
