const express = require('express');
const router = express.Router();

const userController = require('./user.controller');
const utils = require('../../shared/helpers/utils');

router.post('/login', userController.login);

router.get('/me', utils.authenticate, async (req, res, next) => {
    try {
        res.send(req.user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    };
});

module.exports = router;