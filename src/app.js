const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const IndexRoute = require('./routes');
const PluginsLoader = require('./utils/Plugins');
const MongoDBConnection = require('../connections/mongoDB_connection');
const http = require('http');

class App {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app); // Create an HTTP server
    }

    async StarterFunction() {
        try {

            // // Initialize MongoDB Connection
            // await new MongoDBConnection().initialize();
            // console.log("MongoDB connected");

            // Load PLUGINS
            await new PluginsLoader().loadPlugins();
            console.log("PLUGINS loaded");

            this.app.use(cors({
                origin: '*'
            }));
            this.app.use(bodyParser.json());
            this.app.use(bodyParser.urlencoded({ extended: true }));

            // Middleware to attach io to req
            this.app.use((req, res, next) => {
                req.io = this.io;
                next();
            });

            // Default route
            this.app.get("/welcome", async (req, res, next) => {
                res.send({
                    "status": 200,
                    "message": "Hi Started Successfully"
                });
            });

            // Use Routes after connection
            await new IndexRoute(this.app, this.io).initialize();

            // Handling Undefined route
            this.app.use(async (req, res, next) => {
                next(DATA.PLUGINS.httperrors.NotFound("URL not found. Please enter valid URL"));
            });

            // Error Handler
            this.app.use((err, req, res, next) => {
                res.status(err.status || 500);
                res.send({
                    "status": err.status || 500,
                    "message": err.message
                });
            });

        } catch (error) {
            console.error("An error occurred during app initialization:", error);
        }
    }

    async listen() {
        this.server.listen(4200, (err) => {
            if (err) {
                console.log("Error while running the server", err);
            } else {
                console.log("Server running on port 4200");
            }
        });
    }
}

module.exports = App;
