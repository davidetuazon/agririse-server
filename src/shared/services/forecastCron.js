require('dotenv').config({ quiet: true });
const cron = require('node-cron');
const ForecastService = require('../../features/forecast/forecast.service');

// runs at midnight on the 1st of every month
cron.schedule('0 0 1 * *', async () => {
    console.log(`[${new Date().toISOString()}] - Scheduled forecast call triggered.`);

    try {
        await ForecastService.triggerForecast(process.env.CUYAPO_LOCALITY_ID);
    } catch (e) {
        console.error('Scheduled forecast call trigger failed: ', e);
    }
});