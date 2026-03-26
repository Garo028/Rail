/**
 * Scotty_mini — Railway WhatsApp Bot
 * 3 commands: .menu .alive .ping
 * Owner: +263788114185
 */
require('dotenv').config();

const fs        = require('fs');
const path      = require('path');
const chalk     = require('chalk');
const express   = require('express');
const cors      = require('cors');
const NodeCache = require('node-cache');
const pino      = require('pino');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require('@whiskeysockets/baileys');

const settings  = require('./settings');
const { getSender }   = require('./lib/getSender');
const { makeIsOwner } = require('./lib/isOwner');

// ── Railway uses dynamic PORT ──────────────────────────────────────────────
const PORT    = process.env.PORT;
const APP_URL = process.env.APP_URL
    || process.env.RAILWAY_STATIC_URL
    || process.env.RAILWAY_PUBLIC_DOMAIN
    || `http://localhost:${PORT}`;

// ── Folders ────────────────────────────────────────────────────────────────
['session','temp','data'].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Commands ───────────────────────────────────────────────────────────────
const menuCmd  = require('./commands/menu');
const aliveCmd = require('./commands/alive');
const pingCmd  = require('./commands/ping');

// ── Per-session store ──────────────────────────────────────────────────────
function createStore() {
    const messages = {};
    function bind(ev) {
        ev.on('messages.upsert', ({ messages: msgs }) => {
            msgs.forEach(msg => {
                const jid = msg.key?.remoteJid; if (!jid) return;
                if (!messages[jid]) messages[jid] = [];
                messages[jid].push(msg);
                if (messages[jid].length > 20) messages[jid] = messages[jid].slice(-20);
            });
        });
    }
    async function loadMessage(jid, id) {
        return (messages[jid] || []).find(m => m.key?.id === id) || undefined;
    }
    return { bind, loadMessage };
}

// ── Restore SESSION_ID if set ──────────────────────────────────────────────
async function restoreSession() {
    const id = process.env.SESSION_ID;
    if (!id) return false;
    try {
        const creds = './session/creds.json';
        if (fs.existsSync(creds)) { console.log(chalk.green('✅ Session exists')); return true; }
        let decoded;
        try { decoded = Buffer.from(id,'base64').toString('utf8'); JSON.parse(decoded); }
        catch { decoded = id; }
        fs.writeFileSync(creds, decoded);
        console.log(chalk.green('✅ Session restored!'));
        return true;
    } catch(e) { console.log(chalk.yellow('⚠️ Session restore failed:', e.message)); return false; }
}

// ── Keep-alive web server (Railway needs a port open) ─────────────────────
function startWebServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get('/', (req, res) => res.json({
        bot: 'Scotty_mini',
        status: 'online',
        uptime: Math.floor(process.uptime()),
        commands: 3
    }));

    app.get('/ping', (req, res) => res.json({ status: 'alive', uptime: Math.floor(process.uptime()) }));

    app.listen(PORT, '0.0.0.0', () => {
        console.log(chalk.green(`🌐 Web server running on port ${PORT}`));
    });
}

// ── Anti-sleep ─────────────────────────────────────────────────────────────
let _sock = null;
setInterval(async () => { try { if (_sock) await _sock.sendPresenceUpdate('available'); } catch {} }, 4*60*1000);

// ── Keep-alive ping to self ────────────────────────────────────────────────
function startKeepAlive() {
    if (!APP_URL || APP_URL.includes('localhost')) return;
    const url = APP_URL.startsWith('http') ? APP_URL : `https://${APP_URL}`;
    setInterval(async () => {
        try { const fetch = require('node-fetch'); await fetch(`${url}/ping`); } catch {}
    }, 10*60*1000);
    console.log(chalk.cyan('✅ Keep-alive active →', url));
}

