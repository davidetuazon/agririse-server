const { detectIntraBucketAnomalies } = require("../../../../src/features/iot/utils/analytics.utils");

describe('IoT Helper/Util - detectIntraBucketAnomalies', () => {
    it('should return an empty array for invalid sensor', () => {
        const mockBucket = {
            "timestamp": "2025-12-19T00:00:00.000Z",
            "avg": 79.8808644,
        };
        const result = detectIntraBucketAnomalies(mockBucket, 'barometer');

        expect(result).toHaveLength(0);
    });

    // case: statistical outliers
    // Test 1: Only triggers outlier HIGH
    it('should detect statistical outlier anomaly when max exceeds upper bound', () => {
        const mockBucket = {
            "timestamp": "2026-01-11T00:00:00.000Z",
            "avg": 79.88,
            "min": 79.50,
            "max": 82.30,
            "stdDev": 0.39,
            "count": 5,
        };
        const result = detectIntraBucketAnomalies(mockBucket, 'damWaterLevel');

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('statistical_outlier_high');
        expect(result[0].severity).toBe('warning');

        expect(result[0].value).toBe(mockBucket.max);
        expect(result[0].value).toBeGreaterThan(result[0].threshold);

        expect(result[0].message).toContain(mockBucket.max.toFixed(2));
        expect(result[0].message).toContain(result[0].threshold.toFixed(2));
    });

    // Test 2: Only triggers outlier LOW
    it('should detect statistical outlier anomaly when min exceeds lower bound', () => {
        const mockBucket = {
            "timestamp": "2026-01-11T00:00:00.000Z",
            "avg": 79.88,
            "min": 77.51,
            "max": 80.30,
            "stdDev": 0.39,
            "count": 5,
        };
        const result = detectIntraBucketAnomalies(mockBucket, 'damWaterLevel');
        
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('statistical_outlier_low');
        expect(result[0].severity).toBe('warning');

        expect(result[0].value).toBe(mockBucket.min);
        expect(result[0].value).toBeLessThan(result[0].threshold);

        expect(result[0].message).toContain(mockBucket.min.toFixed(2));
        expect(result[0].message).toContain(result[0].threshold.toFixed(2));
    });

    // case: abs physical limits
    // Test 1: Only triggers physical MAX
    it('should detect physical limit anomaly when max exceeds absolute maximum', () => {
        const mockBucket = {
            "timestamp": "2026-01-11T00:00:00.000Z",
            "avg": 79.88,
            "min": 77.51,
            "max": 101.30,
            "stdDev": 9,
            "count": 8,
        };
        const result = detectIntraBucketAnomalies(mockBucket, 'damWaterLevel');

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('physical_limit_exceeded');
        expect(result[0].severity).toBe('warning');

        expect(result[0].value).toBe(mockBucket.max);
        expect(result[0].value).toBeGreaterThan(result[0].threshold);

        expect(result[0].message).toContain(mockBucket.max.toFixed(2));
        expect(result[0].message).toContain(`(${result[0].threshold})`);
    });

    // Test 2: Only triggers physical MIN
    it('should detect physical limit anomaly when min exceeds absolute minimum', () => {
        const mockBucket = {
            "timestamp": "2026-01-11T00:00:00.000Z",
            "avg": 5,
            "min": -11,
            "max": 20,
            "stdDev": 6,
            "count": 8,
        };
        const result = detectIntraBucketAnomalies(mockBucket, 'temperature');

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('physical_limit_exceeded');
        expect(result[0].severity).toBe('warning');

        expect(result[0].value).toBe(mockBucket.min);
        expect(result[0].value).toBeLessThan(result[0].threshold);

        expect(result[0].message).toContain(mockBucket.min.toFixed(2));
        expect(result[0].message).toContain(`(${result[0].threshold})`);
    });

    // case: critical thresholds
    // Test 1: only triggers critical HIGH
    it('should detect critical threshold anomaly when avg exceeds critical high', () => {
        const mockBucket = {
            "timestamp": "2026-01-11T00:00:00.000Z",
            "avg": 96.1,
            "min": 77.3,
            "max": 96.1,
            "stdDev": 7,
            "count": 8,
        };
        const result = detectIntraBucketAnomalies(mockBucket, 'humidity');
        
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('critical_high_threshold');
        expect(result[0].severity).toBe('warning');

        expect(result[0].value).toBe(mockBucket.avg);
        expect(result[0].value).toBeGreaterThan(result[0].threshold);

        expect(result[0].message).toContain(mockBucket.avg.toFixed(2));
        expect(result[0].message).toContain(`(${result[0].threshold})`);
    });

    // Test 2: only triggers critical LOW
    it('should detect critical threshold anomaly when avg exceeds critical low', () => {
        const mockBucket = {
            "timestamp": "2026-01-11T00:00:00.000Z",
            "avg": 9.13,
            "min": 9.13,
            "max": 23.68,
            "stdDev": 11,
            "count": 8,
        };
        const result = detectIntraBucketAnomalies(mockBucket, 'humidity');
        
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('critical_low_threshold');
        expect(result[0].severity).toBe('warning');

        expect(result[0].value).toBe(mockBucket.avg);
        expect(result[0].value).toBeLessThan(result[0].threshold);

        expect(result[0].message).toContain(mockBucket.avg.toFixed(2));
        expect(result[0].message).toContain(`(${result[0].threshold})`);
    });

    // case: high variability
    it('should detect high variability anomaly', () => {
        const mockBucket = {
            "timestamp": "2026-01-11T00:00:00.000Z",
            "avg": 50.88,
            "min": 39.01,
            "max": 69.30,
            "stdDev": 8.03,
            "count": 11,
        };
        const result = detectIntraBucketAnomalies(mockBucket, 'humidity');

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('high_variability');
        expect(result[0].severity).toBe('info');

        const variability = (mockBucket.stdDev / mockBucket.avg) * 100
        expect(result[0].value).toBe(variability);
        expect(result[0].value).toBeGreaterThan(result[0].threshold);

        expect(result[0].message).toContain('High variability detected');
        expect(result[0].message).toContain(`(CV: ${variability.toFixed(1)}%)`);
    });

    it('should return an empty array when no anomalies detected', () => {
        const mockBucket = {
            "timestamp": "2025-12-19T00:00:00.000Z",
            "avg": 30.73,
            "min": 26.6,
            "max": 35.13,
            "stdDev": 3.3906783981970325,
            "count": 5,
        };
        const result = detectIntraBucketAnomalies(mockBucket, 'temperature');
        
        expect(result).toHaveLength(0);
    });
});