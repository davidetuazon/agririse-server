const express = require('express');
const router = express.Router();

const canalController = require('./canal.controller');
const utils = require('../../shared/helpers/utils');

router.get('/overview', utils.authenticate, canalController.getOverview);

module.exports = router;