const { SENSOR_META, SENSOR_TREND_CONFIG, SENSOR_ANOMALY_CONFIG, MIN_DATA_POINTS } = require('./constants');

// simple trend analysis
const simpleLR = (series, sensorType) => {
    // require at least 3 data buckets for more meaningful calculations
    if (series.length < MIN_DATA_POINTS) return { 
            direction: 'insufficient data', 
            message: `Needs at least ${MIN_DATA_POINTS} data points for trend analysis`
        };

    const n = series.length;
    const config = SENSOR_TREND_CONFIG[sensorType] || {
        slopeThresholdPercent: 1.0,
        criticalChangeRate: 5.0
    };

    const firstBucket = new Date(series[0].timestamp).getTime();
    const xValues = series.map(s => (new Date(s.timestamp).getTime() - firstBucket) / (1000 * 60 * 60 * 24));
    const yValues = series.map(s => s.avg);

    const sumX = xValues.reduce((a,b) => a + b, 0);
    const sumY = yValues.reduce((a,b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // get percent change from first to last
    const firstValue = yValues[0];
    const lastValue = yValues[n - 1];
    const percentChange = ((lastValue - firstValue) / firstValue) * 100;

    // calculate r squared
    const yMean = sumY / n;
    const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = yValues.reduce((sum, y, i) => {
        const predicted = intercept + slope * xValues[i];
        return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = ssTotal === 0 ? 1 : 1 - (ssResidual / ssTotal); // handle flats

    const avgValue = Math.abs(yMean);
    const slopeThreshold = avgValue * config.slopeThresholdPercent / 100;
    const direction = Math.abs(slope) < slopeThreshold
        ? 'stable'
        : slope > 0
            ? 'increasing'
            : 'decreasing';

    // check critical changes
    const criticalThreshold = avgValue * config.criticalChangeRate / 100;
    const isCriticalChange = Math.abs(slope) > criticalThreshold;

    // projection to next period using avg gap between buckets
    const avgGapDays = xValues[n - 1] / (n - 1);
    const nextX = xValues[n - 1] + avgGapDays;
    const projection = intercept + slope * nextX;

    // calculate data quality metrics
    const timeSpanDays = xValues[n - 1];
    const expectedPoints = Math.floor(timeSpanDays / avgGapDays) + 1;
    const dataCompleteness = (n / expectedPoints) * 100; // % of expected data points
    
    let confidence;
    if (rSquared > 0.8 && dataCompleteness > 80) {
        confidence = 'high';
    } else if (rSquared > 0.5 && dataCompleteness > 60) {
        confidence = 'medium';
    } else {
        confidence = 'low';
    }

    return {
        direction,
        slope, // change per day
        percentChange,
        projection, // next possible bucket avg value
        rSquared, // 0-1, higher = better fit
        confidence,
        dataPoints: n,
        dataCompleteness: Math.min(dataCompleteness, 100), // hard cap at 100%
        timeSpanDays: Math.round(timeSpanDays),
        ...(isCriticalChange && {
            alert: {
                type: 'critical_change_rate',
                severity: 'warning',
                message: `${SENSOR_META[sensorType].label} changing at ${Math.abs(slope).toFixed(2)} ${config.unit}/day (critical threshold: ${criticalThreshold.toFixed(2)})`
            }
        })
    };
}

// check anomalies within a single bucket
const detectIntraBucketAnomalies = (bucket, sensorType) => {
    const config = SENSOR_ANOMALY_CONFIG[sensorType];
    if (!config) return [];

    const anomalies = [];

    // statistical outliers beyond N stdDev
    const upperBound = bucket.avg + (config.stdDevThreshold * bucket.stdDev);
    const lowerBound = bucket.avg - (config.stdDevThreshold * bucket.stdDev);

    if (bucket.max > upperBound) {
        anomalies.push({
            type: 'statistical_outlier_high',
            severity: 'warning',
            value: bucket.max,
            threshold: upperBound,
            message: `Peak value ${bucket.max.toFixed(2)} exceeds ${config.stdDevThreshold}σ threshold (${upperBound.toFixed(2)})`
        });
    }

    if (bucket.min < lowerBound) {
        anomalies.push({
            type: 'statistical_outlier_low',
            severity: 'warning',
            value: bucket.min,
            threshold: lowerBound,
            message: `Minimum value ${bucket.min.toFixed(2)} below ${config.stdDevThreshold}σ threshold (${lowerBound.toFixed(2)})`
        });
    }
    
    // abs physical limits
    if (bucket.max > config.absoluteMax) {
        anomalies.push({
            type: 'physical_limit_exceeded',
            severity: 'warning',
            value: bucket.max,
            threshold: config.absoluteMax,
            message: `Maximum value ${bucket.max.toFixed(2)} exceeds physical maximum (${config.absoluteMax})`
        });
    }

    if (bucket.min < config.absoluteMin) {
       anomalies.push({
            type: 'physical_limit_exceeded',
            severity: 'warning',
            value: bucket.min,
            threshold: config.absoluteMin,
            message: `Minimum value ${bucket.min.toFixed(2)} exceeds physical minimum (${config.absoluteMin})`
        }); 
    }

    // critical thresholds
    if (config.criticalHigh && bucket.avg > config.criticalHigh) {
        anomalies.push({
            type: 'critical_high_threshold',
            severity: 'warning',
            value: bucket.avg,
            threshold: config.criticalHigh,
            message: `Average ${bucket.avg.toFixed(2)} exceeds critical high threshold (${config.criticalHigh})`
        });
    }

    if (config.criticalLow && bucket.avg < config.criticalLow) {
        anomalies.push({
            type: 'critical_low_threshold',
            severity: 'warning',
            value: bucket.avg,
            threshold: config.criticalLow,
            message: `Average ${bucket.avg.toFixed(2)} exceeds critical low threshold (${config.criticalLow})`
        });
    }

    // high variability
    const coeffOfVariation = (bucket.stdDev / bucket.avg) * 100;
    if (coeffOfVariation > 15 && bucket.count > 10) { // 15% CoeffVar -- adjustable parameter
        anomalies.push({
            type: 'high_variability',
            severity: 'info',
            value: coeffOfVariation,
            threshold: 15,
            message: `High variability detected (CV: ${coeffOfVariation.toFixed(1)}%) - possible sensor instability`
        })
    }

    return anomalies;
}

// check anomalies between consecutive buckets
const detectInterBucketAnomalies = (series, sensorType, granularity) => {
    const config = SENSOR_ANOMALY_CONFIG[sensorType];
    if (!config || series.length < 2) return series;

    if (!Array.isArray(series)) {
        console.error('detectInterBucketAnomalies: series is not an array', typeof series);
        return [];
    }

    for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1];
        const curr = series[i];

        // check sudden change in values
        const percentChange = Math.abs((curr.avg - prev.avg) / prev.avg) * 100;
        if (percentChange > config.suddenChangePercent) {
            const anomaly = {
                type: 'sudden_change',
                severity: 'warning',
                value: percentChange,
                threshold: config.suddenChangePercent,
                message: `${percentChange.toFixed(1)}% change from previous period (${prev.avg.toFixed(2)} → ${curr.avg.toFixed(2)})`
            }
            if (!curr.anomalies) curr.anomalies = [];
            curr.anomalies.push(anomaly);
        };

        // check for missing data gaps
        let expectedGapMs;
        switch(granularity) {
            case 'hourly':
                expectedGapMs = 60 * 60 * 1000; // 1 hour
                break;
            case 'daily':
                expectedGapMs = 24 * 60 * 60 * 1000; // 1 day
                break;
            case 'weekly':
                expectedGapMs = 7 * 24 * 60 * 60 * 1000; // 7 days
                break;
            default:
                expectedGapMs = 24 * 60 * 60 * 1000; // default to daily
        }

        const prevTime = new Date(prev.timestamp).getTime();
        const currTime = new Date(curr.timestamp).getTime();
        const actualGapMs = currTime - prevTime;

        if (actualGapMs > expectedGapMs * 2) {
            let gapValue, gapUnit;
            
            if (granularity === 'hourly') {
                gapValue = Math.round(actualGapMs / (60 * 60 * 1000));
                gapUnit = 'hour';
            } else if (granularity === 'weekly') {
                gapValue = Math.round(actualGapMs / (7 * 24 * 60 * 60 * 1000));
                gapUnit = 'week';
            } else {
                gapValue = Math.round(actualGapMs / (24 * 60 * 60 * 1000));
                gapUnit = 'day';
            }
            
            const anomaly = {
                type: 'data_gap',
                severity: 'info',
                value: gapValue,
                message: `${gapValue} ${gapUnit}${gapValue > 1 ? 's' : ''} gap in data - readings may be incomplete`
            };
            if (!curr.anomalies) curr.anomalies = [];
            curr.anomalies.push(anomaly);
        }
        
        // check for flatlines (stuck sensor)
        if (Math.abs(curr.avg - prev.avg) < 0.001 && 
            curr.stdDev < 0.01 && 
            prev.stdDev < 0.01 &&
            curr.count > 5 && prev.count > 5) {
            const anomaly = {
                type: 'potential_flatline',
                severity: 'warning',
                value: curr.avg,
                message: `Sensor reading unchanged (${curr.avg.toFixed(2)}) - possible sensor malfunction`
            };
            if (!curr.anomalies) curr.anomalies = [];
            curr.anomalies.push(anomaly);
        }
    }
    return series;
}



module.exports = {
    simpleLR,
    detectIntraBucketAnomalies,
    detectInterBucketAnomalies,
}