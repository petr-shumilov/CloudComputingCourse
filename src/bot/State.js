const COMMAND 	= require('./Command');

const STATES = {
    IDLE : {string: "IDLE", can_go: [COMMAND.LIST, COMMAND.NEW]},
    PENDING : {string: "PENDING", can_go: []}
};

module.exports = STATES;