'use strict';

const zlib = require('zlib');

const childProcess = require('child_process');

const ZLIB_OPTIONS = {
    level: zlib.Z_BEST_COMPRESSION,
    windowBits: 15
};

function fromBase64(input) {
    return Buffer.from(input, 'base64');
}

function filterDuplicateResourceError(error) {
    if (!error.message.includes('already exists')) {
        throw error;
    }
}

function stringToRecords(baseKey, string, offset) {
    const compressedString = zlib.deflateSync(string, ZLIB_OPTIONS);

    const records = [];
    let base64String = compressedString.toString('base64');
    for (let counter = offset || 0; base64String.length; counter += 1) {
        const chunk = base64String.substr(0, 64512);
        records.push({
            name: `${baseKey}${counter}`,
            data: chunk
        });
        base64String = base64String.substr(64512);
    }

    return records;
}

function recordsToString(records, baseKey, offset) {
    let base64String = '';
    for (let i = offset || 0; i < records.length; i += 1) {
        const recordName = `${baseKey}${i}`;
        const record = records.find(r => r.name === recordName);
        if (record) {
            base64String += record.data;
        }
    }
    const compresedString = fromBase64(base64String);
    const finalString = zlib.inflateSync(compresedString, ZLIB_OPTIONS).toString();
    return finalString;
}


function executeCommand(command) {
    return new Promise((resolve, reject) => {
        childProcess.exec(command, (error, stdout, stderr) => {
            if (error) reject(error);
            else if (stderr) reject(new Error(stderr));
            else resolve(stdout);
        });
    });
}

function addFolder(path) {
    return executeCommand(`tmsh -a create sys folder ${path}`);
}

function addDataGroup(path) {
    return executeCommand(`tmsh -a create ltm data-group internal ${path} type string`);
}

function updateDataGroup(path, records) {
    const tmshRecords = records
        .map(record => `${record.name} { data ${record.data} }`)
        .join(' ');
    // eslint-disable-next-line max-len
    const command = `tmsh -a modify ltm data-group internal ${path} records replace-all-with { ${tmshRecords} }`;
    return executeCommand(command);
}

function readDataGroup(path) {
    return executeCommand(`tmsh -a list ltm data-group internal ${path}`);
}


function findObjectEndLine(lines, start) {
    function stringCount(string, pattern) {
        return (string.match(pattern) || []).length;
    }

    let level = 0;
    let endLine = null;
    lines.forEach((line, i) => {
        if (i < start) return;
        if (endLine !== null) return;
        level += stringCount(line, /{/g);
        level -= stringCount(line, /}/g);
        if (level <= 0) endLine = i + start;
    });
    return endLine;
}

function outputToObject(output, start, end) {
    const result = {};
    const startLine = (start || 0) + 1;
    const endLine = end || -1;

    const lines = output.split('\n').slice(startLine, endLine);

    let skipTo = -1;
    lines.forEach((line, i) => {
        if (i < skipTo) return;
        const tokens = line.trim().split(/\s+/);
        const key = tokens.slice(0, -1).join(' ');
        let value = tokens.pop();
        if (value === '{') {
            skipTo = findObjectEndLine(lines, i) + 1;
            value = outputToObject(output, i + startLine, skipTo + startLine);
        }
        if (key) {
            result[key] = value;
        }
    });
    return result;
}

class StorageDataGroup {
    constructor(path) {
        this.length = 0;
        this.path = path;
    }

    ensureFolder() {
        const path = this.path.split('/').slice(0, -1).join('/');
        return addFolder(path).catch(filterDuplicateResourceError);
    }

    ensureDataGroup() {
        return addDataGroup(this.path).catch(filterDuplicateResourceError);
    }

    setItem(keyName, keyValue) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return Promise.resolve()
            .then(() => this.ensureFolder())
            .then(() => this.ensureDataGroup())
            .then(() => {
                const string = JSON.stringify(keyValue);
                const records = stringToRecords(keyName, string);
                return updateDataGroup(this.path, records);
            });
    }

    getItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return Promise.resolve()
            .then(() => readDataGroup(this.path))
            .then(data => outputToObject(data))
            .then(data => Object.keys(data.records).map(
                key => Object.assign({ name: key }, data.records[key])
            ))
            .then(data => recordsToString(data, keyName))
            .then(data => JSON.parse(data));
    }
}

module.exports = StorageDataGroup;
