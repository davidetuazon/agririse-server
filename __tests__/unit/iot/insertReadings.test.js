jest.mock('../../../src/features/iot/utils/alerts.utils', () => ({
    validateData: jest.fn(),
    checkCriticalThreshold: jest.fn(),
    checkSuddenChange: jest.fn(),
}));

const IoTService = require('../../../src/features/iot/iot.service');
const IoTModel = require('../../../src/features/iot/iot.model');
const helpers = require('../../../src/features/iot/utils/alerts.utils');

const mockUser = {
    _id: '123',
    email: 'flacko@test.com',
    password: 'user1234',
    role: 'admin',
    localityId: '456',
};
const mockReading = {
    "sensorType": "damWaterLevel",
    "value": 79,
    "unit": "%",
    "recordedAt": "2026-01-15T06:00:31.028Z"
}

describe('IoT Service - insertReadings', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw 400 when sensor reading is empty', async () => {
        jest.spyOn(IoTModel, 'findOne').mockResolvedValue(null);
        jest.spyOn(IoTModel, 'create').mockResolvedValue(null);

        await expect(
            IoTService.insertReadings(null)
        ).rejects.toMatchObject({ status: 400, message: 'Sensor reading is empty' });

        expect(IoTModel.findOne).not.toHaveBeenCalled();
        expect(IoTModel.create).not.toHaveBeenCalled();
        expect(helpers.checkCriticalThreshold).not.toHaveBeenCalled();
        expect(helpers.checkSuddenChange).not.toHaveBeenCalled();
    });

    it('should return duplicate error when reading already exist for inserted timestamp', async () => {
        jest.spyOn(IoTModel, 'findOne').mockResolvedValue(mockReading);
        jest.spyOn(IoTModel, 'create').mockResolvedValue(null);

        helpers.validateData.mockReturnValue({ valid: true });
        helpers.checkCriticalThreshold.mockResolvedValue([]);
        helpers.checkSuddenChange.mockResolvedValue(null);

        const result = await IoTService.insertReadings(mockUser.localityId, [mockReading]);

        expect(result).toEqual({
            success: false,
            inserted: 0,
            failed: 1,
            results: [],
            errors: [
                {
                    sensorType: "damWaterLevel",
                    error: "Reading already exist for this timestamp"
                },
            ]
        });
        expect(IoTModel.create).not.toHaveBeenCalled();
        expect(helpers.checkCriticalThreshold).not.toHaveBeenCalled();
        expect(helpers.checkSuddenChange).not.toHaveBeenCalled();
    });

    it('should return invalid sensor type error for reading with unknown sensorType', async () => {
        const invalidReading = {
            ...mockReading,
            sensorType: 'barometer',
        }
        jest.spyOn(IoTModel, 'findOne').mockResolvedValue(null);
        jest.spyOn(IoTModel, 'create').mockResolvedValue(null);

        helpers.validateData.mockReturnValue({ valid: false, reason: 'Invalid sensor type' });
        helpers.checkCriticalThreshold.mockResolvedValue([]);
        helpers.checkSuddenChange.mockResolvedValue(null);

        const result = await IoTService.insertReadings(mockUser.localityId, [invalidReading]);

        expect(result).toEqual({
            success: false,
            inserted: 0,
            failed: 1,
            results: [],
            errors: [
                {
                    sensorType: "barometer",
                    error: "Invalid sensor type"
                },
            ]
        });
        expect(IoTModel.create).not.toHaveBeenCalled();
        expect(helpers.checkCriticalThreshold).not.toHaveBeenCalled();
        expect(helpers.checkSuddenChange).not.toHaveBeenCalled();
    });

    it('should create and include alerts in results when anomalies are detected', async () => {
        const mockAnomalousReading = {
            sensorType: "damWaterLevel",
            value: 96,
            unit: "%",
            recordedAt: "2026-01-15T06:00:31.028Z"
        };
        const mockCreatedReading = {
            _id: '678',
            localityId: mockUser.localityId,
            ...mockAnomalousReading,
        };
        jest.spyOn(IoTModel, 'findOne').mockResolvedValue(null);
        jest.spyOn(IoTModel, 'create').mockResolvedValue(mockCreatedReading);

        helpers.validateData.mockReturnValue({ valid: true });

        const mockCriticalAlert = {
            _id: 'alert1',
            localityId: mockUser.localityId,
            sensorType: 'damWaterLevel',
            severity: 'critical',
            type: 'threshold_exceeded',
            value: 96,
            threshold: 95,
            message: 'damWaterLevel critically high: 96%',
            readingId: mockCreatedReading._id,
        };
        
        const mockSuddenChangeAlert = {
            _id: 'alert2',
            localityId: mockUser.localityId,
            sensorType: 'damWaterLevel',
            severity: 'warning',
            type: 'sudden_change',
            value: 96,
            previousValue: 79,
            percentChange: 21.5,
            message: 'Sudden 21.5% change in damWaterLevel',
            readingId: mockCreatedReading._id,
        };
        helpers.checkCriticalThreshold.mockResolvedValue([mockCriticalAlert]);
        helpers.checkSuddenChange.mockResolvedValue(mockSuddenChangeAlert);

        const result = await IoTService.insertReadings(mockUser.localityId, [mockAnomalousReading]);

        expect(result).toEqual({
            success: true,
            inserted: 1,
            failed: 0,
            results: [
                {
                    reading: mockCreatedReading,
                    alerts: [mockCriticalAlert, mockSuddenChangeAlert]
                }
            ],
            errors: null,
        });
        expect(IoTModel.create).toHaveBeenCalledWith({
            localityId: '456',
            sensorType: "damWaterLevel",
            value: 96,
            unit: "%",
            recordedAt: "2026-01-15T06:00:31.028Z"
        });
    });
});