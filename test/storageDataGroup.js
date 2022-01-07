'use strict';

const childProcess = require('child_process');
const fs = require('fs');

const mockfs = require('mock-fs');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const StorageDataGroup = require('../src/storageDataGroup');

const generateCommonTests = require('./generateCommonTests');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('StorageDataGroup', () => {
    function createStorage() {
        return new StorageDataGroup('/storage/data-store');
    }
    function createStorageNoCache() {
        return new StorageDataGroup('/storage/data-store', { useInMemoryCache: false });
    }

    let tmshCommands = {};
    let defaultCommands = {};
    let overrideCommands = null;

    beforeEach(() => {
        let isFolderCreated = false;
        let isDataGroupCreated = false;
        let data = [
            'ltm data-group internal /storage/data-store {',
            '    records {',
            '        hello0 {',
            '            data eNpTKs8vyklRAgAJ4AJt',
            '        }',
            '        world0 {',
            '            data eNpTKs8vyklRAgAJ4AJt',
            '        }',
            '    }',
            '    partition appsvcs',
            '    type string',
            '}'
        ].join('\n');
        defaultCommands = {
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
            'list sys folder': (callback) => {
                if (!isFolderCreated) {
                    callback(null, null, 'was not found');
                }
                callback();
            },
            'list ltm data-group': (callback) => {
                if (!isDataGroupCreated) {
                    callback(null, null, 'was not found');
                }
                callback(null, data);
            },
            'delete ltm data-group': (callback) => {
                if (!isDataGroupCreated) {
                    throw new Error('data group was not created before delete command');
                }
                isDataGroupCreated = false;
                data = '';
                callback();
            },
            'modify ltm data-group': (callback, command) => {
                if (command.match(/replace-all-with {\s*}/)) {
                    assert(false, 'empty replace-all-with not supported by tmsh');
                }

                let newData = command.split(' replace-all-with ')[1];
                assert(newData, `got bad modify command ${command}`);
                newData = newData
                    .replace(/(^{ | }$)/gm, '')
                    .replace(/(\w* { )/gm, '        $1\n             ')
                    .replace(/ }/gm, '\n        }\n');

                data = [].concat(
                    [
                        'ltm data-group internal /storage/data-store {',
                        '    records {'
                    ],
                    [newData],
                    [
                        '    }',
                        '    partition appsvcs',
                        '    type string',
                        '}'
                    ]
                ).join('\n');

                callback();
            },
            'load sys config merge file': (callback, command) => {
                if (isDataGroupCreated) {
                    throw new Error('data group already exists');
                }
                const filePath = command.split('merge file ')[1];
                assert(filePath, `got bad load sys config merge file command ${command}`);

                data = fs.readFileSync(filePath, { encoding: 'utf8' });

                isDataGroupCreated = true;
                callback();
            }
        };

        mockfs({
            '/tmp': {}
        });

        sinon.stub(childProcess, 'exec').callsFake((command, options, callback) => {
            assert.equal(options.maxBuffer, Infinity);
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
        mockfs.restore();
    });

    generateCommonTests(createStorage, 'common, with cache');
    generateCommonTests(createStorageNoCache, 'common, no cache');

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

        it('should allow control over caching', () => {
            const storage = createStorage();
            assert.deepStrictEqual(storage.cache, {});

            const noCache = createStorageNoCache();
            assert.strictEqual(noCache.cache, null);
        });

        it('should not create folder if it already exists', () => {
            const storage = createStorage();

            tmshCommands['create sys folder'] = () => {
                throw new Error(new Error('folder already created'));
            };
            tmshCommands['list sys folder'] = (callback) => {
                callback();
            };

            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    storage.setItem('hello', 'world')
                ));
        });

        it('should not create data group if it already exists', () => {
            const storage = createStorage();

            const data = [
                'ltm data-group internal /storage/data-store {',
                '}'
            ].join('\n');

            tmshCommands['create ltm data-group'] = () => {
                throw new Error(new Error('data group already created'));
            };
            tmshCommands['list ltm data-group'] = (callback) => {
                callback(null, data);
            };

            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    storage.setItem('hello', 'world')
                ));
        });

        it('should block from running init if it is already running', () => {
            const storage = createStorage();

            return assert.isFulfilled(
                Promise.all([
                    storage.setItem('hello', 'world'),
                    storage.setItem('foo', 'bar')
                ])
            );
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

    describe('.deleteItem()', () => {
        it('should not use an empty tmsh modify', () => {
            const storage = createStorageNoCache();
            let deleteOrModifyCalled = false;

            tmshCommands['modify ltm data-group'] = (callback, command) => {
                deleteOrModifyCalled = true;
                defaultCommands['modify ltm data-group'](callback, command);
            };
            tmshCommands['delete ltm data-group'] = (callback, command) => {
                deleteOrModifyCalled = true;
                defaultCommands['delete ltm data-group'](callback, command);
            };

            return Promise.resolve()
                .then(() => storage.deleteItem('hello'))
                .then(() => storage.deleteItem('world'))
                .then(() => assert(
                    deleteOrModifyCalled,
                    'expected either modify or delete to be called'
                ));
        });
    });

    describe('.clearCache()', () => {
        it('should allow for clearing the cache', () => {
            const storage = createStorage();
            storage.cache = {
                foo: 'bar'
            };
            return storage.clearCache()
                .then(() => {
                    assert.deepStrictEqual(storage.cache, {});
                });
        });
    });
});
