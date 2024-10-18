const DashboardUserModel = require('../utils/Models/dashboardUserModel');
const JWTHelper = require('../utils/Helpers/jwt_helper')
const bcrypt = require('bcrypt');

class DashboardService {
    constructor() {
        this.DashboardUserModel = DashboardUserModel;
        this.jwtObject = new JWTHelper();
    }

    // Service function for forgot password
    async forgotPassword(userDetails, session) {
        try {
            // Check if the user exists by email
            const userData = await DashboardUserModel.findOne({ email: userDetails.email }).session(session);

            if (!userData) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("No user exists with the given email");
            }

            // Generate a JWT token with user ID for password reset, expires in 1 hour
            const tokenPayload = userData._id + ":" + userData.name;
            const resetToken = await this.jwtObject.generateAccessToken(tokenPayload);

            // Generate password reset URL
            const resetUrl = `${process.env.RESET_PASSWORD_DASHBOARD_ROUTE}?token=${resetToken}`;

            // Send reset email using Nodemailer
            await this.sendResetEmail(userDetails.email, resetUrl, userDetails.name, userDetails.phoneNumber, userDetails.roleType);

            return { message: "Password reset email sent successfully to admin." };
        } catch (err) {
            console.error("Error in forgotPassword with transaction: ", err.message);
            throw err;
        }
    }

    // Function to send reset password email
    async sendResetEmail(toEmail, resetUrl, userName, phoneNumber, roleType) {
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
            html: `
            <p><strong>Password Reset Request</strong></p>
            <p><strong>User Details:</strong></p>
            <ul>
                <li><strong>Name:</strong> ${userName}</li>
                <li><strong>Email:</strong> ${toEmail}</li>
                <li><strong>Phone Number:</strong> ${phoneNumber}</li>
                <li><strong>Role Type:</strong> ${roleType}</li>
            </ul>
            <p>They requested a password reset. Click the link below to reset their password:</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p>If this was not requested by the user, please ignore this email.</p>
        `
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
            await DashboardUserModel.updateOne(
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