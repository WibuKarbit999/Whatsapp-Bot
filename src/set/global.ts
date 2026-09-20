// src/set/global.ts
// Isi hanya hal yang tidak berubah saat bot jalan. Yang bisa diubah lewat command
// (prefix, owner, mode public, dll) ada di tools/db/settings.json, bukan di sini.
export {}; // supaya `declare global` di bawah berlaku

declare global {
  var Folder: Record<number, string>;
  var session: string; // folder sesi login WhatsApp
  var pairingCode: boolean; // true = login pakai pairing code, false = QR
  var debug: boolean; // true = tampilkan log detail
}

global.Folder = {
  0: './src/',
  3: './tools/db/',
  4: './tools/db/user/',
  5: './connection/',
};
global.session = Folder[5] + 'session';

// Bisa diubah dari tab Startup panel (Variables) tanpa mengedit file
global.pairingCode = process.env.PAIRING_CODE !== 'false';
global.debug = process.env.DEBUG === 'true';
