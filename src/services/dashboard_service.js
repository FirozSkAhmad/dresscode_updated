const UserModel = require('../utils/Models/userModel');
const OrderModel = require('../utils/Models/orderModel');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const mongoose = require('mongoose');
const JWTHelper = require('../utils/Helpers/jwt_helper')
const bcrypt = require('bcrypt');
const colorCodes = require('../utils/Helpers/data');
const modelMap = {
    "HEAL": HealModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
};

class DashboardService {
    constructor() {
        this.UserModel = UserModel;
        this.jwtObject = new JWTHelper();
    }

    // Service function for forgot password
    async forgotPassword(userDetails, session) {
        try {
            // Check if the user exists by email
            const userData = await UserModel.findOne({ email: userDetails.email }).session(session);

            if (!userData) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("No user exists with the given email");
            }

            // Generate a JWT token with user ID for password reset, expires in 1 hour
            const tokenPayload = userData._id + ":" + userData.name;
            const resetToken = await this.jwtObject.generateAccessToken(tokenPayload);

            // Generate password reset URL
            const resetUrl = `${process.env.RESET_PASSWORD_DASHBOARD_ROUTE}?token=${resetToken}`;

            // Send reset email using Nodemailer
            await this.sendResetEmail(userDetails.email, resetUrl);

            return { message: "Password reset email sent successfully to admin." };
        } catch (err) {
            console.error("Error in forgotPassword with transaction: ", err.message);
            throw err;
        }
    }

    // Function to send reset password email
    async sendResetEmail(toEmail, resetUrl) {
        const nodemailer = require('nodemailer');

        // Create transporter object using SMTP transport
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SENDER_EMAIL_ID,  // your admin email
                pass: process.env.SENDER_PASSWORD // your admin password
            }
        });

        // Email content
        const mailOptions = {
            from: process.env.SENDER_EMAIL_ID,
            to: process.env.ADMIN_EMAIL_ID,
            subject: 'Password Reset Request',
            html: `<p>You requested a password reset. Click the link below to reset your password:</p>
               <a href="${resetUrl}">${resetUrl}</a>
               <p>If you did not request this, please ignore this email.</p>`
        };

        // Send email
        await transporter.sendMail(mailOptions);
    }


    async resetPassword(token, newPassword, session) {
        try {
            // Verify the JWT token to get user ID
            const decodedToken = await new Promise((resolve, reject) => {
                global.DATA.PLUGINS.jsonwebtoken.verify(token, process.env.ACCESS_TOKEN_SECRETKEY, (err, decoded) => {
                    if (err) reject(new global.DATA.PLUGINS.httperrors.Unauthorized("Token Invalid/Expired"));
                    resolve(decoded);
                });
            });
            const userId = decodedToken.aud.split(":")[0];
    
            // Validate new password
            if (!newPassword || typeof newPassword !== 'string') {
                throw new Error("New password is required and must be a valid string.");
            }
    
            // Hash the password
            const salt = await bcrypt.genSalt(10);
            if (!salt) {
                throw new Error("Failed to generate salt.");
            }
            console.log('Salt:', salt);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
    
            // Update the user's password
            await UserModel.updateOne(
                { _id: userId },
                { $set: { password: hashedPassword } },
                { session: session }
            );
    
            return { message: "Password successfully updated" };
        } catch (err) {
            console.error("Error in resetPassword with transaction: ", err.message);
            throw err;
        }
    }    

}

module.exports = DashboardService;