import { jidNormalizedUser, getContentType, areJidsSameUser } from '@whiskeysockets/baileys';
import fs from 'node:fs/promises';
import axios, { type AxiosRequestConfig } from 'axios';
import moment from 'moment-timezone';
import { sizeFormatter } from 'human-readable';

/*!====[ Umum ]====!*/
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const exists = (p: string) =>
  fs.access(p).then(
    () => true,
    () => false
  );

// Cache metadata grup, dipakai di `cachedGroupMetadata` pada makeWASocket
export const metadata = new Map<string, any>();

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

/*!====[ Request ]====!*/
export const getBuffer = async (url: string, options: AxiosRequestConfig = {}): Promise<Buffer> => {
  const res = await axios({
    method: 'get',
    url,
    headers: { DNT: 1, 'Upgrade-Insecure-Request': 1 },
    ...options,
    responseType: 'arraybuffer',
  });
  return res.data;
};

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

export const getGroupAdmins = (participants: any[] = []) =>
  participants.filter((p) => p.admin).map((p) => p.id);

export const isUrl = (url: string) =>
  url.match(
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi
  );

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
