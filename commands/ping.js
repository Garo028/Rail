module.exports = async (sock, chatId, message) => {
    const start = Date.now();
    await sock.sendMessage(chatId, { text: '🏓 Pinging...' }, { quoted: message });
    const ms = Date.now() - start;
    const status = ms < 100 ? '🟢 Excellent' : ms < 300 ? '🟡 Good' : '🔴 Slow';
    await sock.sendMessage(chatId, { text:
`🏓 *Pong!*
━━━━━━━━━━━━
⚡ Speed: *${ms}ms*
📶 Status: ${status}
🤖 Bot: *Online*

_scotty©_`
    }, { quoted: message });
};
