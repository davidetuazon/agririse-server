jest.mock('../../../src/cache/redis-cache.js', () => ({
    getCache:  jest.fn(),
    setCache: jest.fn()
}));
const { getCache, setCache } = require('../../../src/cache/redis-cache');

const IoTService = require('../../../src/features/iot/iot.service');
const IoTModel = require('../../../src/features/iot/iot.model');

const mockUser = {
    _id: '123',
    email: 'flacko@test.com',
    password: 'user1234',
    role: 'admin',
    localityId: '456',
};

describe('IoT Service - getHistory', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw 422 when missing query parameters', async () => {
        await expect(
            IoTService.getHistory(mockUser.localityId, 'humidity', null, null, 50)
        ).rejects.toMatchObject({ status: 422, message: 'Missing query parameters' });
    });

    it('should throw 400 when date format is invalid', async () => {
        await expect(
            IoTService.getHistory(mockUser.localityId, 'damWaterLevel', 'xyz', '123', 50)
        ).rejects.toMatchObject({ status: 400, message: 'Invalid date format' });
    });

    it('should throw 400 when end date is before start date', async () => {
        await expect(
            IoTService.getHistory(mockUser.localityId, 'rainfall', '02-15-2026', '01-15-2026', 50)
        ).rejects.toMatchObject({ status: 400, message: 'Start date must be before end date' });
    });

    it('should throw 400 when date range is too large', async () => {
        await expect(
            IoTService.getHistory(mockUser.localityId, 'temperature', '02-15-2026', '03-15-2027', 50)
        ).rejects.toMatchObject({ status: 400, message: 'Date range too large' });
    });

    it('should throw 404 when no available data for date range in database', async () => {
        getCache.mockReturnValue(null);
        const mockFind = jest.spyOn(IoTModel, 'find');
        mockFind.mockReturnValue({
            sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
            })
        });

        await expect(
            IoTService.getHistory(mockUser.localityId, 'rainfall', '02-15-2026', '03-15-2026', 50)
        ).rejects.toMatchObject({ status: 404, message: 'No available data for date range in database' });
    });

    it('should query database, cache results, and return paginated data on cache miss', async () => {
        getCache.mockReturnValue(null);
        const mockDocs = [
            { _id: 'id1', value: 10, recordedAt: new Date('2024-02-15T10:00:00') },
            { _id: 'id2', value: 8, recordedAt: new Date('2024-02-15T09:00:00') },
            { _id: 'id3', value: 6, recordedAt: new Date('2024-02-15T08:00:00') },
            { _id: 'id4', value: 4, recordedAt: new Date('2024-02-15T07:00:00') }
        ];

        const mockFind = jest.spyOn(IoTModel, 'find');
        mockFind.mockReturnValue({
            sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockDocs)
            })
        });

        const result = await IoTService.getHistory(mockUser.localityId, 'rainfall', '2024-02-15', '2024-02-16', 2, 0);

        expect(result).toEqual({
            data: [
                { _id: 'id1', value: 10, recordedAt: new Date('2024-02-15T10:00:00') },
                { _id: 'id2', value: 8, recordedAt: new Date('2024-02-15T09:00:00') },
            ],
            meta: {
                sensorType: 'Effective Rainfall',
                unit: 'mm',
                dateRange: {
                    fromDate: new Date('2024-02-15T00:00:00.000Z'),
                    toDate: new Date('2024-02-16T23:59:59.999Z'),
                }
            },
            pageInfo: {
                hasNext: true,
                nextCursor: 2,
            }
        });
    });

    it('should use cached data and skip database query on cache hit', async () => {
        const mockCachedData = {
            docs: [
                { _id: 'id1', value: 85, recordedAt: new Date('2024-02-15T10:00:00') },
                { _id: 'id2', value: 80, recordedAt: new Date('2024-02-15T09:00:00') },
                { _id: 'id3', value: 60, recordedAt: new Date('2024-02-15T08:00:00') },
                { _id: 'id4', value: 40, recordedAt: new Date('2024-02-15T07:00:00') }
            ],
            meta: {
                sensorType: 'Dam Water Level',
                unit: '%',
                dateRange: {
                    fromDate: new Date('2024-02-15T00:00:00.000Z'),
                    toDate: new Date('2024-02-16T23:59:59.999Z'),
                }
            }
        };

        getCache.mockReturnValue(mockCachedData);
        const mockFind = jest.spyOn(IoTModel, 'find');

        const result = await IoTService.getHistory(mockUser.localityId, 'damWaterLevel', '2024-02-15', '2024-02-16', 2, 0);

        expect(result).toEqual({
            data: [
                { _id: 'id1', value: 85, recordedAt: new Date('2024-02-15T10:00:00') },
                { _id: 'id2', value: 80, recordedAt: new Date('2024-02-15T09:00:00') },
            ],
            meta: {
                sensorType: 'Dam Water Level',
                unit: '%',
                dateRange: {
                    fromDate: new Date('2024-02-15T00:00:00.000Z'),
                    toDate: new Date('2024-02-16T23:59:59.999Z'),
                }
            },
            pageInfo: {
                hasNext: true,
                nextCursor: 2,
            }
        });
        expect(mockFind).not.toHaveBeenCalled();
        expect(setCache).not.toHaveBeenCalled();
    });
});