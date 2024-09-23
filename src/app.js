const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const IndexRoute = require('./routes');
const PluginsLoader = require('./utils/Plugins');
const http = require('http');
const cookieParser = require('cookie-parser');


const allowedOrigins = [
    'https://dresscode-ecom.vercel.app',
    'https://dresscode-dashboard.vercel.app',
    'https://a32c-49-43-225-190.ngrok-free.app'
];

class App {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app); // Create an HTTP server
    }

    async StarterFunction() {
        try {

            // Load PLUGINS
            await new PluginsLoader().loadPlugins();
            console.log("PLUGINS loaded");

            this.app.use(cors({
                origin: function (origin, callback) {
                    if (allowedOrigins.includes(origin) || !origin) {
                        callback(null, origin);
                    } else {
                        callback(new Error('Not allowed by CORS'));
                    }
                },
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Allowed HTTP methods
                allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
                credentials: true, // Allow cookies and authentication headers
            }));
            this.app.use(cookieParser());
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
