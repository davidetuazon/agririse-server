const { simpleLR } = require("../../../../src/features/iot/utils/analytics.utils");

describe('IoT Helper/Util - simpleLR', () => {
    it('should return insufficient data message when data points are less than 3', () => {
        const mockSeries = [
            {
                "timestamp": "2025-12-19T00:00:00.000Z",
                "avg": 79.8808644,
            },
            {
                "timestamp": "2026-01-13T00:00:00.000Z",
                "avg": 80.01069799999999,
            },
        ]
        const result = simpleLR(mockSeries, 'damWaterLevel');

        expect(result).toEqual({
            direction: 'insufficient data',
            message: 'Needs at least 3 data points for trend analysis'
        });
    });

    it('should detect increasing trend when data rises over time', () => {
        const mockSeries = [
            {
                "timestamp": "2025-12-19T00:00:00.000Z",
                "avg": 60.8808644,
            },
            {
                "timestamp": "2026-01-13T00:00:00.000Z",
                "avg": 70.95328473913044,
            },
            {
                "timestamp": "2026-01-15T00:00:00.000Z",
                "avg": 80.01069799999999,
            },
        ]
        const result = simpleLR(mockSeries, 'damWaterLevel');
        
        expect(result.direction).toBe('increasing');
        expect(result.confidence).toBe('high');
        expect(result.dataPoints).toBe(3);

        expect(result.slope).toBeGreaterThan(0);
        expect(result.percentChange).toBeGreaterThan(0);
        expect(result.rSquared).toBeGreaterThanOrEqual(0);
        expect(result.rSquared).toBeLessThanOrEqual(1);
        expect(result.projection).toBeGreaterThan(mockSeries[mockSeries.length - 1].avg);

        expect(result).toHaveProperty('timeSpanDays');
        expect(result).toHaveProperty('dataCompleteness');
    });

    it('should detect decreasing trend when data falls over time', () => {
        const mockSeries = [
            {
                "timestamp": "2025-12-19T00:00:00.000Z",
                "avg": 80.01069799999999,
            },
            {
                "timestamp": "2026-01-13T00:00:00.000Z",
                "avg": 70.95328473913044,
            },
            {
                "timestamp": "2026-01-15T00:00:00.000Z",
                "avg": 60.8808644,
            },
        ]
        const result = simpleLR(mockSeries, 'damWaterLevel');

        expect(result.direction).toBe('decreasing');
        expect(result.confidence).toBe('medium');
        expect(result.dataPoints).toBe(3);

        expect(result.slope).toBeLessThan(0);
        expect(result.percentChange).toBeLessThan(0);
        expect(result.rSquared).toBeGreaterThanOrEqual(0);
        expect(result.rSquared).toBeLessThanOrEqual(1);
        expect(result.projection).toBeLessThan(mockSeries[mockSeries.length - 1].avg);

        expect(result).toHaveProperty('timeSpanDays');
        expect(result).toHaveProperty('dataCompleteness');
    });

    it('should detect stable trend when data is relatively flat', () => {
        const mockSeries = [
            {
                "timestamp": "2025-12-19T00:00:00.000Z",
                "avg": 79.8808644,
            },
            {
                "timestamp": "2026-01-13T00:00:00.000Z",
                "avg": 80.01069799999999,
            },
            {
                "timestamp": "2026-01-15T00:00:00.000Z",
                "avg": 79.95328473913044,
            },
        ]
        const result = simpleLR(mockSeries, 'damWaterLevel');
        
        expect(result.direction).toBe('stable');
        expect(result.confidence).toBe('medium');
        expect(result.dataPoints).toBe(3);

        expect(Math.abs(result.slope)).toBeLessThan(0.01);
        expect(Math.abs(result.percentChange)).toBeLessThan(1);
        expect(result.rSquared).toBeGreaterThanOrEqual(0);
        expect(result.rSquared).toBeLessThanOrEqual(1);
        
        const lastValue = mockSeries[mockSeries.length - 1].avg;
        expect(result.projection).toBeCloseTo(lastValue, 0);

        expect(result).toHaveProperty('timeSpanDays');
        expect(result).toHaveProperty('dataCompleteness');
    });

    it('should trigger critical alert when change rate exceeds threshold', () => {
        const mockSeries = [
            {
                "timestamp": "2026-01-13T00:00:00.000Z",
                "avg": 80,
            },
            {
                "timestamp": "2026-01-14T00:00:00.000Z",
                "avg": 70,
            },
            {
                "timestamp": "2026-01-15T00:00:00.000Z",
                "avg": 50,
            },
        ]
        const result = simpleLR(mockSeries, 'damWaterLevel');
        
        expect(result.direction).toBe('decreasing');
        expect(result.confidence).toBe('high');
        expect(result.dataPoints).toBe(3);

        expect(Math.abs(result.slope)).toBeGreaterThan(1);
        expect(Math.abs(result.percentChange)).toBeGreaterThan(1);
        expect(result.rSquared).toBeGreaterThanOrEqual(0);
        expect(result.rSquared).toBeLessThanOrEqual(1);
        expect(result.projection).toBeLessThan(mockSeries[mockSeries.length - 1].avg);

        expect(result).toHaveProperty('timeSpanDays');
        expect(result).toHaveProperty('dataCompleteness');
        expect(result).toHaveProperty('alert');

        expect(result.alert.type).toBe('critical_change_rate');
        expect(result.alert.severity).toBe('warning');
        expect(result.alert.message).toContain(`Dam Water Level changing at ${Math.abs(result.slope).toFixed(2)}`);
    });
});