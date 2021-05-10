const db         = require('./DB');
const config     = require('./../config/testenv.json');
const pgp        = db.$config.pgp;
const STATE     = require('./../State');

const SchemaName = config.storage.db.endpoint.schema || 'public';
const UsersTableName = config.storage.db.UsersTableName;
const StateTableName = config.storage.db.StateTableName;
const MemoryTableName = config.storage.db.MemoryTableName;

// simple orm
class Storage {

    constructor (dbHandler) {
        this.db = dbHandler;
    }

    // USERS
    async GetUserByChatId (chatId) {
        let getUserStatement = {
            text: `SELECT * FROM ${SchemaName}.${UsersTableName} WHERE chat_id = $1`,
            values: [chatId.toString()]
        };
        let row = await this.query(getUserStatement);
        return (row.length === 1) ? row[0] : false;
    }


    async GetUserByUserId (userId) {
        let getUserStatement = {
            text: `SELECT * FROM ${SchemaName}.${UsersTableName} WHERE id = $1`,
            values: [userId.toString()]
        };
        let row = await this.query(getUserStatement);
        return (row.length === 1) ? row[0] : false;
    }

    async GetUserStateByUserId (userId) {
        let getUserStatement = {
            text: `SELECT state FROM ${SchemaName}.${StateTableName} WHERE user_id = $1`,
            values: [userId.toString()]
        };
        let row = await this.query(getUserStatement);
        return (row.length === 1) ? row[0].state : false;
    }

    async GetUserWorkingSkillIdByUserId (userId) {
        let getUserWorkingSkillIdStatement = {
            text: `SELECT skill_id FROM ${SchemaName}.${StateTableName} WHERE user_id = $1`,
            values: [userId.toString()]
        };
        let row = await this.query(getUserWorkingSkillIdStatement);
        return (row.length === 1) ? row[0].skill_id : false;
    }

    async CreateUser (user) {
        // go from camelCase to under_score
        user.chat_id = user.chatId;
        delete user.chatId;

        user.phone_number = user.phoneNumber;
        delete user.phoneNumber;

        // erase from user obj fields which not defined at table 'user'
        let userState = {
            user_id: user.id
        };
        userState.state = user.state;
        delete user.state;

        if (user.workingSkillId !== undefined) {
            userState.skill_id = user.workingSkillId;
            delete user.workingSkillId;
        }

        const UserValidFields = ['id', 'chat_id', 'phone_number'];
        for (let field in user) {
            if (!UserValidFields.includes(field)) {
                delete user[field];
            }
        }

        // insert into users
        const userFields = Object.keys(user);
        const userTable = new pgp.helpers.TableName(UsersTableName, SchemaName);
        const userColumns = new pgp.helpers.ColumnSet(userFields, {table: userTable});
        await this.exec(pgp.helpers.insert(user, userColumns));

        // insert into states
        const userStateFields = Object.keys(userState);
        const userStateTable = new pgp.helpers.TableName(StateTableName, SchemaName);
        const userStateColumns = new pgp.helpers.ColumnSet(userStateFields, {table: userStateTable});
        return this.exec(pgp.helpers.insert(userState, userStateColumns));
    }

    async SetUserPhoneNumberByUserId (userId, phoneNumber) {
        let setUserPhoneNumberStatement = {
            text: `UPDATE ${SchemaName}.${UsersTableName} SET phone_number = $2 WHERE id = $1`,
            values: [userId.toString(), phoneNumber.toString()]
        };
        return this.exec(setUserPhoneNumberStatement);
    }

    async SetUserStateByUserId(userId, state) {
        let setUserState = {
            text: `UPDATE ${SchemaName}.${StateTableName} SET previous_state = (CASE state WHEN $3 THEN previous_state ELSE state END), state = $2 WHERE user_id = $1`,
            values: [userId.toString(), state.toString(), STATE.PENDING.string]
        };
        return this.exec(setUserState);
    }

    async SetUserWorkingSkillIdByUserId (userId, skillId) {
        let setUserWorkingSkillIdStatement = {
            text: `UPDATE ${SchemaName}.${StateTableName} SET skill_id = $2 WHERE user_id = $1`,
            values: [userId.toString(), skillId.toString()]
        };
        return this.exec(setUserWorkingSkillIdStatement);
    }


    // Skills
    async GetSkillProcessingFieldByUserId (userId) {
        let getUserSettedMemoryFieldByUserIdStatement = {
            text: `SELECT memory_field FROM ${SchemaName}.${StateTableName} WHERE user_id = $1`,
            values: [userId.toString()]
        };
        let row = await this.query(getUserSettedMemoryFieldByUserIdStatement);
        return (row.length === 1) ? row[0].memory_field : false;
    }

    async SetSkillProcessingFieldByUserId (userId, field) {
        let setUserMemoryFieldStatement = {
            text: `UPDATE ${SchemaName}.${StateTableName} SET memory_field = $2 WHERE user_id = $1`,
            values: [userId.toString(), field.toString()]
        };
        return this.exec(setUserMemoryFieldStatement);
    }

    // Memory
    async GetMemoryByUserId (userId) {
        let getUserMemoryStatement = {
            text: `SELECT field_name, field_value FROM ${SchemaName}.${MemoryTableName} WHERE user_id = $1`,
            values: [userId]
        };
        let rawStorageMemory = await this.query(getUserMemoryStatement);
        let memory = {};
        for (const f of rawStorageMemory) {
            memory[f.field_name] = f.field_value;
        }
        return memory;
    }

    async MultipleInsertInMemoryByUserId (userId, data) {
        if (Object.keys(data).length > 0) {
            let mem = [];
            for (const key in data) {
                mem.push({
                    user_id: userId,
                    field_name: key,
                    field_value: data[key]
                });
            }
            const fields = Object.keys(mem[0]);
            const table = new pgp.helpers.TableName(MemoryTableName, SchemaName);
            const columns = new pgp.helpers.ColumnSet(fields, {table});

            return this.exec(pgp.helpers.insert(mem, columns));
        } else {
            let deleteFromMemoryStatement = {
                text: `DELETE FROM ${SchemaName}.${MemoryTableName} WHERE user_id = $1`,
                values: [userId]
            };
            return this.exec(deleteFromMemoryStatement);
        }
    }

    async Transaction (transactionBuilder) {
        try {
            await db.tx((transactionHandler) => {
                var storage = new Storage(transactionHandler);
                return transactionHandler.batch(transactionBuilder(storage));
            });
        }
        catch (e) {
            throw new Error("Transaction error: " + e.name + ":" + e.message + "\n" + e.stack);
        }
    }

    exec (statement) {
        return this.db.none(statement);
    }

    query (statement) {
        return this.db.query(statement);
    }
}


module.exports = Storage;