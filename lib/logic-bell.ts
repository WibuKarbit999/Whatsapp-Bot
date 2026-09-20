// src/ai.ts
// Pemanggil API termai.cc (endpoint chat/logic-bell), bentuk request/respons mengikuti Experimental-Bell.
// Riwayat obrolan disimpan di server berdasarkan `id`, jadi cukup kirim JID pengirim.

const URL_API = 'https://api.termai.cc';
const KEY = process.env.TERMAI_KEY ?? 'Bell409';

// Perintah yang boleh dipanggil AI. Kalau AI memutuskan memakainya, `output` muncul di respons.
export interface AiCommand {
  description: string; // kapan perintah ini dipakai
  output: { cmd: string; msg?: string; cfg?: Record<string, any> }; // cfg = isian argumen untuk AI
}

export interface AiBody {
  text: string;
  id: string; // JID pengirim
  fullainame?: string; // nama lengkap bot
  nickainame?: string; // nama panggilan bot
  senderName?: string; // pushName pengirim
  ownerName?: string;
  date?: string;
  role?: string; // status hubungan dengan user (Pacar, Soulmate, dst.)
  chatCount?: number;
  msgtype?: string; // tipe pesan (conversation, imageMessage, dst.)
  custom_profile?: string; // kepribadian / logic bot
  image?: Buffer | false; // gambar yang sudah diperkecil (lihat minimizeImage)
  video?: string | false; // video dalam base64
  skills?: string[]; // misal ['sticker']
  commands?: AiCommand[];
}

export interface AiData {
  msg?: string; // balasan teks
  cmd?: string | null; // perintah yang dipilih AI (salah satu dari `commands`)
  cfg?: Record<string, any> | null; // isian argumen untuk cmd
  stickerQuery?: string | null; // kata kunci stiker yang ingin dikirim
  deskripsiMedia?: string | null; // deskripsi gambar/video yang dikirim user
  energy?: string | number | null; // '+7' / '-3', poin yang ditambah/dikurangi
  newRole?: string | null; // status hubungan baru
}

export interface AiResult {
  data?: AiData;
}

// Nilai kosong dari API kadang berupa string "null" / "undefined". Ini mengembalikan null untuk itu.
export const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s && !['null', 'undefined'].includes(s.toLowerCase()) ? s : null;
};

export async function ai(body: AiBody): Promise<AiResult> {
  const res = await fetch(`${URL_API}/api/chat/logic-bell?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as AiResult;
}

export async function resetAi(id: string): Promise<{ msg?: string; message?: string }> {
  const res = await fetch(`${URL_API}/api/chat/logic-bell/reset?id=${encodeURIComponent(id)}&key=${KEY}`);
  return (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
}
