const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const IndexRoute = require('./routes');
const PluginsLoader = require('./utils/Plugins');
const http = require('http');
const cookieParser = require('cookie-parser');
const axios = require('axios'); // To make HTTP requests
const cron = require('node-cron'); // For scheduling tasks
const Coupon = require('./utils/Models/couponModel'); // Import the Coupon model


const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

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

            // Schedule API call every 12 hours using node-cron
            this.scheduleShiprocketApiCall();

        } catch (error) {
            console.error("An error occurred during app initialization:", error);
        }
    }

    // Method to schedule API call
    scheduleShiprocketApiCall() {
        // Schedule the task to run every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            try {
                console.log("Scheduled API call to Shiprocket triggered");

                // Make the request using axios
                const response = await axios.get('https://apiv2.shiprocket.in/v1/external/courier/courierListWithCounts', {
                    headers: {
                        'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
                    }
                });

                // Log the response or handle it as needed
                console.log("Successfully called the Shiprocket API");
            } catch (error) {
                console.error("Error during Shiprocket API call:", error.message);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata" // Sets the timezone to Indian Standard Time (IST)
        });
    }

    // Method to schedule coupon expiration check
    scheduleCouponExpirationCheck() {
        // Schedule the task to run every hour
        cron.schedule('30 8 * * *', async () => {
            try {
                console.log("Scheduled coupon expiration check triggered");

                // Find and update coupons that have expired
                const result = await Coupon.updateMany(
                    { status: 'pending', expiryDate: { $lt: new Date() } },
                    { $set: { status: 'expired' } }
                );

                // Log the number of coupons updated
                console.log(`Coupon expiration check completed. ${result.modifiedCount} coupon(s) were marked as expired.`);
            } catch (error) {
                console.error("Error during coupon expiration check:", error.message);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata" // Sets the timezone to Indian Standard Time (IST)
        });
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
