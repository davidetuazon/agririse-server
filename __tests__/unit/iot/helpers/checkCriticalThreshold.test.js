const { checkCriticalThreshold } = require('../../../../src/features/iot/utils/alerts.utils');
const AlertModel = require('../../../../src/features/iot/iot.alert.model');

const mockReading = {
    _id: '123',
    localityId: '456',
    sensorType: 'damWaterLevel',
    value: 80,
    unit: '%',
    recordedAt: new Date('2025-12-19T05:23:00.034Z')
}

const mockCriticalHighReading = {
    ...mockReading,
    value: 96,
}
const mockCriticalHighAlert = {
    localityId: mockCriticalHighReading.localityId,
    sensorType: mockCriticalHighReading.sensorType,
    severity: 'critical',
    type: 'threshold_exceeded',
    value: mockCriticalHighReading.value,
    threshold: 95,
    message: `${mockCriticalHighReading.sensorType} critically high: ${mockCriticalHighReading.value}${mockCriticalHighReading.unit}`,
    readingId: mockCriticalHighReading._id,
}

const mockCriticalLowReading = {
    ...mockReading,
    value: 15,
}
const mockCriticalLowAlert = {
    localityId: mockCriticalLowReading.localityId,
    sensorType: mockCriticalLowReading.sensorType,
    severity: 'critical',
    type: 'threshold_exceeded',
    value: mockCriticalLowReading.value,
    threshold: 20,
    message: `${mockCriticalLowReading.sensorType} critically high: ${mockCriticalLowReading.value}${mockCriticalLowReading.unit}`,
    readingId: mockCriticalLowReading._id,
}

describe('IoT Helper/Util - checkCriticalThreshold', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return an empty array for unknown sensor type', async () => {
        jest.spyOn(AlertModel, 'create').mockResolvedValue(null);
        const result = await checkCriticalThreshold({ sensorType: 'barometer' });

        expect(result).toEqual([]);
        expect(AlertModel.create).not.toHaveBeenCalled();
    });

    it('should create an alert when value exceeds critical high', async () => {
        const mockReturnedAlert = {
            _id: '098',
            ...mockCriticalHighAlert,
        }
        jest.spyOn(AlertModel, 'create').mockResolvedValue(mockReturnedAlert);

        const result = await checkCriticalThreshold(mockCriticalHighReading);

        expect(result).toEqual([mockReturnedAlert]);
        expect(AlertModel.create).toHaveBeenCalledWith({
            localityId: mockCriticalHighReading.localityId,
            sensorType: mockCriticalHighReading.sensorType,
            severity: 'critical',
            type: 'threshold_exceeded',
            value: 96,
            threshold: 95,
            message: 'damWaterLevel critically high: 96%',
            readingId: mockCriticalHighReading._id,
        });
    });

    it('should create an alert when value exceeds critical low', async () => {
        const mockReturnedAlert = {
            _id: '098',
            ...mockCriticalLowAlert,
        }
        jest.spyOn(AlertModel, 'create').mockResolvedValue(mockReturnedAlert);

        const result = await checkCriticalThreshold(mockCriticalLowReading);

        expect(result).toEqual([mockReturnedAlert]);
        expect(AlertModel.create).toHaveBeenCalledWith({
            localityId: mockCriticalLowReading.localityId,
            sensorType: mockCriticalLowReading.sensorType,
            severity: 'critical',
            type: 'threshold_exceeded',
            value: 15,
            threshold: 20,
            message: 'damWaterLevel critically low: 15%',
            readingId: mockCriticalLowReading._id,
        });
    });

    it('should return an empty array when value is in safe range', async () => {
        jest.spyOn(AlertModel, 'create').mockResolvedValue(null);

        const result = await checkCriticalThreshold(mockReading);

        expect(result).toEqual([]);
        expect(AlertModel.create).not.toHaveBeenCalled();
    });

    it('should handle null criticalLow gracefully for rainfall', async () => {
        jest.spyOn(AlertModel, 'create').mockResolvedValue(null);

        const rainfallReading = {
            _id: '789',
            localityId: '456',
            sensorType: 'rainfall',
            value: 0,  // Below criticalHigh (100), criticalLow is null
            unit: 'mm',
            recordedAt: new Date()
        }

        const result = await checkCriticalThreshold(rainfallReading);

        expect(result).toEqual([]);
        expect(AlertModel.create).not.toHaveBeenCalled();
    });
});