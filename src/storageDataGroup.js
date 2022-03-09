'use strict';

const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const pathLib = require('path');
const os = require('os');
const crypto = require('crypto');

const childProcess = require('child_process');

const ZLIB_OPTIONS = {
    level: zlib.Z_BEST_COMPRESSION,
    windowBits: 15
};

function fromBase64(input) {
    return Buffer.from(input, 'base64');
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
    if (base64String === '') {
        return 'null';
    }
    const compresedString = fromBase64(base64String);
    const finalString = zlib.inflateSync(compresedString, ZLIB_OPTIONS).toString();
    return finalString;
}

function executeCommand(command) {
    const options = {
        maxBuffer: Infinity
    };
    return new Promise((resolve, reject) => {
        childProcess.exec(command, options, (error, stdout, stderr) => {
            if (error) reject(error);
            else if (stderr) reject(new Error(stderr));
            else resolve(stdout);
        });
    });
}

function list(path) {
    return executeCommand(`tmsh -a list ${path}`);
}

function addFolder(path) {
    return executeCommand(`tmsh -a create sys folder ${path}`);
}

function addDataGroup(path) {
    return executeCommand(`tmsh -a create ltm data-group internal ${path} type string`);
}

function deleteDataGroup(path) {
    return executeCommand(`tmsh -a delete ltm data-group internal ${path}`);
}

function itemExists(path) {
    return list(path)
        .then(() => true)
        .catch((err) => {
            if (err.message.indexOf('was not found') >= 0) {
                return false;
            }
            throw err;
        });
}

function folderExists(path) {
    return itemExists(`sys folder ${path}`);
}

function dataGroupExists(path) {
    return itemExists(`ltm data-group internal ${path}`);
}

