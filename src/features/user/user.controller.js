require('dotenv').config({ quiet: true });
const jwt = require('jsonwebtoken');
const validate = require('validate.js');
const constraints = require('./user.validation');
const UserService = require('./user.service');

exports.login = async (req, res, next) => {
    const params = {...req.body};
    const issues = validate(params, constraints.signIn);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const user = await UserService.signIn(params);

        const payload = {
            localityId: user.localityId,
            email: user.email,
            _id: user._id,
            
        }

        const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });

        res.send({ accessToken });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.changeAccountPassword = async (req, res, next) => {
    const params = {...req.body};
    const issues = validate(params, constraints.passwordChange);
    if (issues) return res.status(422).json({ error: issues });

    if (params.oldPassword === params.newPassword) return res.status(409).json({ error: 'New password must be different from current password' });

    try {
        const updatedUser = await UserService.changePassword(req.user._id, params);

        res.status(201).json({ success: true, message: 'Password updated successfully', user: updatedUser });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}