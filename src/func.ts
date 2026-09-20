// src/func.ts
import {
  jidNormalizedUser,
  getContentType,
  areJidsSameUser,
  getBinaryNodeChild,
  getBinaryNodeChildren,
} from '@whiskeysockets/baileys';
import fsp from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import axios, { type AxiosRequestConfig } from 'axios';
import moment from 'moment-timezone';
import { sizeFormatter } from 'human-readable';

/*!====[ Umum ]====!*/
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const exists = (p: string) =>
  fsp.access(p).then(
    () => true,
    () => false
  );

/*!====[ Waktu ]====!*/
export const unixTimestampSeconds = (date = new Date()) => Math.floor(date.getTime() / 1000);

export const generateMessageTag = (epoch?: number) => {
  let tag = unixTimestampSeconds().toString();
  if (epoch) tag += '.--' + epoch;
  return tag;
};

// Selisih (detik) antara `now` (ms) dan timestamp pesan (detik)
export const processTime = (timestamp: number, now: number = Date.now()) =>
  (Number(now) - timestamp * 1000) / 1000;

export const getTime = (format: string, date?: moment.MomentInput) =>
  date
    ? moment(date).locale('id').format(format)
    : moment.tz('Asia/Jakarta').locale('id').format(format);

export const dateFormatter = (ts: number = Date.now(), zone = 'Asia/Jakarta') =>
  new Date(ts).toLocaleString('id-ID', { timeZone: zone });

// Contoh: 95000 -> "1 menit 35 detik"
export const duration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} menit ${s % 60} detik` : `${s} detik`;
};

export const runtime = (seconds: number | string) => {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d) parts.push(`*${d}d*`);
  if (h) parts.push(`*${h}h*`);
  if (m) parts.push(`*${m}m*`);
  if (s) parts.push(`*${s}s*`);

  return parts.join(' ') || '*0s*';
};

export const tanggal = (numer: number | string | Date) => {
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
  const tgl = new Date(numer);
  return `${hari[tgl.getDay()]}, ${tgl.getDate()} - ${bulan[tgl.getMonth()]} - ${tgl.getFullYear()}`;
};

// "1 jam 30 menit" / "2d" / "5 menit" -> milidetik, null kalau tidak valid
const timeUnits: Record<string, number> = {
  s: 1000, second: 1000, seconds: 1000, detik: 1000,
  m: 60000, minute: 60000, minutes: 60000, menit: 60000,
  h: 3600000, hour: 3600000, hours: 3600000, jam: 3600000,
  d: 86400000, day: 86400000, days: 86400000, hari: 86400000,
  w: 604800000, week: 604800000, weeks: 604800000, minggu: 604800000,
  mo: 2592000000, month: 2592000000, months: 2592000000, bulan: 2592000000,
  y: 31536000000, year: 31536000000, years: 31536000000, tahun: 31536000000,
};
// Urut dari yang terpanjang supaya "mo" tidak terbaca "m", dan "menit" tidak terbaca "m"
const unitPattern = Object.keys(timeUnits)
  .sort((a, b) => b.length - a.length)
  .join('|');

export const parseTimeString = (str: string): number | null => {
  const regex = new RegExp(`(\\d+)\\s*(${unitPattern})`, 'gi');
  let total = 0;
  let found = false;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(str)) !== null) {
    found = true;
    total += parseInt(m[1], 10) * timeUnits[m[2].toLowerCase()];
  }
  return found && total > 0 ? total : null;
};

/*!====[ Request ]====!*/
// Native https/http (tanpa axios), ikut redirect
export const getBuffer = (url: string, options: http.RequestOptions = {}, maxRedirects = 5): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const client: typeof http = url.startsWith('https') ? (https as unknown as typeof http) : http;
    client
      .get(url, options, (res) => {
        const { statusCode = 0, headers } = res;

        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          if (maxRedirects === 0) return reject(new Error('Too many redirects'));
          return resolve(getBuffer(new URL(headers.location, url).toString(), options, maxRedirects - 1));
        }
        if (statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP status ${statusCode}`));
        }

        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });

