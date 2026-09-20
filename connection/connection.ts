import chalk from 'chalk';
import QRCode from 'qrcode';
import { existsSync, rmSync } from 'node:fs';
import { duration } from '../src/func.js';
import { settings } from '../helpers/handler.js';

const RECONNECT_MS = 5000;

const reasonMap: Record<number, string> = {
  401: 'Logged Out (401)',
  403: 'Access Denied (403)',
  405: 'Not Acceptable (405)',
  408: 'Connection Timed Out (408)',
  411: 'Connection Closed (411)',
  428: 'Connection Replaced / Tabrakan (428)',
  440: 'Bad Session / File Sesi Rusak (440)',
  500: 'Internal Server Error (500)',
  502: 'Bad Gateway (502)',
  503: 'Service Unavailable (503)',
  515: 'Restart Required (515)',
};

// Waktu dan penyebab putus terakhir, dipakai untuk laporan saat tersambung lagi
let lastDown: { at: number; statusCode?: number } | null = null;

const removeSession = () => {
  try {
    if (existsSync(session)) rmSync(session, { recursive: true, force: true });
  } catch {}
};

export const Connecting = async ({ Bit, update, launch }: { Bit: any; update: any; launch: () => unknown }) => {
  const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;

  if (receivedPendingNotifications && !Bit.authState?.creds?.myAppStateKeyId) {
    console.log('mendorong paksa');
    Bit.ev.flush?.();
  }

  if (connection) console.log(chalk.blue.bold(' CONNECTION ') + '=> ' + chalk.cyan.bold(connection));

  // QR hanya dicetak kalau login lewat QR
  if (qr && !global.pairingCode) console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));

  if (connection === 'close') {
    const error = lastDisconnect?.error;
    const statusCode: number | undefined = error?.output?.statusCode;
    console.log(chalk.red.bold('[DISCONNECT ERROR]'), error?.message ?? '');
    lastDown = { at: Date.now(), statusCode };

    const reconnect = (msg: string) => {
      console.log(`${msg}\nMenghubungkan kembali dalam ${RECONNECT_MS / 1000} detik...`);
      setTimeout(() => launch(), RECONNECT_MS);
    };

    switch (statusCode) {
      case 401:
        console.log('• [ LOGGED OUT ]\nSesi telah dikeluarkan dari Perangkat Tertaut. Menghapus sesi...');
        removeSession();
        process.exit();
      case 403:
        console.log('• [ ACCESS DENIED ]\nAkses ditolak/tutup paksa oleh server WhatsApp. Cek apakah nomor terbanned/dibatasi.');
        process.exit();
      case 428:
        console.log('• [ CONNECTION REPLACED ]\nKoneksi bertabrakan! Ada script/perangkat lain yang memakai sesi ini.');
        process.exit();
      case 440:
        console.log('• [ BAD SESSION ]\nFile sesi rusak atau tidak valid. Menghapus sesi...');
        removeSession();
        process.exit();
      case 405:
        return reconnect('• [ NOT ACCEPTABLE ]\nKoneksi ditolak server WhatsApp karena dianggap kadaluarsa.');
      case 408:
        return reconnect('• [ CONNECTION TIMEOUT ]\nWaktu tunggu habis saat merespons ping dari server.');
      case 411:
        return reconnect('• [ CONNECTION CLOSED ]\nKoneksi ditutup sepihak oleh server WhatsApp.');
      case 500:
      case 503:
        return reconnect(`• [ SERVER ISSUE ]\nServer WhatsApp bermasalah atau sibuk (Code: ${statusCode}).`);
      case 515:
        return reconnect('• [ RESTART REQUIRED ]\nServer WhatsApp meminta restart untuk sinkronisasi pesan.');
      default:
        return reconnect(`• [ UNKNOWN DISCONNECT ]\nTerputus dengan alasan tidak diketahui (Code: ${statusCode}).`);
    }
  }

  if (connection === 'open') {
    console.log('• [ TERHUBUNG ]\nBot siap digunakan');

    // Laporkan ke owner pertama kalau sempat mati lebih dari 5 detik
    if (lastDown) {
      const down = lastDown;
      lastDown = null;
      try {
        const downtimeMs = Date.now() - down.at;
        const owner = String(settings.data.owners[0] ?? '').replace(/\D/g, '');
        if (downtimeMs >= 5000 && owner) {
          const reason = reasonMap[down.statusCode ?? 0] || `Error Code: ${down.statusCode ?? 'Unknown'}`;
          const time = new Date().toLocaleTimeString('id-ID');
          await Bit.sendMessage(`${owner}@s.whatsapp.net`, {
            text:
              `⚠️ *LAPORAN PEMULIHAN KONEKSI BOT*\n\n` +
              `• *Status:* 🟢 *Tersambung Kembali*\n` +
              `• *Waktu Pulih:* ${time} WIB\n` +
              `• *Penyebab:* ${reason}\n` +
              `• *Durasi Downtime:* ${duration(downtimeMs)}`,
          });
        }
      } catch (e) {
        console.log('Gagal mengirim laporan pemulihan:', e);
      }
    }
  }
};
