const fs = require('fs');
const path = require('path');
const csvParse = require('csv-parse/sync');
const mongoose = require('mongoose');
 
const { HISTORY_HEADER_MAP, MAX_IMPORT_SIZE } = require('./constants');

const isValidIsoDate = (value) => {
    return typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) &&
        !isNaN(new Date(value));
}

// schema shaper for imported data
const cleanedHistoryData = (row, localityId) => ({
    recordedAt: isValidIsoDate(row.recordedAt) ? new Date(row.recordedAt) : row.recordedAt,
    value: Number(row.value),
    _id: new mongoose.Types.ObjectId(),
    localityId,
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
const parsedDataFile = (input, localityId) => {
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
    const normalizedRows = rawRows.map(row => normalizeHeaders(row, HISTORY_HEADER_MAP));
    const cleanedRows = normalizedRows.map(row =>cleanedHistoryData(row, localityId));
    if (cleanedRows.length > MAX_IMPORT_SIZE) throw { status: 400, message: `Import size exceeds limit. Maximum of ${MAX_IMPORT_SIZE} rows allowed, recieved ${cleanedRows.length} rows.` };

    return cleanedRows;
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