export const fetchJson = async <T = any>(url: string, options: AxiosRequestConfig = {}): Promise<T> => {
  const res = await axios({ method: 'GET', url, ...options });
  return res.data;
};

/*!====[ Teks ]====!*/
export const getRandom = (ext: string) => `${Math.floor(Math.random() * 10000)}${ext}`;

export const formatp = sizeFormatter({
  std: 'JEDEC',
  decimalPlaces: 2,
  keepTrailingZeroes: false,
  render: (literal: string, symbol: string) => `${literal} ${symbol}B`,
});

export const parseMention = (text = '') =>
  [...text.matchAll(/@([0-9]{5,16})/g)].map((v) => v[1] + '@s.whatsapp.net');

export const isUrl = (url: string) =>
  url.match(
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi
  );

// Kemiripan dua teks (0 - 1), dipakai untuk saran "maksudmu ..."
export const compareTwoStrings = (a: string, b: string) => {
  a = a.replace(/\s+/g, '');
  b = b.replace(/\s+/g, '');
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.substring(i, i + 2);
    bigrams.set(g, (bigrams.get(g) ?? 0) + 1);
  }

  let hit = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.substring(i, i + 2);
    const n = bigrams.get(g) ?? 0;
    if (n > 0) {
      bigrams.set(g, n - 1);
      hit++;
    }
  }
  return (2 * hit) / (a.length + b.length - 2);
};

export const findBestMatch = (main: string, targets: string[]) => {
  if (!targets.length) throw new Error('targets tidak boleh kosong');
  const ratings = targets.map((target) => ({ target, rating: compareTwoStrings(main, target) }));
  const bestMatchIndex = ratings.reduce((best, r, i) => (r.rating > ratings[best].rating ? i : best), 0);
  return { ratings, bestMatch: ratings[bestMatchIndex], bestMatchIndex };
};

/*!====[ Media ]====!*/
// Perkecil gambar lewat ffmpeg (perlu ffmpeg terpasang). Cocok sebelum dikirim ke AI.
export const minimizeImage = (input: Buffer, { width = 1024, quality = 3 } = {}): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const args = ['-loglevel', 'error', '-i', 'pipe:0', '-vf', `scale='min(${width},iw)':-2`, '-q:v', String(quality), '-f', 'image2', 'pipe:1'];
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];

    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.stderr.on('data', (d: Buffer) => process.stderr.write(d));
    ff.on('close', (code) =>
      code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`FFmpeg exited with code ${code}`))
    );
    ff.on('error', reject);
    ff.stdin.on('error', () => {});
    ff.stdin.end(input);
  });

/*!====[ Metadata grup ]====!*/
// Disimpan di memori dan disk. get() mengembalikan metadata mentah,
// jadi bisa langsung dipakai: cachedGroupMetadata: async (jid) => metadata.get(jid)
const groupDir = './tools/db/groups/';
mkdirSync(groupDir, { recursive: true });
const memCache = new Map<string, any>();

export const metadata = {
  has: (id: string) => memCache.has(id) || existsSync(groupDir + id + '.json'),

  get: (id: string): any => {
    if (memCache.has(id)) return memCache.get(id);
    const file = groupDir + id + '.json';
    if (!existsSync(file)) return undefined;
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      memCache.set(id, data);
      return data;
    } catch {
      unlinkSync(file); // file rusak, buang
      return undefined;
    }
  },

  set: (id: string, data: any) => {
    memCache.set(id, data);
    writeFileSync(groupDir + id + '.json', JSON.stringify(data));
  },

  delete: (id: string) => {
    memCache.delete(id);
    try {
      unlinkSync(groupDir + id + '.json');
    } catch {}
  },
};

