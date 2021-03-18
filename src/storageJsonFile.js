'use strict';

const fs = require('fs');

const StorageMemory = require('./storageMemory');

class StorageJsonFile extends StorageMemory {
    constructor(filePath, initialData) {
        let fileData = {};
        try {
            const fileString = fs.readFileSync(filePath, { encoding: 'utf8' });
            if (fileString !== '') {
                fileData = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
            }
        } catch (e) {
            if (e.code !== 'ENOENT') {
                throw e;
            }
        }
        super(Object.assign({}, initialData, fileData));
        this.filePath = filePath;
    }

    persist() {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.filePath, JSON.stringify(this.data), 'utf8', (err, data) => {
                if (err) return reject(err);
                return resolve(data);
            });
        });
    }
}

module.exports = StorageJsonFile;
