const mongoose = require('mongoose');

class MongoDBConnection {
    constructor() {

    }
    
    async initialize() {
        await this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            // Set strictQuery before establishing the connection
            mongoose.set('strictQuery', true);  // Set to false if you prefer the non-strict behavior

            const mongoUri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}.${process.env.MONGO_PORT}/${process.env.MONGO_DATABASE}`;
            // const mongoUri = `mongodb+srv://admin:qGCSm0JBzxaoI0lB@dresscode.fcmadnw.mongodb.net/DressCodeDB`;
            
            await mongoose.connect(mongoUri);
            
            global.DATA.CONNECTION.mongo = mongoose.connection;
            console.log(`Connected to MongoDB Database Successfully - ${process.env.MONGO_DATABASE}`);
        } catch (error) {
            console.error('Unable to connect to the MongoDB database:', error.message);
        }
    }
}

module.exports = MongoDBConnection;
