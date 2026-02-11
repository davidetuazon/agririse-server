const fs = require('fs');
const path = require('path');
const csvParse = require('csv-parse/sync');
const mongoose = require('mongoose');
 
const { HISTORY_HEADER_MAP, MAX_IMPORT_SIZE, SENSOR_META } = require('./constants');

const isValidIsoDate = (value) => {
    return typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) &&
        !isNaN(new Date(value));
}

// schema shaper for imported data
const cleanedHistoryData = (row, localityId, sensorType) => {
    if (row.recordedAt === undefined || row.recordedAt === null || row.recordedAt === '') throw new Error('Missing required field: recordedAt');
    if (row.value === undefined || row.value === null || row.value === '') throw new Error('Missing required field: value');

    let recordedAt;
    if (isValidIsoDate(row.recordedAt)) {
        recordedAt = new Date(row.recordedAt);

        if (isNaN(recordedAt.getTime())) {
            throw new Error(`Invalid date: "${row.recordedAt}"`);
        }
    } else {
        throw new Error(`Invalid date format: "${row.recordedAt}". Expected ISO 8601 format (e.g., 2026-02-06T10:30:00Z)`);
    }

    const value = Number(row.value);
    if (isNaN(value)) throw new Error(`Invalid number for value: "${row.value}"`);
    if (!isFinite(value)) throw new Error(`Value must be finite, got: ${row.value}`);
    
    return {
        recordedAt,
        value,
        unit: SENSOR_META[sensorType].unit,
        _id: new mongoose.Types.ObjectId(),
        localityId,
    };
};

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
const parsedDataFile = (input, localityId, sensorType) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    let rawRows = [];

    // Check if input is an array (from JSON body)
    if (Array.isArray(input)) {
        rawRows = input;
    } else if (typeof input === 'string') {
        // validate if file exist
        if (!fs.existsSync(input)) throw { status: 400, message: 'File not found' };
        
        // check file size
        const stat = fs.statSync(input);
        if (stat.size > MAX_FILE_SIZE) throw { status: 400, message: 'File too large. Maximum 10MB allowed' };

        // validate the extension
        const ext = path.extname(input).toLowerCase();
        if (ext !== '.json' && ext !== '.csv') throw { status: 400, message: 'Unsupported file type. Only .csv and .json allowed' };
    
        const fileContent = fs.readFileSync(input, 'utf-8');

        // parse base on extension (.csv or .json) 
        if (ext === '.json') {
            try {
                rawRows = JSON.parse(fileContent);

                if (!Array.isArray(rawRows)) throw { status: 400, message: 'JSON file must contain an array of records' };
            } catch (parseError) {
                throw { status: 400, message: 'Invalid JSON format: ' + parseError.message };
            }
        } else if (ext === '.csv') {
            try {
                rawRows = csvParse(fileContent, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                });

                if (!rawRows || rawRows.length === 0) throw { status: 400, message: 'CSV file is empty or has no valid rows' };
            } catch (csvError) {
                throw { status: 400, message: 'Invalid CSV format: ' + csvError.message };
            }
        }
    } else {
        throw { status: 400, message: 'Invalid input type. Expected array or file path' };
    }
    // check if empty
    if (rawRows.length === 0) throw { status: 400, message: 'File contains no data rows' };
    // check size limit
    if (rawRows.length > MAX_IMPORT_SIZE) throw { status: 400, message: `Import size exceeds limit. Maximum ${MAX_IMPORT_SIZE} rows allowed, received ${rawRows.length} rows.` };

    // normalize
    const normalizedRows = rawRows.map(row => normalizeHeaders(row, HISTORY_HEADER_MAP));
    
    const errors = [];
    const cleanedRows = [];

    normalizedRows.forEach((row, index) => {
        try {
            cleaned = cleanedHistoryData(row, localityId, sensorType);
            cleanedRows.push(cleaned);
        } catch (cleanedError) {
            errors.push({
                row: index + 1,
                error: cleanedError.message,
                data: row,
            });
        };
    });

    // validate results
    if (cleanedRows.length === 0) throw { status: 400, message: 'No valid rows found after processing data', errors: errors.slice(0, 10) };
    // handle some rows failing
    if (errors.length > 0) {
        console.warn(`${errors.length}/${rawRows.length} rows failed validation and were skipped`);
        console.warn('Sample errors:', errors.slice(0, 3));
    }
    return {
        data: cleanedRows,
        stats: {
            total: rawRows.length,
            valid: cleanedRows.length,
            failed: errors.length,
            errors: errors.length > 0 ? errors.slice(0, 10) : null
        }
    };
};

// validity check
const isValidHistoryRow = (r) =>
    r.recordedAt instanceof Date &&
    !Number.isNaN(r.recordedAt.getTime()) &&
    Number.isFinite(r.value);


module.exports = {
    parsedDataFile,
    isValidHistoryRow,
}