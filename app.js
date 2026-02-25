require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const mongoURI = process.env.NODE_ENV === 'production' ? process.env.MONGO_URI : process.env.MONGO_URI_LOCAL;

if (process.env.NODE_ENV != 'test') {
    mongoose.connect(mongoURI, {
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 30_000,  // close idle connections after 30s
        waitQueueTimeoutMS: 5000,   // throw error if waiting time > 5s
    });
}

const basepath = '/api';

const canalRoute = require(path.resolve('.') + '/src/features/canal/canal.routes');
const userRoute = require(path.resolve('.') + '/src/features/user/user.routes');
const iotRoute = require(path.resolve('.') + '/src/features/iot/iot.routes');
const optimizationRoute = require(path.resolve('.') + '/src/features/optimization/optimization.routes');
const forecastRoute = require(path.resolve('.') + '/src/features/forecast/forecast.routes');

app.use(basepath + '/v1/canal', canalRoute);
app.use(basepath + '/v1/user', userRoute);
app.use(basepath + '/v1/iot', iotRoute);
app.use(basepath + '/v1/optimization', optimizationRoute);
app.use(basepath + '/v1/forecast', forecastRoute);

module.exports = app;