const { checkSuddenChange } = require('../../../../src/features/iot/utils/alerts.utils');
const IoTModel = require('../../../../src/features/iot/iot.model');
const AlertModel = require('../../../../src/features/iot/iot.alert.model');

const mockReading = {
    _id: '123',
    localityId: '456',
    sensorType: 'damWaterLevel',
    value: 65,
    unit: '%',
    recordedAt: new Date('2025-12-20T05:23:00.034Z')
}
const mockPreviousReading = {
    _id: '123',
    localityId: '456',
    sensorType: 'damWaterLevel',
    value: 80,
    unit: '%',
    recordedAt: new Date('2025-12-19T05:23:00.034Z')
}

const mockAlert = {
    localityId: mockReading.localityId,
    sensorType: mockReading.sensorType,
    severity: 'warning',
    type: 'sudden_change',
    value: mockReading.value,
    previousValue: mockPreviousReading.value,
    percentChange: 15,
    message: `Sudden 15% change in ${mockReading.sensorType}`,
    readingId: mockReading._id,
}

describe('IoT Helper/Util - checkSuddenChange', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return null for unknown sensor type', async () => {
        const mockSort = jest.fn().mockResolvedValue(null);
        jest.spyOn(IoTModel, 'findOne').mockReturnValue({ sort: mockSort });
        jest.spyOn(AlertModel, 'create').mockResolvedValue(null);

        const invalidReading = {
            ...mockReading,
            sensorType: 'barometer'
        }

        const result = await checkSuddenChange(invalidReading);

        expect(result).toBeNull();
        expect(IoTModel.findOne).not.toHaveBeenCalled();
        expect(AlertModel.create).not.toHaveBeenCalled();
    });

    it('should return null when there is no previous reading', async () => {
        const mockSort = jest.fn().mockResolvedValue(null);
        jest.spyOn(IoTModel, 'findOne').mockReturnValue({ sort: mockSort });
        jest.spyOn(AlertModel, 'create').mockResolvedValue(null);

        const result = await checkSuddenChange(mockReading);

        expect(result).toBeNull();
        expect(IoTModel.findOne).toHaveBeenCalledWith({
            localityId: mockReading.localityId,
            sensorType: mockReading.sensorType,
            _id: { $ne: mockReading._id },
            recordedAt: { $lt: mockReading.recordedAt }
        });
        expect(mockSort).toHaveBeenCalledWith({ recordedAt: -1 });
        expect(AlertModel.create).not.toHaveBeenCalled();
    });

    it('should create an alert when percent change exceeds limit', async () => {
        const mockReturnedAlert = {
            ...mockAlert,
            _id: '678',
        };

        const mockSort = jest.fn().mockResolvedValue(mockPreviousReading);
        jest.spyOn(IoTModel, 'findOne').mockReturnValue({ sort: mockSort });
        jest.spyOn(AlertModel, 'create').mockResolvedValue(mockReturnedAlert);

        const result = await checkSuddenChange(mockReading);

        expect(result).toEqual(mockReturnedAlert);
        expect(IoTModel.findOne).toHaveBeenCalledWith({
            localityId: mockReading.localityId,
            sensorType: mockReading.sensorType,
            _id: { $ne: mockReading._id },
            recordedAt: { $lt: mockReading.recordedAt }
        });
        expect(mockSort).toHaveBeenCalledWith({ recordedAt: -1 });
        expect(AlertModel.create).toHaveBeenCalledWith({
            localityId: mockReading.localityId,
            sensorType: mockReading.sensorType,
            severity: 'warning',
            type: 'sudden_change',
            value: 65,
            previousValue: 80,
            percentChange: 18.75,
            message: `Sudden 18.8% change in damWaterLevel`,
            readingId: mockReading._id,
        });
    });

    it('should handle division by zero gracefully when previous value is 0 and return null', async () => {
        const zeroPreviousReading = {
            ...mockPreviousReading,
            value: 0,
        }
        const currentReading = {
            ...mockReading,
            value: 50,
        }

        const mockSort = jest.fn().mockResolvedValue(zeroPreviousReading);
        jest.spyOn(IoTModel, 'findOne').mockReturnValue({ sort: mockSort });
        jest.spyOn(AlertModel, 'create').mockReturnValue(null);

        const result = await checkSuddenChange(currentReading);

        expect(result).toBeNull();
        expect(AlertModel.create).not.toHaveBeenCalled();
    });

    it('should return null when value is in safe range', async () => {
        const safeReading = {
            ...mockReading,
            value: 79,
        }

        const mockSort = jest.fn().mockResolvedValue(mockPreviousReading);
        jest.spyOn(IoTModel, 'findOne').mockReturnValue({ sort: mockSort });
        jest.spyOn(AlertModel, 'create').mockReturnValue(null);

        const result = await checkSuddenChange(safeReading);

        expect(result).toBeNull();
        expect(IoTModel.findOne).toHaveBeenCalledWith({
            localityId: safeReading.localityId,
            sensorType: safeReading.sensorType,
            _id: { $ne: safeReading._id },
            recordedAt: { $lt: safeReading.recordedAt }
        });
        expect(mockSort).toHaveBeenCalledWith({ recordedAt: -1 });
        expect(AlertModel.create).not.toHaveBeenCalled();
    });
});