// for csv exporting
const generateCSV = (data, columns) => {
    if (!Array.isArray(data) || data.length === 0) return '';

    const keys = columns ?? Object.keys(data[0]);

    const escapeValue = (value) => {
        if (value === null || value === undefined) return '';

        if (value instanceof Date) {
                value = value.toISOString();
            }

        if (typeof value === 'object') {
            if (typeof value.toString === 'function' &&
            value.toString !== Object.prototype.toString) {
                    value = value.toString();
            } else {
                value = JSON.stringify(value);
            }
        }

        value = String(value);
        value = value.replace(/"/g,'""');

        if (/[",\n\r]/.test(value)) {
            value = `"${value}"`;
        }

        return value;
    };

    const header = keys.join(',');
    const rows = data.map(row => 
        keys.map(key => escapeValue(row[key])).join(',')
    );

    return [header, ...rows].join('\n');
}

module.exports = {
    generateCSV,
}