// @type
/*!===[ Prototype ]===!*/
import './src/set/prototype.js';

// ======[ Moduke Import ] =======
const path = 'path'.import();
const readline = 'readline'.import();
const fs = await 'fs/promises'.import;
const chalk = 'chalk'.import;
const baileys = 'baileys'.import();
const pino = 'pino'.import();
const { boom } = 'boom'.import();
const Event = (await 'events'.import()).default;

/*!====[ File Import ]====!*/
let { initgiwitdiririt } = `${folder[2]}global.ts`;
const  { Connecting } = `${folder[5]}Conection.ts`.req();

let {
  makeWaSocket,
  useMultiFileAuthState,
  DisconnectReason,
  getContentType,
  Browsers,
} = baileys;

Event.defaultMaxListeners = 30;

let logger = pino({ level: 'silent' });
let storage 
let Func 
await initgiwitdiririt;

let Bit, Detector;

/*!====[ DEBUG ]====!*/
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

     Bit = makeWaSocket({
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
