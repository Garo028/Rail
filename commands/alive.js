const settings = require('../settings');
module.exports = async (sock, chatId, message) => {
    const up = process.uptime();
    const d=Math.floor(up/86400),h=Math.floor((up%86400)/3600),m=Math.floor((up%3600)/60),s=Math.floor(up%60);
    const ram = (process.memoryUsage().rss/1024/1024).toFixed(1);
    await sock.sendMessage(chatId, { text:
`╔═══════════════════╗
║  🤖  *Scotty_mini*  ║
╚═══════════════════╝

✅ *Online & Ready!*

⏱️ *Uptime:* ${d}d ${h}h ${m}m ${s}s
💾 *RAM:* ${ram}MB
📦 *Version:* ${settings.version}
⚡ *Commands:* 3

_scotty©_`
    }, { quoted: message });
};
