import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Pakai binary dari paket `ffmpeg-static` kalau terpasang (cocok untuk panel tanpa root),
// kalau tidak, pakai `ffmpeg` bawaan sistem.
const pkg = 'ffmpeg-static';
const staticPath: string | null = await import(pkg)
  .then((m: any) => m.default ?? m)
  .catch(() => null);

export const FFMPEG: string = staticPath || 'ffmpeg';

/*!====[ Inti ]====!*/
const run = (args: string[], timeout = 120_000) =>
  new Promise<void>((resolve, reject) => {
    const p = spawn(FFMPEG, args);
    let err = '';
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error('ffmpeg timeout'));
    }, timeout);

    p.stderr.on('data', (d: Buffer) => (err += d));
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(e); // biasanya ENOENT: ffmpeg tidak ditemukan
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-500)}`));
    });
  });

// Jalankan ffmpeg pada Buffer, hasilnya Buffer. `ext` menentukan format output.
export async function ffmpeg(input: Buffer, args: string[], ext: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'ff-'));
  const inFile = join(dir, 'in.bin'); // format dikenali dari isinya, bukan dari nama
  const outFile = join(dir, `out.${ext}`);
  try {
    await writeFile(inFile, input);
    await run(['-y', '-loglevel', 'error', '-i', inFile, ...args, outFile]);
    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/*!====[ Audio ]====!*/
// Audio/video apa pun -> mp3
export const toMp3 = (input: Buffer) =>
  ffmpeg(input, ['-vn', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2'], 'mp3');

// Audio/video apa pun -> voice note WhatsApp (ogg opus)
// Kirim dengan: { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true }
export const toOpus = (input: Buffer) =>
  ffmpeg(input, ['-vn', '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '1'], 'ogg');

/*!====[ Stiker ]====!*/
// Gambar/video/gif -> webp 512x512 (transparan di sisi kosong).
// animated = true untuk video/gif (maks. 8 detik, 15 fps).
// Metadata pack/author perlu ditambah terpisah (exif).
export const toWebp = (input: Buffer, { animated = false, quality = animated ? 40 : 70 } = {}) => {
  const fit = 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';
  const args = animated
    ? ['-t', '8', '-vf', `fps=15,${fit}`, '-an', '-c:v', 'libwebp', '-loop', '0', '-q:v', String(quality), '-compression_level', '6']
    : ['-frames:v', '1', '-vf', fit, '-an', '-c:v', 'libwebp', '-q:v', String(quality), '-compression_level', '6'];
  return ffmpeg(input, args, 'webp');
};

/*!====[ Gambar ]====!*/
// Perkecil gambar (lebar maks. `width`) jadi JPEG. Cocok sebelum dikirim ke AI.
export const minimizeImage = (input: Buffer, { width = 1024, quality = 3 } = {}) =>
  ffmpeg(input, ['-frames:v', '1', '-vf', `scale='min(${width},iw)':-2`, '-q:v', String(quality)], 'jpg');
