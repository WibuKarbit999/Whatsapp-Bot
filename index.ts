/*!===[ Prototype & global ]===!*/
import './src/set/prototype.js'; // String.prototype.import / .req dan global (chalk, fs, dst.)
import './src/set/global.js'; // session, Folder, pairingCode, debug

/*!===[ File lokal ]===!*/
// Pakai import biasa (bukan .req) supaya func.ts dan handler.ts cuma dimuat satu kali
import * as Func from './src/func.js';
import { Connecting } from './connection/connection.js';
import { startHandler, handleMessage, runEvent } from './helpers/handler.js';

/*!===[ Package ]===!*/
const readline = await 'node:readline'.import();
const fs = await 'node:fs/promises'.import();
const chalk = (await 'chalk'.import()).default;
const pino = (await 'pino'.import()).default;
const baileys = await '@whiskeysockets/baileys'.import();
const { EventEmitter } = await 'node:events'.import();

const { useMultiFileAuthState, makeWASocket, DisconnectReason, Browsers, fetchLatestBaileysVersion, getContentType } = baileys;

EventEmitter.defaultMaxListeners = 25;

const logger = pino({ level: 'silent' });
let Bit: any;

/*!====[ DEBUG ]====!*/
function debugLogMessage(message: any, type = 'notify') {
  if (!message?.key || message.key.fromMe) return;

  try {
    const { key } = message;
    const jid: string = key.remoteJid ?? 'unknown';

    const chatType =
      jid === 'status@broadcast'
        ? 'STATUS'
        : jid.endsWith('@g.us')
          ? 'GROUP'
          : jid.endsWith('@newsletter')
            ? 'CHANNEL'
            : 'PRIVATE';

    const sender = key.participant ?? message.participant ?? jid;
    const contentType =
      getContentType(message.message) ?? (message.messageStubType ? `stub:${message.messageStubType}` : 'unknown');

    const ts = message.messageTimestamp;
    const time = new Date((ts ? Number(typeof ts === 'object' ? ts.low : ts) : Date.now() / 1000) * 1000).toLocaleString('id-ID');

    console.log(
      [
        `╭─ 🐞 ${type.toUpperCase()}`,
        `│ Chat    : ${chatType}`,
        `│ Sender  : ${message.pushName ?? '-'}`,
        `│ JID     : ${sender}`,
        `│ Type    : ${contentType}`,
        `│ ID      : ${key.id ?? '-'}`,
        `│ Time    : ${time}`,
        `╰──────────────`,
      ].join('\n')
    );
  } catch (error) {
    console.error('[DEBUG] Failed to log message:', error);
  }
}

/*!====[ Input console ]====!*/
// Satu pertanyaan, lalu ditutup lagi supaya tidak menahan stdin
const ask = (text: string) =>
  new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(text, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });

