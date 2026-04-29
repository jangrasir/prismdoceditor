// Web Audio utilities — decode, manipulate, and encode WAV (client-side only).

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buf = await file.arrayBuffer();
  const audio = await ctx.decodeAudioData(buf.slice(0));
  // Don't close immediately — some browsers reject decode if context is closed early.
  setTimeout(() => ctx.close().catch(() => {}), 0);
  return audio;
}

export function createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  const ctx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    channels,
    Math.max(1, length),
    sampleRate
  );
  return ctx.createBuffer(channels, Math.max(1, length), sampleRate);
}

export function trimBuffer(src: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const sr = src.sampleRate;
  const start = Math.max(0, Math.floor(startSec * sr));
  const end = Math.min(src.length, Math.floor(endSec * sr));
  const len = Math.max(1, end - start);
  const out = createBuffer(src.numberOfChannels, len, sr);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const inData = src.getChannelData(c).subarray(start, end);
    out.getChannelData(c).set(inData);
  }
  return out;
}

export function mergeBuffers(buffers: AudioBuffer[]): AudioBuffer {
  if (buffers.length === 0) throw new Error("No buffers");
  const sr = buffers[0].sampleRate;
  const channels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const total = buffers.reduce((s, b) => s + b.length, 0);
  const out = createBuffer(channels, total, sr);
  let offset = 0;
  for (const b of buffers) {
    for (let c = 0; c < channels; c++) {
      const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1));
      out.getChannelData(c).set(src, offset);
    }
    offset += b.length;
  }
  return out;
}

export function applyGain(src: AudioBuffer, gain: number): AudioBuffer {
  const out = createBuffer(src.numberOfChannels, src.length, src.sampleRate);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const inData = src.getChannelData(c);
    const outData = out.getChannelData(c);
    for (let i = 0; i < inData.length; i++) outData[i] = inData[i] * gain;
  }
  return out;
}

export function applyFades(src: AudioBuffer, fadeInSec: number, fadeOutSec: number): AudioBuffer {
  const sr = src.sampleRate;
  const fi = Math.min(src.length, Math.max(0, Math.floor(fadeInSec * sr)));
  const fo = Math.min(src.length, Math.max(0, Math.floor(fadeOutSec * sr)));
  const out = createBuffer(src.numberOfChannels, src.length, sr);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const inData = src.getChannelData(c);
    const outData = out.getChannelData(c);
    outData.set(inData);
    for (let i = 0; i < fi; i++) outData[i] *= i / fi;
    for (let i = 0; i < fo; i++) {
      const idx = src.length - 1 - i;
      outData[idx] *= i / fo;
    }
  }
  return out;
}

export function normalizeBuffer(src: AudioBuffer, targetPeak = 0.99): AudioBuffer {
  let peak = 0;
  for (let c = 0; c < src.numberOfChannels; c++) {
    const d = src.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
    }
  }
  if (peak === 0) return src;
  return applyGain(src, targetPeak / peak);
}

// Encode AudioBuffer → WAV (PCM 16-bit) Blob
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length * numCh * 2 + 44;
  const ab = new ArrayBuffer(len);
  const view = new DataView(ab);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  let p = 0;
  writeStr(p, "RIFF"); p += 4;
  view.setUint32(p, len - 8, true); p += 4;
  writeStr(p, "WAVE"); p += 4;
  writeStr(p, "fmt "); p += 4;
  view.setUint32(p, 16, true); p += 4;
  view.setUint16(p, 1, true); p += 2; // PCM
  view.setUint16(p, numCh, true); p += 2;
  view.setUint32(p, sr, true); p += 4;
  view.setUint32(p, sr * numCh * 2, true); p += 4;
  view.setUint16(p, numCh * 2, true); p += 2;
  view.setUint16(p, 16, true); p += 2;
  writeStr(p, "data"); p += 4;
  view.setUint32(p, buffer.length * numCh * 2, true); p += 4;

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  let offset = p;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

export function formatTime(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
