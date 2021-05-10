const COMMANDS 	= require('./../Command');

class Utils {
    static isCommand (text) {
        let isCommand = false;
        for (let cmd in COMMANDS) {
            if (COMMANDS[cmd].regexp.test(text) === true) {
                isCommand = true;
                break;
            }
        }
        return isCommand;
    }
}

module.exports = Utils;