function updateDataGroup(path, records) {
    const tmshRecords = records
        .map(record => `${record.name} { data ${record.data} }`)
        .join('\n        ')
        .replace(/{ /g, '{\n            ')
        .replace(/ }/g, '\n        }');

    if (tmshRecords === '') {
        return deleteDataGroup(path);
    }
    const randBytes = crypto.randomBytes(16).toString('hex');
    const configFileName = pathLib.join(os.tmpdir(), `tmp${randBytes}.conf`);
    const configData = [
        `ltm data-group internal ${path} {`,
        '    records {',
        `        ${tmshRecords}`,
        '    }',
        '    type string',
        '}'
    ].join('\n');

    return Promise.resolve()
        .then(() => new Promise((resolve, reject) => {
            fs.writeFile(configFileName, configData, { mode: 0o600, flag: 'wx' }, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        }))
        .then(() => deleteDataGroup(path))
        .then(() => executeCommand(`tmsh -a load sys config merge file ${configFileName}`))
        .then(() => new Promise((resolve, reject) => {
            fs.unlink(configFileName, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        }));
}

function readDataGroup(path) {
    return executeCommand(`tmsh -a list ltm data-group internal ${path}`);
}

function outputToObject(output) {
    const jsonString = output
        .replace(/ltm data-group internal .*? {/, '{')
        .replace(/(\s*)(.*?) {/g, '$1"$2" : {')
        .replace(/( {8}})(\s*")/gm, '$1,$2')
        .replace(/(\s*)data (.*?)(\s*)}/gm, '$1"data": "$2"$3}')
        .replace(/^( {4}})/m, '$1,')
        .replace(/partition (.*)/, '"partition": "$1",')
        .replace('type string', '"type": "string"');
    return JSON.parse(jsonString);
}

function recordsToKeys(records) {
    const recordNames = records.map(x => x.name);
    const keynames = {};

    let lastKeyname = '';
    let recordCounter = -1;
    while (recordNames.length !== 0) {
        const nextCounter = recordCounter + 1;
        const nextRecordName = recordNames.shift();
        if (nextRecordName === `${lastKeyname}${nextCounter}`) {
            // Still working on the same key
            recordCounter = nextCounter;
            keynames[lastKeyname].push(nextRecordName);
        } else {
            // New key
            lastKeyname = nextRecordName.slice(0, -1);
            recordCounter = 0;
            keynames[lastKeyname] = [nextRecordName];
        }
    }

    return keynames;
}

class StorageDataGroup {
    constructor(path, options) {
        options = options || {};
        if (typeof options.useInMemoryCache === 'undefined') {
            options.useInMemoryCache = true;
        }

        this.length = 0;
        this.path = path;
        this._ready = false;

        this.cache = options.useInMemoryCache ? {} : null;
        this._dirty = false;
    }

    ensureFolder() {
        const path = this.path.split('/').slice(0, -1).join('/');
        return folderExists(path)
            .then((exists) => {
                if (exists) {
                    return Promise.resolve();
                }
                return addFolder(path);
            });
    }

    ensureDataGroup() {
        return dataGroupExists(this.path)
            .then((exists) => {
                if (exists) {
                    return Promise.resolve();
                }
                return addDataGroup(this.path);
            });
    }

    _lazyInit() {
        if (this._ready) {
            return Promise.resolve();
        }

        if (this._initRunning) {
            return this._initPromise;
        }

        this._initRunning = true;

        this._initPromise = Promise.resolve()
            .then(() => this.ensureFolder())
            .then(() => this.ensureDataGroup())
            .then(() => {
                this._initRunning = false;
                this._ready = true;
            })
            .catch((err) => {
                this._initRunning = false;
                throw err;
            });

        return this._initPromise;
    }

    _getData() {
        if (this.cache && this.cache.records) {
            return Promise.resolve(this.cache);
        }

        return Promise.resolve()
            .then(() => this._lazyInit())
            .then(() => readDataGroup(this.path))
            .then(data => outputToObject(data))
            .then((data) => {
                if (this.cache) {
                    this.cache = data;
                }
                return data;
            });
    }

    _getRecords() {
        return Promise.resolve()
            .then(() => this._getData())
            .then(data => data.records || {})
            .then(records => Object.keys(records).map(
                key => Object.assign({ name: key }, records[key])
            ));
    }

    clearCache() {
        return Promise.resolve()
            .then(() => {
                this.cache = {};
            });
    }

    keys() {
        return Promise.resolve()
            .then(() => this._getRecords())
            .then(records => Object.keys(recordsToKeys(records)));
    }

    hasItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return Promise.resolve()
            .then(() => this.getItem(keyName))
            .then(data => typeof data !== 'undefined');
    }

    deleteItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        this._dirty = true;

        return Promise.resolve()
            .then(() => this._getRecords())
            .then((currentRecords) => {
                const recordNamesToDelete = recordsToKeys(currentRecords)[keyName];
                const records = currentRecords.filter(x => recordNamesToDelete.indexOf(x.name) < 0);

                if (this.cache) {
                    this.cache.records = records.reduce((acc, curr) => {
                        acc[curr.name] = curr;
                        return acc;
                    }, {});
                }
                if (records.length === 0) {
                    this._ready = false;
                }
                return updateDataGroup(this.path, records);
            });
    }

    setItem(keyName, keyValue) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        this._dirty = true;

        return Promise.resolve()
            .then(() => this._getRecords())
            .then((currentRecords) => {
                const string = JSON.stringify(keyValue);
                const records = currentRecords.concat(stringToRecords(keyName, string));
                if (this.cache) {
                    this.cache.records = records.reduce((acc, curr) => {
                        acc[curr.name] = curr;
                        return acc;
                    }, {});
                }

                return updateDataGroup(this.path, records);
            });
    }

    getItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return Promise.resolve()
            .then(() => this._getRecords())
            .then(records => recordsToString(records, keyName))
            .then(data => JSON.parse(data))
            .then((data) => {
                if (data === null) {
                    return undefined;
                }
                return data;
            });
    }

    persist() {
        const opts = {
            host: 'localhost',
            port: 8100,
            path: '/mgmt/tm/task/sys/config',
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from('admin:').toString('base64')}`,
                'Content-Type': 'application/json'
            }
        };
        const payload = {
            command: 'save'
        };

        if (!this._dirty) {
            return Promise.resolve();
        }

        return Promise.resolve()
            .then(() => new Promise((resolve, reject) => {
                const req = http.request(opts, (res) => {
                    const buffer = [];
                    res.setEncoding('utf8');
                    res.on('data', (data) => {
                        buffer.push(data);
                    });
                    res.on('end', () => {
                        let body = buffer.join('');
                        body = body || '{}';
                        try {
                            body = JSON.parse(body);
                        } catch (e) {
                            return reject(new Error(`Invalid response object from ${opts.method} to ${opts.path}`));
                        }
                        return resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            body
                        });
                    });
                });

                req.on('error', (e) => {
                    reject(new Error(`${opts.host}:${e.message}`));
                });

                req.end(JSON.stringify(payload));
            }))
            .then((response) => {
                if (response.status !== 200) {
                    return Promise.reject(new Error(`failed to save sys config:${JSON.stringify(response.body)}`));
                }
                this._dirty = false;
                return Promise.resolve();
            });
    }
}

module.exports = StorageDataGroup;
