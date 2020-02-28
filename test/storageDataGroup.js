'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const StorageDataGroup = require('../src/storageDataGroup');

chai.use(chaiAsPromised);
const assert = chai.assert;


describe('StorageDataGroup', () => {
    function createStorage() {
        return new StorageDataGroup('/storage/data-store');
    }

    describe('Init', () => {
        it('should error if init fails', () => {
            const storage = createStorage();

            const folderError = 'unable to create folder';
            const dataGroupError = 'unable to create data group';
            let isFolderTested = false;
            process.tmshcmds['create sys folder'] = (callback) => {
                if (!isFolderTested) {
                    isFolderTested = true;
                    throw new Error(folderError);
                }
                callback();
            };
            process.tmshcmds['create ltm data-group'] = () => {
                throw new Error(dataGroupError);
            };

            return Promise.resolve()
                .then(() => assert.isRejected(
                    storage.setItem('hello', 'world'),
                    folderError
                ))
                .then(() => assert.isRejected(
                    storage.setItem('hello', 'world'),
                    dataGroupError
                ));
        });
    });

    describe('.setItem()', () => {
        it('should reject if exec throws', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            process.tmshcmds = {
                '': () => {
                    throw new Error(errorString);
                }
            };

            return assert.isRejected(storage.setItem('test'), errorString);
        });

        it('should reject if exec errors', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            process.tmshcmds = {
                '': callback => callback(new Error(errorString))
            };

            return assert.isRejected(storage.setItem('test'), errorString);
        });

        it('should reject if exec prints to stderr', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            process.tmshcmds = {
                '': callback => callback(null, '', new Error(errorString))
            };

            return assert.isRejected(storage.setItem('test'), errorString);
        });
    });

    describe('.getItem()', () => {
        it('should reject if exec throws', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            process.tmshcmds = {
                '': () => {
                    throw new Error(errorString);
                }
            };

            return assert.isRejected(storage.getItem('test'), errorString);
        });

        it('should reject if exec errors', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            process.tmshcmds = {
                '': callback => callback(new Error(errorString))
            };

            return assert.isRejected(storage.getItem('test'), errorString);
        });

        it('should reject if exec prints to stderr', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            process.tmshcmds = {
                '': callback => callback(null, '', new Error(errorString))
            };

            return assert.isRejected(storage.getItem('test'), errorString);
        });
    });
});
