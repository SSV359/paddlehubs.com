/**
 * Extracts a handful of still frames from a local video file, entirely
 * in the browser, using the <video> + <canvas> APIs. This is what makes
 * AI commentary possible without any server-side video processing —
 * Lambda has no video decoding tooling built in, and setting one up
 * (FFmpeg via a Lambda Layer) is real infrastructure work. Grabbing a
 * few JPEG stills client-side and sending those to a vision-capable AI
 * model sidesteps that completely.
 */
export async function extractVideoFrames(file: File, count = 4): Promise<string[]> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Could not read video file.'));
  });

  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(video.src);
    throw new Error('Could not determine video length.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.min(640, video.videoWidth || 640);
  canvas.height = Math.round(canvas.width * ((video.videoHeight || 360) / (video.videoWidth || 640)));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(video.src);
    throw new Error('Could not process video frames.');
  }

  const frames: string[] = [];
  // Evenly spaced timestamps, skipping the very first/last instant
  // (often black or mid-transition).
  const timestamps = Array.from({ length: count }, (_, i) => (duration * (i + 1)) / (count + 1));

  for (const t of timestamps) {
    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = t;
      setTimeout(() => reject(new Error('Frame extraction timed out.')), 5000);
    }).catch(() => {}); // if one frame times out, just skip it rather than failing the whole video

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.7));
    } catch {
      // Cross-origin or decode error on this frame — skip it.
    }
  }

  URL.revokeObjectURL(video.src);
  return frames;
}
