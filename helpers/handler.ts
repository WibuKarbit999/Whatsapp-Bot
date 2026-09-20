// src/handler.ts
import { mkdir, readdir } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as Func from './func.js';
import { db, groups, users } from './store.js';

const { smsg, getSender, getGroupMetadata } = Func;

const PLUGIN_DIR = './plugins';

/*!====[ Tipe plugin ]====!*/
// Syarat: true = wajib, selain itu (false / tidak ditulis) = bebas.
export interface Plugin {
  cmd?: string | string[]; // plugin command: nama + alias
  on?: string; // plugin event: 'message', atau nama event lain lewat runEvent()
  tag?: string;
  listmenu?: string | string[] | boolean;
  desc?: string;
  isOwner?: boolean;
  isGroup?: boolean;
  isPrivate?: boolean;
  isAdmin?: boolean;
  isBotAdmin?: boolean;
  isQuoted?: boolean;
  run(ctx: any): unknown; // event 'message': kembalikan true = pesan sudah ditangani, berhenti
  file?: string;
}

/*!====[ Pengaturan & prefix ]====!*/
// Disimpan di tools/db/settings.json. Bisa diubah saat bot jalan (misal lewat command
// setprefix) dan langsung dipakai tanpa restart. `prefix` berupa regex, tanpa ^.
const settings = db('settings', { prefix: '[.!#/]', owners: [] as string[] });

let prefixSrc = '';
let prefixRe = /^(?:[.!#/])/i;
const getPrefix = () => {
  const src = settings.data.prefix;
  if (src !== prefixSrc) {
    prefixSrc = src;
    try {
      prefixRe = new RegExp(`^(?:${src})`, 'i');
    } catch {
      console.error(`[handler] regex prefix tidak valid: ${src} (pakai yang sebelumnya)`);
    }
  }
  return prefixRe;
};

/*!====[ Loader plugin ]====!*/
let byFile = new Map<string, Plugin[]>();
let commands = new Map<string, Plugin>();
let events = new Map<string, Plugin[]>();

const walk = async (dir: string): Promise<string[]> => {
  const out: string[] = [];
  const items = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of items) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(js|mjs|ts)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
};

const valid = (p: any): p is Plugin =>
  !!p &&
  typeof p.run === 'function' &&
  (p.on
    ? typeof p.on === 'string'
    : typeof p.cmd === 'string' || (Array.isArray(p.cmd) && p.cmd.length > 0 && p.cmd.every((c: any) => typeof c === 'string')));

const rebuild = () => {
  const cmds = new Map<string, Plugin>();
  const evs = new Map<string, Plugin[]>();
  for (const list of byFile.values()) {
    for (const p of list) {
      if (p.on) {
        const arr = evs.get(p.on) ?? [];
        arr.push(p);
        evs.set(p.on, arr);
        continue;
      }
      for (const c of ([] as string[]).concat(p.cmd as string | string[])) {
        const key = c.toLowerCase();
        if (cmds.has(key)) console.warn(`[handler] cmd "${key}" bentrok: ${cmds.get(key)!.file} dan ${p.file}`);
        cmds.set(key, p);
      }
    }
  }
  commands = cmds; // ditukar sekaligus, tidak ada momen kosong saat reload
  events = evs;
};

// Muat ulang semua plugin. File yang error tidak mematikan yang lain,
// dan kalau file itu sebelumnya sudah jalan, versi lamanya tetap dipakai.
export async function loadPlugins(dir = PLUGIN_DIR) {
  await mkdir(dir, { recursive: true });
  const next = new Map<string, Plugin[]>();
  let failed = 0;

  for (const file of await walk(dir)) {
    try {
      const url = pathToFileURL(resolve(file)).href + `?t=${Date.now()}`; // ?t= supaya tidak kena cache
      const mod = await import(url);
      const list = ([] as any[]).concat(mod.default ?? []);
      const good = list.filter(valid);
      if (!good.length || good.length !== list.length) throw new Error('bentuk plugin tidak valid (butuh cmd atau on, dan run)');
      good.forEach((p) => (p.file = file));
      next.set(file, good);
    } catch (e: any) {
      failed++;
      console.error(`[handler] gagal memuat ${file}: ${e.message}`);
      const old = byFile.get(file);
      if (old) next.set(file, old);
    }
  }

  byFile = next;
  rebuild();
  const nEvents = [...events.values()].flat().length;
  console.log(`[handler] ${commands.size} command, ${nEvents} event, dari ${next.size} file${failed ? `, ${failed} gagal` : ''}`);
}

let loading: Promise<void> = Promise.resolve();
export const reloadPlugins = () => (loading = loading.then(() => loadPlugins()));

// Reload otomatis saat file di folder plugins berubah
export function watchPlugins(dir = PLUGIN_DIR) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    watch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => reloadPlugins(), 500);
    });
  } catch (e: any) {
    console.warn('[handler] hot reload otomatis tidak aktif:', e.message);
  }
}

export async function startHandler({ hot = true } = {}) {
  await loadPlugins();
  if (hot) watchPlugins();
}

// Daftar plugin command (tanpa duplikat alias), untuk membuat menu
export const getCommands = () => [...new Set(commands.values())];