/*!====[ Jalankan bot ]====!*/
async function launch() {
  try {
    const credsFile = session + '/creds.json';

    // Folder sesi ada tapi creds.json tidak ada = sesi setengah jadi, buang
    if ((await Func.exists(session)) && !(await Func.exists(credsFile))) {
      await fs.rm(session, { recursive: true, force: true });
    }

    // Belum punya sesi: pilih cara menautkan
    if (!(await Func.exists(credsFile))) {
      console.log(
        `\n${chalk.red('================================')}\n` +
          `${chalk.red('Bot belum memiliki Session!')}\n` +
          `${chalk.red('================================')}\n\n` +
          `${chalk.blue('Pilih salah satu untuk menautkan perangkat:')}\n\n` +
          `${chalk.red('• pairing')}\n${chalk.red('• qr')}\n`
      );
      await Func.sleep(1500);

      let pilih = '';
      while (pilih !== 'pairing' && pilih !== 'qr') {
        pilih = (await ask(chalk.yellow.bold('Ketik pairing atau qr: '))).toLowerCase();
      }
      global.pairingCode = pilih === 'pairing';
    }

    const { state, saveCreds } = await useMultiFileAuthState(session);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    Bit = makeWASocket({
      logger,
      version,
      browser: Browsers.ubuntu('Chrome'),
      auth: state,
      retryRequestDelayMs: 5500,
      maxMsgRetryCount: 2,
      getMessage: async () => undefined,
      cachedGroupMetadata: async (jid: string) => Func.metadata.get(jid),
      syncFullHistory: false,
    });

    // Login pakai pairing code
    if (global.pairingCode && !Bit.authState.creds.registered) {
      const phone = (await ask('Tolong masukkan nomor WhatsApp anda (contoh 628123456789): ')).replace(/\D/g, '');
      await Func.sleep(1000);
      const code = await Bit.requestPairingCode(phone);

      console.log(
        `\n======================================\n` +
          `| ${chalk.yellow('Kode Pairing Anda:')} ${code}\n` +
          `| Buka WhatsApp > Perangkat tertaut > Tautkan perangkat > Tautkan dengan nomor telepon, lalu masukkan kode itu.\n` +
          `======================================\n`
      );
    }

    /*!====[ EVENT ]====!*/
    Bit.ev.on('connection.update', (update: any) => {
      Connecting({ Bit, update, launch }).catch(console.error);
    });

    Bit.ev.on('creds.update', saveCreds);

    Bit.ev.on('messages.upsert', ({ type, messages }: any) => {
      for (const message of messages) {
        if (global.debug && !message?.key?.fromMe) debugLogMessage(message, type);
        if (type !== 'notify') continue;
        handleMessage(Bit, message).catch((e: any) => console.error('[handler]', e));
      }
    });

    // Cache metadata grup tetap segar (lewat antrean, supaya tidak kena limit)
    Bit.ev.on('groups.upsert', (list: any[]) => list.forEach((g) => Func.queueMetadata(Bit, g.id)));
    Bit.ev.on('groups.update', (list: any[]) => list.forEach((g) => g.id && Func.queueMetadata(Bit, g.id)));
    Bit.ev.on('group-participants.update', (event: any) => {
      Func.queueMetadata(Bit, event.id);
      runEvent('group.participants', { Bit, event });
    });
  } catch (err) {
    console.error(err);
  }
}

await startHandler(); // muat plugin (sekali saja, bukan tiap reconnect)
launch();
function debugLogMessage(message, type = "notify") {
    if (!message?.key || message.key.fromMe) return

    try {
        const { key } = message
        const jid = key.remoteJid ?? "unknown"

        const chatType =
            jid === "status@broadcast"
                ? "STATUS"
                : jid.endsWith("@g.us")
                    ? "GROUP"
                    : jid.endsWith("@newsletter")
                        ? "CHANNEL"
                        : "PRIVATE"

        const sender =
            key.participant ??
            message.participant ??
            jid

        const contentType =
            getContentType(message.message) ??
            (message.messageStubType
                ? `stub:${message.messageStubType}`
                : "unknown")

        const timestamp = message.messageTimestamp

        const time = timestamp
            ? new Date(
                Number(
                    typeof timestamp === "object"
                        ? timestamp.low
                        : timestamp
                ) * 1000
            ).toLocaleString("id-ID")
            : new Date().toLocaleString("id-ID")

        console.log(
            [
                `╭─ 🐞 ${type.toUpperCase()}`,
                `│ Chat    : ${chatType}`,
                `│ Sender  : ${message.pushName ?? "-"}`,
                `│ JID     : ${sender}`,
                `│ Type    : ${contentType}`,
                `│ ID      : ${key.id ?? "-"}`,
                `│ Time    : ${time}`,
                `╰──────────────`
            ].join("\n")
        )
    } catch (error) {
        console.error("[DEBUG] Failed to log message:", error)
    }
}

