// src/store.ts
// Struktur:
//   tools/db/user/user.json        -> semua user (kunci = jid nomor)
//   tools/db/group/<jid>@g.us.json -> satu file per grup
//   tools/db/<nama>.json           -> data fitur lain (antilink, antispam, dst.)
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = './tools/db/';

/*!====[ Dasar: satu file JSON ]====!*/
const open = new Set<Store<any>>();

export class Store<T extends object> {
  file: string;
  data: T;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(file: string, defaults: T) {
    this.file = file;
    mkdirSync(dirname(file), { recursive: true });
    this.data = { ...defaults, ...this.load() };
    open.add(this);
  }

  private load(): Partial<T> {
    if (!existsSync(this.file)) return {};
    try {
      return JSON.parse(readFileSync(this.file, 'utf-8'));
    } catch {
      renameSync(this.file, this.file + '.bak'); // file rusak: simpan cadangan, mulai baru
      return {};
    }
  }

  // Simpan tertunda (maks. sekali per 2 detik) supaya tidak menulis tiap pesan
  save() {
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 2000);
  }

  // Tulis sekarang juga. Lewat file .tmp lalu rename, jadi tidak rusak kalau mati mendadak.
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.file);
  }

  close() {
    this.flush();
    open.delete(this);
  }
}

// Pastikan data tersimpan saat bot dimatikan
const flushAll = () => open.forEach((s) => s.flush());
process.on('exit', flushAll);
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    flushAll();
    process.exit(0);
  });
}

/*!====[ User ]====!*/
// Tambah field sesuai kebutuhan. Field baru otomatis terisi untuk user lama.
export interface UserData {
  name: string;
  banned: boolean;
  [key: string]: any;
}
const userDefaults = (): UserData => ({ name: '', banned: false });

const userStore = new Store<Record<string, UserData>>(`${BASE}user/user.json`, {});

export const users = {
  // Pakai jid nomor (hasil getSender). Objek yang sama dikembalikan tiap kali.
  get(jid: string): UserData {
    const u = (userStore.data[jid] ??= {} as UserData);
    const d = userDefaults();
    for (const k in d) if (!(k in u)) u[k] = d[k];
    return u;
  },
  set(jid: string, patch: Partial<UserData>) {
    Object.assign(users.get(jid), patch);
    userStore.save();
  },
  save: () => userStore.save(),
  all: () => userStore.data,
};

/*!====[ Grup ]====!*/
export interface GroupData {
  mute: boolean;
  [key: string]: any;
}
const groupDefaults = (): GroupData => ({ mute: false });

const groupStores = new Map<string, Store<GroupData>>();
const groupStore = (jid: string) => {
  let s = groupStores.get(jid);
  if (!s) {
    s = new Store<GroupData>(`${BASE}group/${jid}.json`, groupDefaults());
    groupStores.set(jid, s);
  }
  return s;
};

export const groups = {
  // File baru dibuat saat pertama kali set() atau save()
  get: (jid: string): GroupData => groupStore(jid).data,
  set(jid: string, patch: Partial<GroupData>) {
    const s = groupStore(jid);
    Object.assign(s.data, patch);
    s.save();
    return s.data;
  },
  save: (jid: string) => groupStore(jid).save(),
  delete(jid: string) {
    const s = groupStores.get(jid);
    if (s) open.delete(s);
    groupStores.delete(jid);
    try {
      unlinkSync(`${BASE}group/${jid}.json`);
    } catch {}
  },
};

/*!====[ Fitur lain ]====!*/
// db('antilink', { groups: [] as string[] }) -> tools/db/antilink.json
const dbs = new Map<string, Store<any>>();

export const db = <T extends object>(name: string, defaults: T): Store<T> => {
  let s = dbs.get(name);
  if (!s) {
    s = new Store<T>(`${BASE}${name}.json`, defaults);
    dbs.set(name, s);
  }
  return s;
};
