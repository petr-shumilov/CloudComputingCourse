const config    = require('./../config/testenv.json');
const pgp       = require('pg-promise')();
const db        = pgp(config.storage.db.endpoint.uri);

module.exports = db;