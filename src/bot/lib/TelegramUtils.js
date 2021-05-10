const Utils = require('./Utils');

class TelegramUtils extends Utils {

    constructor() {
        super();
    }

    static isAttachment (msg) {
        return (msg.document !== undefined || msg.photo !== undefined || msg.voice !== undefined || msg.sticker !== undefined || msg.audio !== undefined || msg.video_note !== undefined);
    }

    static isTextMessage (msg) {
        return (msg.text !== undefined);
    }
}

module.exports = TelegramUtils;