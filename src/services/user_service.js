const User = require('../utils/Models/UsersModel.js'); // Mongoose model
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

class UserService {
    constructor() {
    }

    async createUser(userDetails) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { email_id, password, user_name, role_type, phn_no } = userDetails;
            let errors = [];

            // Validate availability of user name, email, and phone number simultaneously
            const [existingUserName, existingUserEmail, existingUserPhone] = await Promise.all([
                User.findOne({ user_name }).session(session),
                User.findOne({ email_id }).session(session),
                User.findOne({ phn_no }).session(session)
            ]);

            if (existingUserName) {
                errors.push("Given user name is already in use");
            }
            if (existingUserEmail) {
                errors.push("Email ID already in use");
            }
            if (existingUserPhone) {
                errors.push("Phone number already in use");
            }

            // If any errors, throw them all at once
            if (errors.length > 0) {
                throw new Error(errors.join(", "));
            }

            // Hash the password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const currentDate = new Date().toISOString().slice(0, 10);

            // Prepare the user payload
            const userPayload = {
                user_name,
                email_id,
                password: hashedPassword,
                role_type,
                phn_no,
                date_of_signUp: currentDate
            };

            // Create the new user
            const newUser = await User.create([userPayload], { session: session });

            await session.commitTransaction();
            session.endSession();
            return newUser;
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error("Error in createUser: ", err);
            throw new Error(err.message || "An internal server error occurred");
        }
    }
}
module.exports = UserService;