// ── Main bot ───────────────────────────────────────────────────────────────
async function startBot() {
    try {
        await restoreSession();

        const userStore            = createStore();
        const { version }          = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const phone                = (process.env.OWNER_NUMBER || settings.ownerNumber || '').replace(/[^0-9]/g,'');

        if (!phone || phone.length < 7) {
            console.log(chalk.red('❌ Set OWNER_NUMBER env variable and restart!'));
            process.exit(1);
        }

        const sock = makeWASocket({
            version,
            logger:            pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser:           ['Ubuntu', 'Chrome', '20.0.04'],
            auth: {
                creds: state.creds,
                keys:  makeCacheableSignalKeyStore(state.keys, pino({level:'fatal'}).child({level:'fatal'}))
            },
            msgRetryCounterCache:  new NodeCache(),
            connectTimeoutMs:      60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs:   25000,
            markOnlineOnConnect:   true,
            getMessage: async (key) => {
                const msg = await userStore.loadMessage(jidNormalizedUser(key.remoteJid), key.id);
                return msg?.message || { conversation: '' };
            },
        });

        _sock = sock;
        sock._ownerPhone = phone;
        sock.ev.on('creds.update', saveCreds);
        userStore.bind(sock.ev);

        // ── Auto pairing ───────────────────────────────────────────────────
        if (!sock.authState.creds.registered) {
            console.log(chalk.yellow(`\n📱 Requesting pairing code for +${phone}...`));
            await delay(3000);
            try {
                let code = await sock.requestPairingCode(phone);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log('\n');
                console.log(chalk.bgCyan.black.bold('  ════════════════════════════════  '));
                console.log(chalk.bgCyan.black.bold('  🤖  Scotty_mini  PAIRING CODE  🤖  '));
                console.log(chalk.bgCyan.black.bold('  ════════════════════════════════  '));
                console.log(chalk.bgYellow.black.bold('                                  '));
                console.log(chalk.bgYellow.black.bold(`   🔑  CODE:  ${chalk.bold(code)}          `));
                console.log(chalk.bgYellow.black.bold('                                  '));
                console.log(chalk.bgGreen.black.bold('                                  '));
                console.log(chalk.bgGreen.black.bold('  1. Open WhatsApp                '));
                console.log(chalk.bgGreen.black.bold('  2. Settings → Linked Devices    '));
                console.log(chalk.bgGreen.black.bold('  3. Link a Device                '));
                console.log(chalk.bgGreen.black.bold('  4. Link with phone number       '));
                console.log(chalk.bgGreen.black.bold(`  5. Enter: ${code}          `));
                console.log(chalk.bgGreen.black.bold('                                  '));
                console.log(chalk.bgBlue.white.bold('  ⏰ Expires in 60 seconds!        '));
                console.log(chalk.bgBlue.white.bold('  ⏳ Waiting for you...            '));
                console.log('\n');
            } catch(err) {
                console.error(chalk.red('❌ Pairing failed:'), err.message);
                await delay(5000); return startBot();
            }
        }

        // ── Messages ───────────────────────────────────────────────────────
        sock.ev.on('messages.upsert', async (update) => {
            try {
                if (update.type !== 'notify') return;
                const mek = update.messages[0];
                if (!mek?.message) return;

                // Unwrap ephemeral
                if (Object.keys(mek.message)[0] === 'ephemeralMessage')
                    mek.message = mek.message.ephemeralMessage.message;

                const chatId = mek.key.remoteJid;
                if (!chatId || chatId === 'status@broadcast') return;
                if (mek.key.id?.startsWith('BAE5') && mek.key.id.length === 16) return;

                // .session command — owner only
                const rawText = mek.message?.conversation || mek.message?.extendedTextMessage?.text || '';
                if (rawText.trim().toLowerCase() === '.session') {
                    const sender  = getSender(sock, mek);
                    const isOwner = makeIsOwner(phone);
                    if (await isOwner(sender)) {
                        const f = './session/creds.json';
                        if (fs.existsSync(f)) {
                            const encoded = Buffer.from(fs.readFileSync(f,'utf8')).toString('base64');
                            await sock.sendMessage(chatId, {
                                document: Buffer.from(encoded),
                                fileName: 'ScottyMini_SESSION.txt',
                                mimetype: 'text/plain',
                                caption: '🔐 Your SESSION_ID\n\nSet as SESSION_ID env variable.\n\n_scotty©_'
                            }, { quoted: mek });
                        }
                        return;
                    }
                }

                // Parse command
                const prefix = settings.prefix || '.';
                if (!rawText.trim().startsWith(prefix)) return;

                const body = rawText.trim().slice(prefix.length).trim();
                const cmd  = body.split(/\s+/)[0].toLowerCase();

                switch (cmd) {
                    case 'menu': case 'help':  await menuCmd(sock, chatId, mek);  break;
                    case 'alive':              await aliveCmd(sock, chatId, mek); break;
                    case 'ping':               await pingCmd(sock, chatId, mek);  break;
                    default: break;
                }
            } catch(e) {
                if (!e.message?.includes('Connection')) console.error('msg error:', e.message);
            }
        });

        // ── Connection events ──────────────────────────────────────────────
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'connecting') console.log(chalk.yellow('🔄 Connecting...'));

            if (connection === 'open') {
                // Save session backup
                try {
                    const f = './session/creds.json';
                    if (fs.existsSync(f))
                        fs.writeFileSync('./data/session_backup.b64', Buffer.from(fs.readFileSync(f,'utf8')).toString('base64'));
                } catch {}

                // Welcome DM
                try {
                    const botNum = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    await sock.sendMessage(botNum, {
                        text: `🤖 *Scotty_mini is ONLINE!*\n\n✅ Bot is running on Railway!\n\n📋 *Commands:*\n• *.menu* — command list\n• *.alive* — bot status\n• *.ping* — response speed\n• *.session* — save session\n\n_scotty©_`
                    });
                } catch {}

                console.log(chalk.cyan('\n╔══════════════════════════════╗'));
                console.log(chalk.cyan('║  🤖  Scotty_mini  ✅ ONLINE  ║'));
                console.log(chalk.cyan(`║  👤  +${phone}        ║`));
                console.log(chalk.cyan('║  ⚡  3 Commands Active       ║'));
                console.log(chalk.cyan('╚══════════════════════════════╝\n'));
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                console.log(chalk.red(`⛔ Disconnected. Code: ${code}`));
                if (code === DisconnectReason.loggedOut || code === 401) {
                    try { fs.rmSync('./session', { recursive: true, force: true }); } catch {}
                    console.log(chalk.red('❌ Logged out. Restart to re-pair.\n')); return;
                }
                console.log(chalk.yellow('♻️ Reconnecting in 5s...'));
                await delay(5000); startBot();
            }
        });

    } catch(e) {
        console.error('❌ Crash:', e.message);
        await delay(5000); startBot();
    }
}

// ── Launch ─────────────────────────────────────────────────────────────────
startWebServer();
startKeepAlive();
startBot();

process.on('uncaughtException', e => { if (!e.message?.includes('Connection')) console.error('Uncaught:', e.message); });
process.on('unhandledRejection', e => { if (!String(e)?.includes('Connection')) console.error('Rejection:', e); });
