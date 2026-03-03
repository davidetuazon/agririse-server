const { validateData } = require('../../../../src/features/iot/utils/alerts.utils');

describe('IoT Helper/Util - ValidateData', () => {
    it('should return invalid for unknown sensor type', () => {
        const result = validateData(50, 'barometer');

        expect(result).toEqual({
            valid: false,
            reason: 'Invalid sensor type'
        });
    });

    test.each([
        ['damWaterLevel', -1, 0],
        ['rainfall', -1, 0],
        ['humidity', -5, 0],
        ['temperature', -11, -10],
    ])('should return invalid for sensor (%s) with value BELOW absolute minimum', (sensorType, value, min) => {
        const result = validateData(value, sensorType);

        expect(result).toEqual({
            valid: false,
            reason: `Value ${value} below minimum ${min}`,
        });
    });

    test.each([
        ['damWaterLevel', 101, 100],
        ['rainfall', 501, 500],
        ['humidity', 101, 100],
        ['temperature', 51, 50],
    ])('should return invalid for sensor (%s) with value ABOVE absolute maximum', (sensorType, value, max) => {
        const result = validateData(value, sensorType);

        expect(result).toEqual({
            valid: false,
            reason: `Value ${value} above maximum ${max}`,
        });
    });

    test.each([
        ['damWaterLevel', 70],
        ['rainfall', 50],
        ['humidity', 10],
        ['temperature', 27],
    ])('should return valid for sensor (%s) with value WITHIN range',
    (sensorType, value) => {
        const result = validateData(value, sensorType);

        expect(result.valid).toBe(true);
    });
});