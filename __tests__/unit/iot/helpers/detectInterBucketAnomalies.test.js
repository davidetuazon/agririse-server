const { detectInterBucketAnomalies } = require("../../../../src/features/iot/utils/analytics.utils");

const mockSingleBucketSeries = [
    {
        "timestamp": "2026-01-14T00:00:00.000Z",
        "avg": 30.73,
    },
];

describe('IoT Helper/Util - detectInterBucketAnomalies', () => {
    it('should return the series when sensor is invalid', () => {
        const result = detectInterBucketAnomalies(mockSingleBucketSeries, 'barometer');
        
        expect(result).toHaveLength(1);
         expect(result).toEqual([
            {
                "timestamp": "2026-01-14T00:00:00.000Z",
                "avg": 30.73,
            }
        ]);
    });
    it('should return the series when series length is less than 2', () => {
        const result = detectInterBucketAnomalies(mockSingleBucketSeries, 'humidity');
        
        expect(result).toHaveLength(1);
        expect(result).toEqual([
            {
                "timestamp": "2026-01-14T00:00:00.000Z",
                "avg": 30.73,
            }
        ]);
    });

    it('should return the series when series is not an array', () => {
        const mockSeries = {
            "timestamp": "2026-01-14T00:00:00.000Z",
            "avg": 30.73,
        };
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const result = detectInterBucketAnomalies(mockSeries, 'humidity', 'daily');
        
        expect(result).toHaveLength(0);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should detect sudden changes in values between buckets', () => {
        const mockSeries = [
            {
                "timestamp": "2026-01-14T00:00:00.000Z",
                "avg": 25.73,
                "stdDev": 3.39,
                "count": 5,
            },
            {
                "timestamp": "2026-01-15T00:00:00.000Z",
                "avg": 35.69,
                "stdDev": 3.68,
                "count": 13,
            }
        ];
        const result = detectInterBucketAnomalies(mockSeries, 'humidity', 'daily');
        
        expect(result).toHaveLength(2);
        expect(result[0]).not.toHaveProperty('anomalies');

        expect(result[1].anomalies[0].type).toBe('sudden_change');
        expect(result[1].anomalies[0].severity).toBe('warning');

        const percentChange = Math.abs((mockSeries[1].avg - mockSeries[0].avg) / mockSeries[0].avg) * 100;
        expect(result[1].anomalies[0].value).toBe(percentChange);
        expect(result[1].anomalies[0].value).toBeGreaterThan(result[1].anomalies[0].threshold);

        expect(result[1].anomalies[0].message).toContain(`${percentChange.toFixed(1)}%`)
        expect(result[1].anomalies[0].message).toContain(`(${mockSeries[0].avg} → ${mockSeries[1].avg})`)
    });
    
    it('should detect data gaps between buckets', () => {
        const mockSeries = [
            {
                "timestamp": "2025-12-18T00:00:00.000Z",
                "avg": 30.67,
                "stdDev": 3.68,
                "count": 8,
            },
            {
                "timestamp": "2025-12-19T00:00:00.000Z",
                "avg": 30.73,
                "stdDev": 3.39,
                "count": 5,
            },
            {
                "timestamp": "2026-01-13T00:00:00.000Z",
                "avg": 30.65,
                "stdDev": 4.26,
                "count": 6,
            },
        ];
        const result = detectInterBucketAnomalies(mockSeries, 'humidity', 'daily');
        
        expect(result).toHaveLength(3);
        expect(result[0]).not.toHaveProperty('anomalies');
        expect(result[1]).not.toHaveProperty('anomalies');
        
        expect(result[2].anomalies[0].type).toBe('data_gap');
        expect(result[2].anomalies[0].severity).toBe('info');

        const expectedGapDays = Math.round((new Date(mockSeries[2].timestamp) - new Date(mockSeries[1].timestamp)) / (24 * 60 * 60 * 1000));
        expect(result[2].anomalies[0].value).toBe(expectedGapDays);

        expect(result[2].anomalies[0].message).toContain(`${expectedGapDays}`);
        expect(result[2].anomalies[0].message).toContain('readings may be incomplete');
    });

    it('should detect potential flatline between buckets', () => {
        const mockSeries = [
            {
                "timestamp": "2026-01-14T00:00:00.000Z",
                "avg": 30.500,
                "stdDev": 0.001,
                "count": 8,
            },
            {
                "timestamp": "2026-01-15T00:00:00.000Z",
                "avg": 30.5001,
                "stdDev": 0.001,
                "count": 8,
            },
        ];
        const result = detectInterBucketAnomalies(mockSeries, 'humidity', 'daily');

        expect(result).toHaveLength(2);
        expect(result[0]).not.toHaveProperty('anomalies');

        expect(result[1].anomalies[0].type).toBe('potential_flatline');
        expect(result[1].anomalies[0].severity).toBe('warning');

        expect(result[1].anomalies[0].value).toBe(mockSeries[1].avg);

        expect(result[1].anomalies[0].message).toContain('Sensor reading unchanged');
        expect(result[1].anomalies[0].message).toContain(`(${mockSeries[1].avg.toFixed(2)})`);
    });
});