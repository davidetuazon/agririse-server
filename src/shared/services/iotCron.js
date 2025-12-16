const cron = require('node-cron');
const LocalityModel = require('../../features/locality/locality.model');
const IoTService = require('../../features/iot/iot.service');

// runs every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] - Generating mock sensor readings...`);

    try {
        const localities = await LocalityModel.find();

        for (const loc of localities) {
            await IoTService.generateMockReadings(loc._id);
        }

        console.log(`[${new Date().toISOString()}] - Mock sensor readings generated for all localities.`);
    } catch (e) {
        console.error('Error generating mock sensor readings: ', e);
    }
});