const IoTService = require('../../../src/features/iot/iot.service');
const IoTModel = require('../../../src/features/iot/iot.model');

const mockUser = {
    _id: '123',
    email: 'flacko@test.com',
    password: 'user1234',
    role: 'admin',
    localityId: '456',
};

describe('IoT Service - getLatestReadings', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    // case 1: happy path
    it('should return readings with calculations when all sensors have 2 readings', async () => {
        const mockReading = {
            rainfall: [
                { 
                    sensorType: 'rainfall', 
                    value: 10, 
                    unit: 'mm',
                    recordedAt: new Date('2024-02-14T10:00:00'),
                    localityId: { _id: '456', city: 'TestCity', province: 'TestProvince', region: 'TestRegion' },
                    source: 'iot'
                },
                { 
                    sensorType: 'rainfall', 
                    value: 8, 
                    unit: 'mm',
                    recordedAt: new Date('2024-02-14T09:00:00'),
                    localityId: { _id: '456', city: 'TestCity', province: 'TestProvince', region: 'TestRegion' },
                    source: 'iot'
                }
            ],
        };

        jest.spyOn(IoTModel, 'find').mockImplementation((query) => {
            const sensorType = query.sensorType;
            const dataForSensor = mockReading[sensorType] || [];

            const mockPopulate = jest.fn().mockResolvedValue(dataForSensor);
            const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate });
            const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });

            return { sort: mockSort };
        });
        
        const result = await IoTService.getLatestReadings(mockUser);

        expect(result.locality).toEqual({
            _id: '456',
            city: 'TestCity',
            province: 'TestProvince',
            region: 'TestRegion'
        });

        expect(result.readings.rainfall).toEqual({
            value: 10,
            unit: 'mm',
            recordedAt: new Date('2024-02-14T10:00:00'),
            sensorType: 'Effective Rainfall',
            delta: 2,
            percentChange: 25,
            previousValue: 8,
            previousRecordedAt: new Date('2024-02-14T09:00:00'),
            timeDifferenceMinutes: 60,
        });
    });

    // case 2: Some sensors missing previous values
    it('should return readings with null deltas when sensors have only 1 reading', async () => {
        const mockReading = {
            damWaterLevel: [
                { 
                    sensorType: 'damWaterLevel', 
                    value: 15.5, 
                    unit: 'm',
                    recordedAt: new Date('2024-02-14T10:00:00'),
                    localityId: { _id: '456', city: 'TestCity', province: 'TestProvince', region: 'TestRegion' },
                    source: 'iot'
                },
            ]
        };

        jest.spyOn(IoTModel, 'find').mockImplementation((query) => {
            const sensorType = query.sensorType;
            const dataForSensor = mockReading[sensorType] || [];

            const mockPopulate = jest.fn().mockResolvedValue(dataForSensor);
            const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate });
            const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });

            return { sort: mockSort };
        });
        
        const result = await IoTService.getLatestReadings(mockUser);

        expect(result.locality).toEqual({
            _id: '456',
            city: 'TestCity',
            province: 'TestProvince',
            region: 'TestRegion'
        });

        expect(result.readings.damWaterLevel).toEqual({
            value: 15.5, 
            unit: 'm',
            recordedAt: new Date('2024-02-14T10:00:00'),
            sensorType: 'Dam Water Level',
            delta: null,
            percentChange: null,
            previousValue: null,
            previousRecordedAt: null,
            timeDifferenceMinutes: null,
        });
    });

    // case 3: division by zero
    it('should handle division by zero gracefully', async () => {
        const mockReading = {
            humidity: [
                { 
                    sensorType: 'humidity', 
                    value: 65, 
                    unit: '%',
                    recordedAt: new Date('2024-02-14T10:00:00'),
                    localityId: { _id: '456', city: 'TestCity', province: 'TestProvince', region: 'TestRegion' },
                    source: 'iot'
                },
                { 
                    sensorType: 'humidity', 
                    value: 0, 
                    unit: '%',
                    recordedAt: new Date('2024-02-14T09:00:00'),
                    localityId: { _id: '456', city: 'TestCity', province: 'TestProvince', region: 'TestRegion' },
                    source: 'iot'
                }
            ]
        };

        jest.spyOn(IoTModel, 'find').mockImplementation((query) => {
            const sensorType = query.sensorType;
            const dataForSensor = mockReading[sensorType] || [];

            const mockPopulate = jest.fn().mockResolvedValue(dataForSensor);
            const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate });
            const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });

            return { sort: mockSort };
        });
        
        const result = await IoTService.getLatestReadings(mockUser);

        expect(result.locality).toEqual({
            _id: '456',
            city: 'TestCity',
            province: 'TestProvince',
            region: 'TestRegion'
        });

        expect(result.readings.humidity).toEqual({
            value: 65, 
            unit: '%',
            recordedAt: new Date('2024-02-14T10:00:00'),
            sensorType: 'Humidity',
            delta: 65,
            percentChange: null,
            previousValue: 0,
            previousRecordedAt: new Date('2024-02-14T09:00:00'),
            timeDifferenceMinutes: 60,
        });
    });

    // case 4: no records
    it('should handle empty sensor records gracefully', async () => {
        jest.spyOn(IoTModel, 'find').mockImplementation((query) => {
            const dataForSensor = [];

            const mockPopulate = jest.fn().mockResolvedValue(dataForSensor);
            const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate });
            const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });

            return { sort: mockSort };
        });

        const result = await IoTService.getLatestReadings(mockUser);

        expect(result.locality).toBeNull();
        expect(result.readings).toEqual({});
    });
});