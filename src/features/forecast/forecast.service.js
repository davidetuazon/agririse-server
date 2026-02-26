const LocalityModel = require('../locality/locality.model');
const IoTModel = require('../iot/iot.model');
const IoTService = require('../iot/iot.service');
const { getDates } = require('./utils/forecast.utils');


exports.triggerForecast = async (localityId) => {
    const date = `${getDates().year}-${getDates().month}`;

    let locality;
    if (!localityId) {
        locality = await LocalityModel.findOne();
        if (!locality) throw { status: 404, message: 'No locality found. Cannot trigger forecast' };

        localityId = locality._id;
    }

    fetch(process.env.FORECAST_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date,
            localityId
        })
    }).catch(err => {
        console.error(err);
    });

    return;
}

exports.receiveAndProcessCallback = async (result) => {
    if (!result) throw { status: 400, message: 'Missing response from forecasting service' };

    if (result.status !== 'failed') {
        if (!Array.isArray(result.forecast) || result.forecast.length === 0) throw { status: 400, message: 'Invalid or missing forecast data in payload' };
    }
    if (result.status === 'failed') return { success: result.status, message: 'Forecasting service failed' };

    const insertStatus = await IoTService.insertReadings(result.localityId, result.forecast);
    if (!insertStatus.success) throw { status: 400, message: 'Failed to save forecasts' };

    return insertStatus;
}

exports.getStatus = async (localityId) => {
    const startDate = new Date(`${getDates().year}-${getDates().month}-01T00:00:00.000Z`);
    const endDate = new Date(`${getDates().year}-${getDates().month}-${getDates().lastDay}T23:59:59.999Z`);

    const filter = {
        localityId,
        recordedAt: {
            $gte: startDate,
            $lte: endDate,
        },
        source: 'forecast',
    };
    const docsCount = await IoTModel.countDocuments(filter);

    return {
        exists: docsCount >= 28,
        forecastRange: {
            year: getDates().year,
            month: Number(getDates().month),
        }
    };
}

exports.getData = async (localityId) => {
    const startDate = new Date(`${getDates().year}-${getDates().month}-01T00:00:00.000Z`);
    const endDate = new Date(`${getDates().year}-${getDates().month}-${getDates().lastDay}T23:59:59.999Z`);

    const filter = {
        localityId,
        recordedAt: {
            $gte: startDate,
            $lte: endDate,
        },
        source: 'forecast',
    };

    const forecasts = await IoTModel.find(filter).lean();
    if (forecasts.length === 0) throw { status: 404, message: 'Forecast data not found' };

    const reshapedForecasts = forecasts.reduce((acc, item) => {
        if (!acc[item.sensorType]) acc[item.sensorType] = [];
        acc[item.sensorType].push({ 
            value: item.value,
            unit: item.unit,
            source: item.source,
            sensorType: item.sensorType,
            recordedAt: item.recordedAt,
        });

        return acc;
    }, {});

    return reshapedForecasts;
}
