require('dotenv').config();

global.DATA = {
    CONNECTION: {
        mongo: undefined
    },
    MODELS: {},
    PLUGINS: {}
};

const MongoDBConnection = require('../connections/mongoDB_connection');

const InitializeConnection = async () => {
    try {
        const connectionObjMongo = new MongoDBConnection();
        await connectionObjMongo.initialize();
    } catch (err) {
        console.error('Error connecting to the MongoDB database:', err);
    }
};

async function IntializeApp() {
    const App = require('./app');
    const app = new App();
    await app.StarterFunction();
    await app.listen();
}

(async function () {
    await InitializeConnection();
    await IntializeApp();
})();
