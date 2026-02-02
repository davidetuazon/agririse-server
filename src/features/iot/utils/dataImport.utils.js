const fs = require('fs');
const path = require('path');
const csvParse = require('csv-parse/sync');
const mongoose = require('mongoose');
 
const { HISTORY_HEADER_MAP, ANALYTICS_HEADER_MAP } = require('./constants');

// schema shaper for imported data
const cleanedHistoryData = (row) => ({
    recordedAt: new Date(row.recordedAt),
    value: Number(row.value),
    _id: new mongoose.Types.ObjectId(),
});

const cleanedAnalyticsData = (row) => ({
    timestamp: new Date(row.timestamp),
    total: Number(row.total),
    avg: Number(row.avg),
    min: Number(row.min),
    max: Number(row.max),
    stdDev: Number(row.stdDev),
    count: Number(row.count)
});

// helper for imported data headers
const normalizeHeaders = (row, headerMap) => {
    const normalized = {};
    const rowKeys = Object.keys(row);

    for (const canonicalKey in headerMap) {
        const possibleHeaders = headerMap[canonicalKey].map(h => h.toLowerCase());

        const foundHeaderMatch = rowKeys.find(rk => 
            possibleHeaders.some(ph => rk.toLowerCase().includes(ph))
        );

        normalized[canonicalKey] = foundHeaderMatch ? row[foundHeaderMatch] : undefined;
    }

    return normalized;
}

// data parser for imported data
const parsedDataFile = (input, dataType) => {
    let rawRows = [];

    // Check if input is an array (from JSON body)
    if (Array.isArray(input)) {
        rawRows = input;
    } else {
        // Assume it's a file path
        const ext = path.extname(input).toLowerCase();
        const fileContent = fs.readFileSync(input, 'utf-8');

        if (ext === '.json') {
            rawRows = JSON.parse(fileContent);
        } else if (ext === '.csv') {
            rawRows = csvParse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
        } else {
            throw new Error('Unsupported file type');
        }
    }

    const headerMap = dataType === 'history' ? HISTORY_HEADER_MAP : ANALYTICS_HEADER_MAP;
    const normalizedRows = rawRows.map(row => normalizeHeaders(row, headerMap));

    const cleanedRows = normalizedRows.map(row =>
        dataType === 'history' ? cleanedHistoryData(row) : cleanedAnalyticsData(row)
    );

    return cleanedRows;
};

// validity check
const isValidHistoryRow = (r) =>
    r.recordedAt instanceof Date && !isNaN(r.recordedAt) &&
    typeof r.value === 'number' && !isNaN(r.value);

const isValidAnalyticsRow = (r) =>
    r.timestamp instanceof Date && !isNaN(r.timestamp) &&
    ['total', 'avg', 'min', 'max', 'count'].every(
        k => typeof r[k] === 'number' && !isNaN(r[k])
    );


module.exports = {
    parsedDataFile,
    isValidHistoryRow,
    isValidAnalyticsRow,
}