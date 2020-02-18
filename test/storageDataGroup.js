'use strict';

const childProcess = require('child_process');

const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const StorageDataGroup = require('../src/storageDataGroup');

chai.use(chaiAsPromised);
const assert = chai.assert;


describe('StorageDataGroup', () => {
    afterEach(() => {
        sinon.restore();
    });

    function createStorage() {
        return new StorageDataGroup('/storage/data-store');
    }

    it('should lazy init data group', () => {
        const storage = createStorage();

        let isFolderCreated = false;
        let isDataGroupCreated = false;
        sinon.stub(childProcess, 'exec').callsFake((command, callback) => {
            if (command.includes('create sys folder /storage')) {
                if (isFolderCreated) {
                    isFolderCreated = false;
                    throw new Error('folder already exists');
                }
                isFolderCreated = true;
            } else if (command.includes('create ltm data-group internal /storage/data-store type string')) {
                if (isDataGroupCreated) {
                    isDataGroupCreated = false;
                    throw new Error('folder already exists');
                }
                isDataGroupCreated = true;
            }
            callback();
        });

        return Promise.resolve()
            .then(() => storage.setItem('hello', 'world'))
            .then(() => {
                assert.equal(isFolderCreated, true);
                assert.equal(isDataGroupCreated, true);
            })
            .then(() => storage.setItem('hello', 'everyone'))
            .then(() => {
                assert.equal(isFolderCreated, false);
                assert.equal(isDataGroupCreated, false);
            });
    });

    it('should error if init fails', () => {
        const storage = createStorage();

        const folderError = 'unable to create folder';
        const dataGroupError = 'unable to create data group';
        let isFolderTested = false;
        sinon.stub(childProcess, 'exec').callsFake((command, callback) => {
            if (command.includes('create sys folder /storage')) {
                if (!isFolderTested) {
                    isFolderTested = true;
                    throw new Error(folderError);
                }
            } else if (command.includes('create ltm data-group internal /storage/data-store type string')) {
                throw new Error(dataGroupError);
            }
            callback();
        });

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

    describe('.setItem()', () => {
        it('should reject on missing keyName', () => {
            const storage = createStorage();
            return assert.isRejected(storage.setItem(), 'keyName');
        });

        it('should reject if exec throws', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            sinon.stub(childProcess, 'exec').callsFake(() => {
                throw new Error(errorString);
            });

            return assert.isRejected(storage.setItem('test'), errorString);
        });

        it('should reject if exec errors', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            sinon.stub(childProcess, 'exec').callsFake((_, callback) => {
                callback(new Error(errorString));
            });

            return assert.isRejected(storage.setItem('test'), errorString);
        });

        it('should reject if exec prints to stderr', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            sinon.stub(childProcess, 'exec').callsFake((_, callback) => {
                callback(null, '', new Error(errorString));
            });

            return assert.isRejected(storage.setItem('test'), errorString);
        });

        it('should call tmsh to store data', () => {
            const storage = createStorage();

            let tmshCommand = null;
            sinon.stub(childProcess, 'exec').callsFake((command, callback) => {
                if (command.includes('modify ltm data-group')) {
                    tmshCommand = command;
                }
                callback();
            });

            const key = 'hello';
            const value = 'world';
            return Promise.resolve()
                .then(() => storage.setItem(key, value))
                .then(() => assert.strictEqual(
                    tmshCommand,
                    'tmsh -a modify ltm data-group internal /storage/data-store records replace-all-with { hello0 { data eNpTKs8vyklRAgAJ4AJt } }'
                ));
        });
    });

    describe('.getItem()', () => {
        it('should reject on missing keyName', () => {
            const storage = createStorage();
            return assert.isRejected(storage.getItem(), 'keyName');
        });

        it('should reject if exec throws', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            sinon.stub(childProcess, 'exec').callsFake(() => {
                throw new Error(errorString);
            });

            return assert.isRejected(storage.getItem('test'), errorString);
        });

        it('should reject if exec errors', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            sinon.stub(childProcess, 'exec').callsFake((_, callback) => {
                callback(new Error(errorString));
            });

            return assert.isRejected(storage.getItem('test'), errorString);
        });

        it('should reject if exec prints to stderr', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            sinon.stub(childProcess, 'exec').callsFake((_, callback) => {
                callback(null, '', new Error(errorString));
            });

            return assert.isRejected(storage.getItem('test'), errorString);
        });

        it('should call tmsh to retrieve data', () => {
            const storage = createStorage();

            sinon.stub(childProcess, 'exec').callsFake((command, callback) => {
                if (command.includes('list ltm data-group')) {
                    callback(null, [
                        'ltm data-group internal /storage/data-store {',
                        '    records {',
                        '        bad0 {',
                        '            data ":("',
                        '        }',
                        '        hello0 {',
                        '            data "eNpTKs8vyklRAgAJ4AJt"',
                        '        }',
                        '    }',
                        '}'
                    ].join('\n'));
                    return;
                }
                callback();
            });

            return assert.becomes(storage.getItem('hello'), 'world');
        });
    });
});
