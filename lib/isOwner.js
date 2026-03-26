function extractNum(id) { if (!id) return ''; return id.split(':')[0].split('@')[0]; }
function makeIsOwner(ownerPhone) {
    const ownerClean = extractNum(ownerPhone);
    return async function isOwner(senderId) {
        if (!senderId) return false;
        const senderClean = extractNum(senderId);
        if (senderId === ownerClean + '@s.whatsapp.net') return true;
        if (senderClean === ownerClean) return true;
        if (process.env.OWNER_NUMBER && senderClean === extractNum(process.env.OWNER_NUMBER)) return true;
        if (ownerClean && senderId.includes(ownerClean)) return true;
        return false;
    };
}
module.exports = { makeIsOwner, extractNum };
