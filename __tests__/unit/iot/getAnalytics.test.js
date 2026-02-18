jest.mock('../../../src/cache/redis-cache.js', () => ({
    getCache:  jest.fn(),
    setCache: jest.fn()
}));
const { getCache, setCache } = require('../../../src/cache/redis-cache');

jest.mock('../../../src/features/iot/utils/analytics.utils.js', () => ({
    simpleLR: jest.fn(),
    detectIntraBucketAnomalies: jest.fn(),
    detectInterBucketAnomalies: jest.fn(),
}));
const { simpleLR, detectIntraBucketAnomalies, detectInterBucketAnomalies } = require("../../../src/features/iot/utils/analytics.utils");

const IoTService = require('../../../src/features/iot/iot.service');
const IoTModel = require('../../../src/features/iot/iot.model');

const mockUser = {
    _id: '123',
    email: 'flacko@test.com',
    password: 'user1234',
    role: 'admin',
    localityId: '456',
};

describe('IoT Service - getAnalytics', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw 422 when missing query parameters', async () => {
        await expect(
            IoTService.getAnalytics(mockUser.localityId, 'humidity', null, null, 50)
        ).rejects.toMatchObject({ status: 422, message: 'Missing query parameters' });
    });

    it('should throw 400 when date format is invalid', async () => {
        await expect(
            IoTService.getAnalytics(mockUser.localityId, 'damWaterLevel', 'xyz', '123', 50)
        ).rejects.toMatchObject({ status: 400, message: 'Invalid date format' });
    });

    it('should throw 400 when end date is before start date', async () => {
        await expect(
            IoTService.getAnalytics(mockUser.localityId, 'rainfall', '02-15-2026', '01-15-2026', 50)
        ).rejects.toMatchObject({ status: 400, message: 'Start date must be before end date' });
    });

    it('should throw 400 when date range is too large', async () => {
        await expect(
            IoTService.getAnalytics(mockUser.localityId, 'temperature', '02-15-2026', '03-15-2027', 50)
        ).rejects.toMatchObject({ status: 400, message: 'Date range too large' });
    });

    it('should throw 404 when no available data for date range in database', async () => {
        getCache.mockReturnValue(null);
        const mockAggregate = jest.spyOn(IoTModel, 'aggregate');
        mockAggregate.mockReturnValue({
            exec: jest.fn().mockResolvedValue(null)
        });

        await expect(
            IoTService.getAnalytics(mockUser.localityId, 'rainfall', '02-15-2026', '03-15-2026', 50)
        ).rejects.toMatchObject({ status: 404, message: 'No available data for date range in database' });
    });

    it('should return cached analytics data when cache it', async () => {
        const mockCachedAnalytics = {
            series: [
                {
                    "timestamp": "2025-12-19T00:00:00.000Z",
                    "total": 399.404322,
                    "avg": 79.8808644,
                    "min": 79.407388,
                    "max": 80.300604,
                    "stdDev": 0.3949567112036505,
                    "variance": 0.15599080372480378,
                    "median": 79.923934,
                    "percentile25": 79.553264,
                    "percentile75": 80.219132,
                    "count": 5,
                    "anomalies": []
                },
            ],
            trend: {
                direction: 'insufficient data',
                message: 'Needs at least 3 data points for trend analysis'
            },
            anomalies: {
                "total": 0,
                "critical": 0,
                "warning": 0,
                "info": 0,
            },
            meta: {
                "dateRange": {
                    "startDate": "2025-12-19T00:00:00.000Z",
                    "endDate": "2026-01-15T23:59:59.999Z"
                },
                "granularity": "daily",
                "unit": "%",
                "sensorType": "Dam Water Level",
                "metric": "average"
            }
        };

        getCache.mockReturnValue(mockCachedAnalytics);

        const result = await IoTService.getAnalytics(mockUser.localityId, 'damWaterLevel', '2025-12-19', '2026-01-15');
        
        expect(result).toEqual(mockCachedAnalytics);
        expect(IoTModel.aggregate).not.toHaveBeenCalled();
        expect(setCache).not.toHaveBeenCalled();
    });

    it('should return analytics when cache miss', async () => {
        getCache.mockReturnValue(null);

        const mockAggregateResults = [
            {
                bucket: new Date('2026-01-13T00:00:00.000Z'),
                total: 153.65,
                avg: 30.73,
                min: 26.6,
                max: 35.13,
                stdDev: 3.39,
                values: [26.6, 28.8, 30.73, 32.9, 35.13],
                count: 5,
            },
        ];

        IoTModel.aggregate.mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockAggregateResults)
        });

        simpleLR.mockReturnValue({
            direction: 'insufficient data',
            message: 'Needs at least 3 data points for trend analysis'
        });
        detectIntraBucketAnomalies.mockReturnValue([]);
        detectInterBucketAnomalies.mockReturnValue(mockAggregateResults);

        const result = await IoTService.getAnalytics(mockUser.localityId, 'damWaterLevel', '2025-12-19', '2026-01-15');

        expect(result).toHaveProperty('series');
        expect(result).toHaveProperty('trend');
        expect(result).toHaveProperty('anomalies');
        expect(result).toHaveProperty('meta');

        expect(result.series).toHaveLength(1);
        expect(result.series[0]).toHaveProperty('timestamp');
        expect(result.series[0]).toHaveProperty('avg');
        expect(result.series[0]).toHaveProperty('median');

        expect(simpleLR).toHaveBeenCalledWith(expect.any(Array), 'damWaterLevel');
        expect(detectIntraBucketAnomalies).toHaveBeenCalled();
        expect(detectInterBucketAnomalies).toHaveBeenCalledWith(expect.any(Array), 'damWaterLevel', 'daily');

        expect(setCache).toHaveBeenCalledWith(
            expect.stringContaining('analytics_damWaterLevel'),
            expect.objectContaining({ series: expect.any(Array) })
        );

        expect(result.anomalies.total).toBe(0);
    });
});