/*!====[ LID <-> nomor ]====!*/
const lidToPn = new Map<string, string>(); // user LID -> jid nomor
const pnToLid = new Map<string, string>(); // user nomor -> jid LID
const userOf = (jid?: string) => (jid || '').split('@')[0].split(':')[0];

// "123:5@s.whatsapp.net" -> "123@s.whatsapp.net"
export const normalizeSender = (jid: string) => {
  if (!jid?.includes('@')) return jid;
  const [user, server] = jid.split('@');
  return `${user.split(':')[0]}@${server}`;
};

type LidPair = { lid?: string; id?: string };

// Simpan pasangan LID <-> nomor. Yang tidak lengkap dilewati.
export const addLid = (items: LidPair | LidPair[]) => {
  let added = 0;
  for (const { lid, id } of Array.isArray(items) ? items : [items]) {
    if (!lid?.endsWith('@lid') || !id?.endsWith('@s.whatsapp.net')) continue;
    if (lidToPn.get(userOf(lid)) === normalizeSender(id)) continue;
    lidToPn.set(userOf(lid), normalizeSender(id));
    pnToLid.set(userOf(id), normalizeSender(lid));
    added++;
  }
  return added;
};

// Ubah jid apa pun jadi nomor (default) atau LID (lid = true)
export const getSender = (jid: string, { cht, lid = false }: { cht?: any; lid?: boolean } = {}): string => {
  if (!jid || !jid.includes('@')) return jid;
  const user = userOf(jid);
  const isLid = jid.endsWith('@lid');
  const key = cht?.key ?? {};
  const alt: string | undefined = key.remoteJidAlt || key.participantAlt;
  const fromCht = [key.participant, key.participantAlt, key.remoteJid, key.remoteJidAlt].some((j) => userOf(j) === user);

  // Pesan itu sendiri membawa pasangan LID <-> nomor
  if (alt && fromCht) addLid(isLid ? { lid: jid, id: alt } : { lid: alt, id: jid });

  if (isLid) return lid ? normalizeSender(jid) : (lidToPn.get(user) ?? normalizeSender(jid));
  return lid ? (pnToLid.get(user) ?? normalizeSender(jid)) : normalizeSender(jid);
};

// Admin dari daftar member. Untuk grup pakai: getGroupAdmins(meta.members)
export const getGroupAdmins = (participants: any[] = []) =>
  participants.filter((p) => p.admin).map((p) => p.id);

// Ambil metadata grup. Kalau sudah ada di cache langsung dipakai, kecuali update = true.
// meta.participants dibiarkan asli (dipakai Baileys), sedangkan meta.members
// berisi { id: nomor, lid, admin } yang sudah dinormalkan untuk cek admin.
export const getGroupMetadata = async (Bit: any, jid: string, update = false): Promise<any> => {
  if (!jid?.endsWith('@g.us')) return null;
  const cached = metadata.get(jid);
  if (cached && !update) return cached;

  let meta: any;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      meta = await Bit.groupMetadata(jid);
      break;
    } catch (e) {
      console.error(`getGroupMetadata: percobaan ${attempt} gagal`, e);
      if (attempt === 2) return cached ?? null;
      await sleep(5000);
    }
  }
  if (!meta) return cached ?? null;

  let members = (meta.participants as any[]).map((p) => ({
    id: p.phoneNumber || p.id,
    lid: p.lid || (p.id?.endsWith('@lid') ? p.id : undefined),
    admin: p.admin ?? null,
  }));

  // Grup mode LID dan nomor belum ketemu: minta daftar lengkap ke server
  if (meta.addressingMode === 'lid' && members.some((m) => !m.id?.endsWith('@s.whatsapp.net'))) {
    try {
      const res = await Bit.query({
        tag: 'iq',
        attrs: { type: 'get', xmlns: 'w:g2', to: jid },
        content: [{ tag: 'query', attrs: { request: 'interactive' } }],
      });
      const group = getBinaryNodeChild(res, 'group');
      if (group) {
        members = getBinaryNodeChildren(group, 'participant').map(({ attrs }) => ({
          id: attrs.phone_number,
          lid: attrs.lid || attrs.jid,
          admin: attrs.type || null,
        }));
      }
    } catch (e) {
      console.error('getGroupMetadata: gagal ambil daftar LID', e);
    }
  }

  meta.members = members;
  addLid(members);
  metadata.set(jid, meta);
  return meta;
};

