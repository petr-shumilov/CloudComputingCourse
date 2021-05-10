const db 					= require('./DB');
const Storage 				= require('./Storage');
const Guid 					= require('guid');

class User {

    constructor ({chatId, userId}) {
        // basic
        this.id = (userId !== undefined) ? userId.toString() : null;
        this.status = null;

        // chat
        this.chatId = (chatId !== undefined) ? chatId.toString() : null;

        // cotacts
        this.phoneNumber = null;

        // states
        this.state = null;
        this.workingSkillId = null;


        this.updates = [];
    }

    SetStatus (status) {
        this.status = status;
        this.updates.push({ status });
        return this;
    }

    SetPhoneNumber (phoneNumber) {
        this.phoneNumber = phoneNumber;
        this.updates.push({ phoneNumber });
        return this;
    }

    SetState (state) {
        this.state = state;
        this.updates.push({ state });
        return this;
    }

    SetWorkingSkillId (workingSkillId) {
        this.workingSkillId = workingSkillId;
        this.updates.push({ workingSkillId });
        return this;
    }


    async PushUpdates() {
        let storage = new Storage(db);
        let updates = this.updates;
        let userId = this.id;
        try {
            await storage.Transaction((_storage) => {
                let queries = [];

                // debug
                console.log(`Push user: `);

                for (let i in updates) {

                    let propertyName = Object.keys(updates[i])[0].toString();
                    let propertyValue = updates[i][propertyName];

                    // debug
                    console.log(`${propertyName}: ${JSON.stringify(propertyValue)}`);

                    switch (propertyName) {
                        case 'type':
                            queries.push(_storage.SetUserTypeByUserId(userId, propertyValue));
                            break;
                        case 'status':
                            queries.push(_storage.SetUserStatusByUserId(userId, propertyValue));
                            break;
                        case 'phoneNumber':
                            queries.push(_storage.SetUserPhoneNumberByUserId(userId, propertyValue));
                            break;
                        case 'state':
                            queries.push(_storage.SetUserStateByUserId(userId, propertyValue));
                            break;
                        case 'workingSkillId':
                            queries.push(_storage.SetUserWorkingSkillIdByUserId(userId, propertyValue));
                            break;
                    }
                }
                return queries;
            });
        }
        catch (e) {
            console.log(`[User]: update tx error ${e.name}\n${e.message}\n${e.stack}\n\n`)
            this.updates = [];
            throw new Error(e.message);
        }
        this.updates = [];
        return this;
    }

    async Get () {
        try {
            let storage = new Storage(db);
            let dbUser;
            if (this.chatId !== undefined && this.chatId !== null) {
                dbUser = await storage.GetUserByChatId(this.chatId);
            }
            else if (this.id !== undefined && this.id !== null) {
                dbUser = await storage.GetUserByUserId(this.id);
            }
            else {
                throw new Error('[User]: id or chatId of user undefined');
            }
            if (dbUser !== false) {
                this.id = dbUser.id;
                this.status = dbUser.status || null;

                // chat
                this.chatId = dbUser.chat_id;

                // cotacts
                this.phoneNumber = dbUser.phone_number || null;

                // states
                this.state = await this.GetState();
                this.workingSkillId = await this.GetWorkingSkillId() || null;
                return this;
            }
        }
        catch (e) {
            console.log(`[User]: get error ${e.name}\n${e.message}\n${e.stack}\n\n`);
            return false;
        }
        return false;
    }

    GetId () {
        return this.id;
    }

    async GetStatus ({ force = true } = {}) {
        if (force !== undefined && force === true) {
            if (!this.id) {
                throw new Error(`[User]: undefined user id`)
            }
            let storage = new Storage(db);
            return await storage.GetUserStatusByUserId(this.id);
        }
        return this.status;
    }

    GetChatId () {
        return this.chatId;
    }

    GetPhoneNumber () {
        return this.phoneNumber;
    }

    async GetState () {
        if (!this.id) {
            throw new Error(`[User]: undefined user id`)
        }
        let storage = new Storage(db);
        return storage.GetUserStateByUserId(this.id);
    }

    async GetWorkingSkillId () {
        if (!this.id) {
            throw new Error(`[User]: undefined user id`)
        }
        let storage = new Storage(db);
        return storage.GetUserWorkingSkillIdByUserId(this.id);
    }

    async CheckExist () {
        return (await this.Get() !== false);
    }

    async Create() {
        try {
            this.id	= Guid.raw().toString();
            let newUser = {
                id: this.id,
                chatId: this.chatId
            };

            // debug
            console.log(`Create user: `);

            let stateWasSet = false;
            for (let i in this.updates) {
                let propertyName = Object.keys(this.updates[i])[0].toString();
                let propertyValue = this.updates[i][propertyName];

                // debug
                console.log(`${propertyName}: ${JSON.stringify(propertyValue)}`);

                newUser[propertyName] = propertyValue;

                if (propertyName.toString() === 'state') {
                    stateWasSet = true;
                }
            }
            if (stateWasSet === false) {
                throw new Error("[User]: undefined initial state of user")
            }

            let storage = new Storage(db);
            await storage.CreateUser(newUser);
        }
        catch (e) {
            console.log(`[User]: create error ${e.name}\n${e.message}\n${e.stack}\n\n`);
            this.updates = [];
            throw new Error(e.message);
        }
        this.updates = [];
        return this;
    }

}

module.exports = User;
