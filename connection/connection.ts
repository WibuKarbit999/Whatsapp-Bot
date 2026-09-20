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
  }
  if (connection == tutup) {
    let error = lastDisconnect?.error;
    let statusCode = new Boom(error)?.output?.statusCode;
    console.log(chalk.red.bold(`[DISCONNECT ERROR]`));
    console.log(chalk.red.monospace(`[DISCONNECT ERROR]`), error);

    global._disconnectRecord = {
      disconnectAt: Date.now(),
      statusCode,
      errorMsg: error.message || 'Connection Lost'
    };

    switch (statusCode) {
    case 401:
        console.log(`• [ LOGGED OUT ]\nSesi telah dikeluarkan dari Perangkat Tertaut. Menghapus sesi...`);
        try {
            if (fs.existsSync(session)) {
                fs.rmSync(session, { recursive: true, force: true });
            }
        } catch (err) {}
        process.exit();
        break;
    case 403:
        console.log(`• [ ACCESS DENIED ]\nAkses ditolak/tutup secara paksa oleh server Whatsapp. Cek Nomornya mungkin terbanned/dibatasi.`);
        process.exit();
        break;
    case 405:
        console.log(`• [ NOT ACCEPTABLE ]\nKoneksi ditolak oleh server whatsapp karena dianggap kadaluarsa.`);
        Bit.logout();
        console.log('Menghubungkan kembali dalam 5 detik...');
        if (typeof spinnerInterval !== 'undefined') clearInterval(spinnerInterval);
        setTimeout(() => launch(), 5000);
        break;
    case 408:
        console.log(`• [ CONNECTION TIMEOUT ]\nWaktu tunggu habis saat bot mencoba merespons ping dari server. Menghubungkan ulang...`);
        setTimeout(() => launch(), 5000);
        break;
    case 411:
        console.log(`• [ CONNECTION CLOSED ]\nKoneksi ditutup secara sepihak oleh server Whatsapp. Menghubungkan ulang...`);
        setTimeout(() => launch(), 5000);
        break;
    case 428:
        console.log(`• [ CONNECTION REPLACED ]\nKoneksi bertabrakan! Ada script/perangkat lain yang memakai sesi ini secara bersamaan.`);
        process.exit();
        break;
    case 440:
        console.log(`• [ BAD SESSION ]\nFile sesi rusak atau tidak valid. Menghapus sesi...`);
        try {
            if (fs.existsSync(session)) {
                fs.rmSync(session, { recursive: true, force: true });
            }
        } catch (err) {}
        process.exit();
        break;
    case 500:
    case 503:
        console.log(`• [ SERVER ISSUE ]\nServer WhatsApp sedang bermasalah atau sibuk (Code: ${statusCode}). Menghubungkan ulang...`);
        setTimeout(() => launch(), 5000);
        break;
    case 515:
        console.log(`• [ RESTART REQUIRED ]\nServer WhatsApp meminta restart untuk sinkronisasi pesan. Menghubungkan ulang...`);
        setTimeout(() => launch(), 5000);
        break;
    default:
        console.log(`• [ UNKNOWN DISCONNECT ]\nTerputus dengan alasan yang tidak diketahui (Code: ${statusCode}). Menghubungkan ulang...`);
        setTimeout(() => launch(), 5000);
        break;
    }
  }

  if (connection === 'open') {
    clearInterval(spinnerInterval);
    console.log('• [ TERHUBUNG ]\nKoneksi Terhubung')
    await sleep(7500);
    console.log('• [ READY ]\nBot siap digunakan');

    if (global._disconnectRecord) {
    try {
        const down = global._disconnectRecord;
        const downtimeMs = Date.now() - down.disconnectedAt;
        
        // Cuma kirim laporan kalau bot matinya lebih dari 5 detik (biar nggak spam)
        if (downtimeMs >= 5000) {
            const ownerList = Data?.owner || []; // Pastikan variabel Data sudah ter-import ya
            const primaryOwner = ownerList[0];
            
            if (primaryOwner) {
                const ownerJid = primaryOwner.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                const downtimeSec = Math.round(downtimeMs / 1000);
                const durationStr = downtimeSec >= 60
                    ? `${Math.floor(downtimeSec / 60)} menit ${downtimeSec % 60} detik`
                    : `${downtimeSec} detik`;

                // INI YANG SUDAH DIPERBAIKI SESUAI STANDAR BAILEYS
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
                    515: 'Restart Required (515)'
                };
                
                const reasonStr = reasonMap[down.statusCode] || `Error Code: ${down.statusCode || 'Unknown'}`;
                const timeStr = new Date().toLocaleTimeString('id-ID');
                
                const text = Data.infos?.reconnectAlert
                    ? Data.infos.reconnectAlert(durationStr, reasonStr, timeStr)
                    : `⚠️ *LAPORAN PEMULIHAN KONEKSI BOT*\n\n• *Status:* 🟢 *Tersambung Kembali*\n• *Waktu Pulih:* ${timeStr} WIB\n• *Penyebab:* ${reasonStr}\n• *Durasi Downtime:* ${durationStr}`;

                // Kirim notif ke owner menggunakan koneksi bot (pakai nama Exp, Bit, atau karbit)
                await Bit.sendMessage(ownerJid, { text });
            }
        }
    } catch (e) {
        console.log("Gagal mengirim laporan pemulihan:", e);
    } finally {
        // Wajib dikosongkan lagi supaya nggak ngirim laporan terus-terusan
        global._disconnectRecord = null;
    }
}

  }
}

