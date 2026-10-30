// getDisplayMedia can resolve before the audio track has finished initializing.
// A muted track is not the same as a silent recording: wait for unmute, bounded
// so a denied permission or unsupported capture device cannot stall forever.
export function waitForLiveAudio(stream, timeoutMs = 5000) {
  const tracks = stream.getAudioTracks();
  if (!tracks.length) return Promise.reject(new Error('No audio track was supplied by the capture device.'));
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      for (const track of tracks) {
        track.removeEventListener('unmute', check);
        track.removeEventListener('ended', check);
      }
    };
    const check = () => {
      if (tracks.some(track => track.readyState === 'live' && !track.muted)) {
        cleanup(); resolve(tracks);
      } else if (tracks.every(track => track.readyState === 'ended')) {
        cleanup(); reject(new Error('The audio track ended before capture could start.'));
      }
    };
    for (const track of tracks) {
      track.addEventListener('unmute', check);
      track.addEventListener('ended', check);
    }
    timer = setTimeout(() => {
      cleanup(); reject(new Error('The audio track stayed muted during initialization.'));
    }, timeoutMs);
    check();
  });
}
