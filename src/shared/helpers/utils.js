require('dotenv').config({ quiet: true });
const jwt = require('jsonwebtoken');
const UserModel = require('../../features/user/user.model');
const CONSTANTS = require('./constants');

const authenticate = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const loggedUser = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        req.user = await UserModel.findOne({ deleted: false, email: loggedUser.email }).select(CONSTANTS.USER_FIELD);
        if (!req.user) return res.status(404).json({ error: 'User not found' });
        
        next();
    } catch (e) {
        return res.status(403).json({ error: 'Invalid / Expired token' });
    }
}

const authenticateService = (req, res, next) => {
    console.log('Python Microservice Authentication Triggered');
    const authKey = req.headers['x-api-key'];
    if (!authKey) return res.status(401).json({ error: 'Unauthorized' });

    if (authKey !== process.env.API_SHARED_KEY) return res.status(403).json({ error: 'Forbidden' });

    next();
}

module.exports = {
    authenticate,
    authenticateService,
}