// Perbarui metadata lewat antrean (satu per satu, jeda 3 detik) supaya tidak kena limit.
// Panggil dari event groups.update dan group-participants.update.
const pendingMeta = new Set<string>();
let metaChain: Promise<void> = Promise.resolve();

export const queueMetadata = (Bit: any, jid: string) => {
  if (pendingMeta.has(jid)) return;
  pendingMeta.add(jid);
  metaChain = metaChain.then(async () => {
    await sleep(3000);
    await getGroupMetadata(Bit, jid, true).catch(() => {});
    pendingMeta.delete(jid);
  });
};

// Target mention: mentionedJid, lalu angka @nomor di teks, lalu pengirim pesan yang di-reply
export const getMentions = (cht: any, lid = false): string[] => {
  const ctx = cht?.msg?.contextInfo ?? {};
  const text: string = cht?.q ?? cht?.text ?? '';
  const fromText = parseMention(text).filter((j) => {
    const n = userOf(j).length;
    return n > 5 && n <= 15;
  });
  const quotedUser = ctx.participantPn || ctx.participant;

  const jids: string[] = ctx.mentionedJid?.length
    ? ctx.mentionedJid
    : fromText.length
      ? fromText
      : quotedUser
        ? [quotedUser]
        : [];

  return jids.map((j) => getSender(j, { cht, lid }));
};

/*!====[ Serializer pesan (cht) ]====!*/
// Bit = socket Baileys, cht = pesan mentah dari messages.upsert
// Catatan: cht.id = ID pesan, cht.chat = JID chat
export const smsg = (Bit: any, cht: any): any => {
  if (!cht) return cht;

  const decode = (jid?: string) => Bit.decodeJid?.(jid) || jidNormalizedUser(jid || '');

  if (cht.key) {
    cht.id = cht.key.id;
    cht.chat = cht.key.remoteJid;
    cht.fromMe = cht.key.fromMe;
    cht.isGroup = cht.chat.endsWith('@g.us');
    cht.sender = decode(cht.fromMe ? Bit.user?.id : cht.key.participant || cht.chat);
    if (cht.isGroup) cht.participant = decode(cht.key.participant);
  }

  if (cht.message) {
    cht.mtype = getContentType(cht.message);
    cht.msg = cht.message[cht.mtype];
    cht.text = cht.msg?.text || cht.msg?.caption || cht.message.conversation || '';

    const quoted = cht.msg?.contextInfo?.quotedMessage;
    if (quoted) {
      const type = getContentType(quoted)!;
      const content = (quoted as any)[type];

      cht.quoted = content && typeof content === 'object' ? content : { [type]: content };
      cht.quoted.mtype = type;
      cht.quoted.msg = content;
      cht.quoted.key = {
        remoteJid: cht.chat,
        fromMe: areJidsSameUser(decode(cht.msg.contextInfo.participant), decode(Bit.user?.id)),
        id: cht.msg.contextInfo.stanzaId,
        participant: decode(cht.msg.contextInfo.participant),
      };
      cht.quoted.sender = decode(cht.msg.contextInfo.participant);
      cht.quoted.text = cht.quoted.text || cht.quoted.caption || cht.quoted.conversation || '';
    }
  }

  cht.reply = (text: string, chatId: string = cht.chat, options: any = {}) =>
    Bit.sendMessage(chatId, { text }, { quoted: cht, ...options });

  cht.react = (emoji: string) =>
    Bit.sendMessage(cht.chat, { react: { text: emoji, key: cht.key } });

  return cht;
};
