const UserModel = require('./user.model');
const bcrypt = require('bcryptjs');

exports.signIn = async (params) => {
    if (!params) throw { status: 422, message: 'Missing request body' };

    try {
        const user = await UserModel.findOne({
            deleted: false,
            email: params.email,
        })

        if (!user) throw { status: 404, message: 'User not found' };

        const matched = await bcrypt.compare(params.password, user.password);
        if (!matched) throw { status: 401, message: 'Incorrect password' };

        await UserModel.findByIdAndUpdate(user._id, { lastLogin: new Date() });

        return {
            email: user.email,
            id: user._id,
        };
    } catch (e) {
        throw (e);
    }
}