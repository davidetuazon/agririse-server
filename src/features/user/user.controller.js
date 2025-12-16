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
            email: user.email,
            _id: user._id,
            localityId: user.localityId,
        }

        const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });

        res.send({ accessToken });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}