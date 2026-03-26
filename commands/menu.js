const settings = require('../settings');
module.exports = async (sock, chatId, message) => {
    const up = process.uptime();
    const h=Math.floor((up%86400)/3600),m=Math.floor((up%3600)/60),s=Math.floor(up%60);
    await sock.sendMessage(chatId, { text:
`╔═══════════════════╗
║  🤖  *Scotty_mini*  ║
╚═══════════════════╝

👋 Hey there!

⏱️ Uptime: *${h}h ${m}m ${s}s*
🌐 Prefix: *${settings.prefix}*
📦 Version: *${settings.version}*

━━━━━━━━━━━━━━━━━
📋 *COMMANDS*
━━━━━━━━━━━━━━━━━

◈ *.menu* — show this menu
◈ *.alive* — check bot status
◈ *.ping* — check response speed

━━━━━━━━━━━━━━━━━
_scotty©_`
    }, { quoted: message });
};
