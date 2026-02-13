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
            localityId: user.localityId,
            email: user.email,
            _id: user._id,
        };
    } catch (e) {
        throw (e);
    }
}

exports.changePassword = async (userId, updates) => {
    if (!updates) throw { status: 422, message: 'Missing request body' };

    try {
        const user = await UserModel.findById(userId);
        if (!user) throw { status: 404, message: 'User not found' };

        const isMatched = await bcrypt.compare(updates.oldPassword, user.password);
        if (!isMatched) throw { status: 401, message: 'Old password is incorrect' };

        const hashed = await bcrypt.hash(updates.newPassword, 16);
        const updatedUser = await UserModel.findByIdAndUpdate(user._id, { password: hashed }, { new: true });
        if (!updatedUser) throw { status: 404, message: 'User not found. Update is unsuccessful' };

        return {
            localityId: updatedUser.localityId,
            email: updatedUser.email,
            role: updatedUser.role,
            _id: updatedUser._id,
        }
    } catch (e) {
        throw (e);
    }
}