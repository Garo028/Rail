function normalizeJid(jid) {
    if (!jid || typeof jid !== 'string') return '';
    const s = jid.replace(/:\d+@/, '@');
    if (s.includes('@')) return s.toLowerCase().trim();
    return s.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
}
function getSender(sock, message) {
    try {
        const isGroup = message.key?.remoteJid?.endsWith('@g.us');
        let raw = '';
        if (message.key.fromMe) { raw = sock.user?.id || ''; }
        else if (isGroup) {
            raw = message.key.participant || message.message?.extendedTextMessage?.contextInfo?.participant || '';
            if (raw && raw.includes('@lid')) return raw.toLowerCase().trim();
        } else { raw = message.key.remoteJid || ''; }
        return normalizeJid(raw);
    } catch { return ''; }
}
module.exports = { getSender, normalizeJid };