/*!====[ Status pengirim (is) ]====!*/
const num = (jid?: string) => (jid || '').split('@')[0].split(':')[0];
const failedMeta = new Map<string, number>(); // grup yang gagal diambil, coba lagi setelah 60 detik

const buildIs = async (Bit: any, cht: any) => {
  const sender = getSender(cht.sender, { cht });
  const is = {
    sender, // jid nomor pengirim
    owner: !!cht.fromMe || settings.data.owners.map(String).includes(num(sender)),
    group: !!cht.isGroup,
    private: !cht.isGroup,
    quoted: !!cht.quoted,
    admin: false,
    botAdmin: false,
  };

  if (cht.isGroup) {
    let meta: any = null;
    if ((failedMeta.get(cht.chat) ?? 0) < Date.now()) {
      meta = await getGroupMetadata(Bit, cht.chat); // dari cache, jarang ke server
      if (!meta) failedMeta.set(cht.chat, Date.now() + 60_000);
    }
    const admins: any[] = (meta?.members ?? []).filter((m: any) => m.admin);
    const isAdm = (...jids: (string | undefined)[]) =>
      admins.some((m) => jids.some((j) => j && (num(j) === num(m.id) || num(j) === num(m.lid))));
    is.admin = isAdm(sender, cht.sender);
    is.botAdmin = isAdm(Bit.user?.id, Bit.user?.lid);
  }
  return is;
};

/*!====[ Syarat plugin ]====!*/
type Is = Awaited<ReturnType<typeof buildIs>>;
const GUARDS: [keyof Plugin, (is: Is) => boolean, string][] = [
  ['isOwner', (is) => is.owner, 'Perintah ini khusus owner.'],
  ['isGroup', (is) => is.group, 'Perintah ini hanya bisa dipakai di grup.'],
  ['isPrivate', (is) => is.private, 'Perintah ini hanya bisa dipakai di chat pribadi.'],
  ['isAdmin', (is) => is.admin, 'Perintah ini khusus admin grup.'],
  ['isBotAdmin', (is) => is.botAdmin, 'Jadikan bot admin dulu supaya perintah ini bisa dipakai.'],
  ['isQuoted', (is) => is.quoted, 'Balas (reply) sebuah pesan untuk memakai perintah ini.'],
];

const failedGuard = (p: Plugin, is: Is) => GUARDS.find(([flag, ok]) => p[flag] === true && !ok(is))?.[2];

// Jalankan satu plugin. Plugin command yang gagal syarat dibalas, plugin event dilewati diam-diam.
const exec = async (p: Plugin, ctx: any, isCmd: boolean): Promise<boolean> => {
  const fail = failedGuard(p, ctx.is);
  if (fail) {
    if (isCmd) await ctx.cht.reply(fail).catch(() => {});
    return false;
  }
  try {
    return (await p.run(ctx)) === true;
  } catch (e) {
    console.error(`[plugin ${p.file}]`, e);
    if (isCmd) await ctx.cht.reply('Terjadi kesalahan saat menjalankan perintah.').catch(() => {});
    return false;
  }
};

/*!====[ Pesan masuk ]====!*/
// Panggil dari messages.upsert (hanya type === 'notify')
export async function handleMessage(Bit: any, raw: any) {
  const cht = smsg(Bit, raw);
  if (!cht?.message || !cht.chat || cht.chat === 'status@broadcast') return;
  if (cht.mtype === 'protocolMessage' || cht.mtype === 'senderKeyDistributionMessage') return;

  // Baca command: prefix (regex) + nama + sisanya
  let plugin: Plugin | undefined;
  const m = cht.text.match(getPrefix());
  if (m) {
    const body = cht.text.slice(m[0].length).trim();
    const first = body.split(/\s+/)[0] ?? '';
    plugin = commands.get(first.toLowerCase());
    if (plugin) {
      cht.prefix = m[0];
      cht.cmd = first.toLowerCase();
      cht.q = body.slice(first.length).trim();
      cht.args = cht.q ? cht.q.split(/\s+/) : [];
    }
  }

  const evs = events.get('message') ?? [];
  if (!plugin && !evs.length) return;

  const is = await buildIs(Bit, cht);
  const ctx = {
    Bit, cht, is,
    cmd: cht.cmd ?? '', prefix: cht.prefix ?? '', q: cht.q ?? '', args: cht.args ?? [],
    Func, users, groups, db,
  };

  for (const ev of evs) if (await exec(ev, ctx, false)) return;
  if (!plugin) return;

  // User yang di-ban dan grup yang di-mute (owner selalu lolos, admin lolos di grup mute)
  if (!is.owner) {
    if (users.get(is.sender).banned) return;
    if (cht.isGroup && groups.get(cht.chat).mute && !is.admin) return;
  }

  await exec(plugin, ctx, true);
}

// Untuk event selain pesan, misal dari index.ts:
// Bit.ev.on('group-participants.update', (event) => runEvent('group.participants', { Bit, event }))
export async function runEvent(name: string, data: Record<string, any> = {}) {
  for (const p of events.get(name) ?? []) {
    try {
      await p.run({ ...data, Func, users, groups, db });
    } catch (e) {
      console.error(`[plugin ${p.file}]`, e);
    }
  }
}