async function launch() {
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const quest = (text) => new Promise((resolve) => rl.quest(text, resolve));
    if (
      (await Func.exists(session)) && 
     !(await Func.exists(session + '/creds.json'))
     )
     await fs.rm(session, {recursive: true, force: true});
     if(!(await Func.exists(session + '/creds.json'))) {
       let ques = `\n${chalk.red('================================')}\n${chalk.red.bold('|')} ${chalk.red('Bot belum memiliki Session!')} ${chalk.red('================================')} \n\n${chalk.blue('Pilih salah satu di bawah ini untuk menautkan perangkat:')}\n\n${chalk.red('• pairing')}\n${chalk.red('• qr')}\n\n${chalk.yellow.bold('Ketik Salah satu dari opsi dibawah ini...')}`;

       await sleep(1500);
       const pilih = await quest(ques);
       if (pilih == 'pairing') {
         global.pairingCode = true;
       } else if (pilih == 'qr') {
         global.pairingCode = false;
       } else {
         console.log(`Tolol itu opsi ga ada!`);
       }
     }
 
     let { state, saveCreds } = await useMultiFileAuthState(session);

     const res = await fetch("https://web.whatsapp.com/sw.js")
     const text = await res.text()

     const client = text
    .match(/client_version\s*=\s*["']([^"']+)["']/)?.[1]
    ?.split(".")
    .map(Number)

     Bit = makeWASocket({
       logger,
       version: [
         2,
         3000,
         client
           .then((v) => v.text())
           .then(async (t1) =>
             /^\d+$/.test(t1.trim())
               ? Number(t1.trim())
               : Number((await fs.readFile('./src/version', 'utf8')).trim())
               )
               .catch(async () =>
                 Number((await fs.readFile('./src/version', 'utf8')).trim())
                )
            ],
            printQrInTerminal:!global.pairingCode,
            browsers: ['Debian', 'Chrome', '13'],
            auth: state,
            retryRequestDelayMs: 5500,
            maxMsgRetryCount: 2,
            getMessage: async () => undefined,
            cachedGroupMetadata: (jid) Func.metadata.get(jid),
            syncFullHistory: false,
     });
     
     if (global pairingCode &&!Bit.authState.creds.registered) {
       const phone = await quest('Tolong masukan Nomot Whatsapp anda: ')
       let code = await Bit.requestPairingCode(phone.replace(/[+-]/g, '')
       )
     
       console.log(
          (
          `\n
            ======================================\n
            | ${chalk.yellow('Kode Pairing Anda:')} ${code}\n
            | Silahkan Masuk ke bagian perangkat tertaut => tautkan perangkat => Masukkan pairing code saja.\n
            ======================================\n
            `
          )
        );
      }

      /*!====[ EVENT ]====!*/
      Bit.ev.on('connection.update', async (update) => {
        await Connecting({ update, Bit, DisconnectReason, sleep, Boom, launch });
        if (update.connection === 'open') {}
      });

      Bit.ev.on('creds.update', saveCreds);
      Bit.ev.on('message-receipt.update', async (msg) => {}
      );

      Bit.ev.on('messages.upsert', async ({ type, messages }) => {
        for (let message of messages) {
          if (global.debug &&!message?.key?.fromMe) {
            debugLogMessage(message, type);
          }
          let isMeta = message?.key?.remoteJid?.includes('13135550002') || message?.key?.remoteJid?.endsWith('@bot') || message?.key?.participant?.includes('13135550002') || message?.key?.participant?.includes('13135550002');

          if (
            isMeta || message?.messaga?.botForwardMessage || message?.message?.messageContextInfo?.botMetadata
           ) {
             if (message?.message) {
               const relayJson = JSON.stringify(message.message, (a, v) => v instanceof Uint8Array || Buffer.isBuffer(v) || (v?.type === 'Buffer' && Array.isArray(v?.data || v).toString('base64')
                 : v,
              2
              );
              console.log
              )
             }
           }
        }
      })

  } catch (err) {
    console.error(err);
  }
}
