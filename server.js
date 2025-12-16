const app = require('./app');
require('./src/shared/services/iotCron');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server/App is listening on port ${PORT}`);
});