'use strict';

const childProcess = require('child_process');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const stripIndent = require('common-tags').stripIndent;

const StorageDataGroup = require('../src/storageDataGroup');

const generateCommonTests = require('./generateCommonTests');

chai.use(chaiAsPromised);
const assert = chai.assert;


describe('StorageDataGroup', () => {
    function createStorage() {
        return new StorageDataGroup('/storage/data-store');
    }

    let tmshCommands = {};
    let overrideCommands = null;

    beforeEach(() => {
        let isFolderCreated = false;
        let isDataGroupCreated = false;
        const defaultCommands = {
            'create sys folder': (callback) => {
                if (isFolderCreated) {
                    isFolderCreated = false;
                    throw new Error('folder already exists');
                }
                isFolderCreated = true;
                callback();
            },
            'create ltm data-group': (callback) => {
                if (isDataGroupCreated) {
                    isDataGroupCreated = false;
                    throw new Error('folder already exists');
                }
                isDataGroupCreated = true;
                callback();
            },
            'list ltm data-group': (callback) => {
                const data = stripIndent`
                ltm data-group internal /storage/data-store {
                    records {
                        hello0 {
                            data eNpTKs8vyklRAgAJ4AJt
                        }
                        world0 {
                            data eNpTKs8vyklRAgAJ4AJt
                        }
                    }
                    type string
                }
            `;
                callback(null, data);
            }
        };

        sinon.stub(childProcess, 'exec').callsFake((command, callback) => {
            let foundCmd = false;
            let commands = overrideCommands;
            if (!commands) {
                commands = Object.assign({}, defaultCommands, tmshCommands);
            }
            Object.keys(commands).forEach((cmdstr) => {
                if (command.includes(cmdstr)) {
                    commands[cmdstr](callback, command);
                    foundCmd = true;
                }
            });

            if (!foundCmd) {
                callback();
            }
        });
    });

    afterEach(() => {
        tmshCommands = {};
        overrideCommands = null;
        sinon.restore();
    });

    generateCommonTests(createStorage);

    describe('Init', () => {
        it('should error if init fails', () => {
            const storage = createStorage();

            const folderError = 'unable to create folder';
            const dataGroupError = 'unable to create data group';
            let isFolderTested = false;
            tmshCommands['create sys folder'] = (callback) => {
                if (!isFolderTested) {
                    isFolderTested = true;
                    throw new Error(folderError);
                }
                callback();
            };
            tmshCommands['create ltm data-group'] = () => {
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
            overrideCommands = {
                '': () => {
                    throw new Error(errorString);
                }
            };

            return assert.isRejected(storage.setItem('test'), errorString);
        });

        it('should reject if exec errors', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            overrideCommands = {
                '': callback => callback(new Error(errorString))
            };

            return assert.isRejected(storage.setItem('test'), errorString);
        });

        it('should reject if exec prints to stderr', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            overrideCommands = {
                '': callback => callback(null, '', new Error(errorString))
            };

            return assert.isRejected(storage.setItem('test'), errorString);
        });
    });

    describe('.getItem()', () => {
        it('should reject if exec throws', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            overrideCommands = {
                '': () => {
                    throw new Error(errorString);
                }
            };

            return assert.isRejected(storage.getItem('test'), errorString);
        });

        it('should reject if exec errors', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            overrideCommands = {
                '': callback => callback(new Error(errorString))
            };

            return assert.isRejected(storage.getItem('test'), errorString);
        });

        it('should reject if exec prints to stderr', () => {
            const storage = createStorage();

            const errorString = 'exec error';
            overrideCommands = {
                '': callback => callback(null, '', new Error(errorString))
            };

            return assert.isRejected(storage.getItem('test'), errorString);
        });
    });
});
