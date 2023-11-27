'use strict';

const http = require('http');
const childProcess = require('child_process');
const fs = require('fs');

const nock = require('nock');
const mockfs = require('mock-fs');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const tmshUtil = require('@f5devcentral/atg-shared-utilities/src/tmshUtils');

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
    let getLastDatagroupFileContents;

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
            '    description this is my group',
            '    app-service my app service',
            '    type string',
            '}'
        ].join('\n');
        getLastDatagroupFileContents = () => data;
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

        sinon.stub(tmshUtil, 'executeTmshCommand').resolves(
            {
                value: '"admin"'
            }
        );
    });

    afterEach(() => {
        tmshCommands = {};
        overrideCommands = null;
        sinon.restore();
        mockfs.restore();
        nock.cleanAll();
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
            tmshCommands['delete ltm data-group'] = (callback) => {
                callback();
            };

            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    storage.setItem('hello', 'world')
                ));
        });

        it('should block from running init if it is already running', () => {
            const storage = createStorage();
            const data = [
                'ltm data-group internal /storage/data-store {',
                '}'
            ].join('\n');

            tmshCommands['list ltm data-group'] = (callback) => {
                callback(null, data);
            };

            const ensureFolderSpy = sinon.stub(storage, 'ensureFolder').resolves();
            const ensureDataGroupSpy = sinon.stub(storage, 'ensureDataGroup').resolves();
            return Promise.all([
                storage._getData(),
                storage._getData()
            ])
                .then(() => {
                    assert.ok(ensureFolderSpy.calledOnce);
                    assert.ok(ensureDataGroupSpy.calledOnce);
                });
        });
    });

    describe('.getData()', () => {
        it('should reject if readDataGroup throws', () => {
            const storage = createStorage();

            sinon.stub(JSON, 'parse').throws(new Error('error parsing json'));
            const errorString = 'Unable to read data group /storage/data-store: error parsing json';
            return assert.isRejected(storage._getData(), errorString);
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

        it('should not create multiple records if name has a space', () => {
            const storage = createStorage();

            return Promise.resolve()
                .then(() => storage.setItem('hello world', 'foobar'))
                .then(() => assert.match(getLastDatagroupFileContents(), /"hello world0" \{\n\s*data /));
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
        const data = [
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

        it('should not use an empty tmsh modify', () => {
            const storage = createStorageNoCache();
            let deleteOrModifyCalled = false;

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

        it('should not throw an error if deleting a datagroup that does not exist', () => {
            const storage = createStorage();

            overrideCommands = {
                'list ltm data-group': (callback, command) => {
                    if (command.indexOf('/dev/null') > -1) {
                        callback(null, null, 'The request value list (/Common/foo) was not found');
                    } else {
                        callback(null, data);
                    }
                }
            };

            return storage.deleteItem('hello');
        });

        it('should throw an error for any other error', () => {
            const storage = createStorage();

            overrideCommands = {
                'list ltm data-group': (callback, command) => {
                    if (command.indexOf('/dev/null') > -1) {
                        callback(null, null, 'some other error');
                    } else {
                        callback(null, data);
                    }
                }
            };

            assert.isRejected(storage.deleteItem('hello'));
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

    describe('.persist()', () => {
        beforeEach(() => {
            sinon.stub(promiseUtil, 'delay').resolves(); // This bypasses the 500ms delay
        });

        it('should exit early if _dirty is false', () => {
            const storage = createStorage();
            storage._dirty = false;
            const httpSpy = sinon.spy(http, 'request');
            return storage.persist()
                .then(() => {
                    assert.strictEqual(httpSpy.callCount, 0); // Should exit before calling http.request
                });
        });

        it('should save the sys config via tmsh', () => {
            const localnock = nock('http://localhost:8100')
                .post('/mgmt/tm/task/sys/config')
                .reply(
                    200,
                    {
                        _taskId: 123456,
                        _taskState: 'STARTED',
                        _taskTimeInStateMs: 0
                    }
                )
                .put('/mgmt/tm/task/sys/config/123456', '{"_taskState":"VALIDATING"}')
                .reply(
                    202,
                    {
                        code: 202,
                        message: 'Task will execute asynchronously',
                        errorStack: []
                    }
                )
                .get('/mgmt/tm/task/sys/config/123456')
                .reply(
                    200,
                    {
                        _taskId: 123456,
                        _taskState: 'VALIDATING',
                        _taskTimeInStateMs: 100000
                    }
                )
                .get('/mgmt/tm/task/sys/config/123456')
                .reply(
                    200,
                    {
                        _taskId: 123456,
                        _taskState: 'COMPLETED',
                        _taskTimeInStateMs: 15000
                    }
                );

            const storage = createStorage();
            storage._dirty = true;
            return storage.persist()
                .then(() => {
                    assert.deepStrictEqual(localnock.pendingMocks(), []);
                    assert.ok(localnock.isDone(), 'nock should have completed');
                });
        });

        it('should exit early if the POST does not return a taskState of STARTED', () => {
            const localnock = nock('http://localhost:8100')
                .post('/mgmt/tm/task/sys/config')
                .reply(
                    200, // Note: Even though the state FAILED, the status code remains 200
                    {
                        _taskId: 123456,
                        _taskState: 'FAILED',
                        _taskTimeInStateMs: 0
                    }
                );

            const storage = createStorage();
            storage._dirty = true;
            return assert.isRejected(storage.persist(), /failed to submit save sys config task/)
                .then(() => {
                    assert.deepStrictEqual(localnock.pendingMocks(), []);
                });
        });

        it('should exit early if the _taskState is FAILED', () => {
            const localnock = nock('http://localhost:8100')
                .post('/mgmt/tm/task/sys/config')
                .reply(
                    200,
                    {
                        _taskId: 123456,
                        _taskState: 'STARTED',
                        _taskTimeInStateMs: 0
                    }
                )
                .put('/mgmt/tm/task/sys/config/123456', '{"_taskState":"VALIDATING"}')
                .reply(
                    202,
                    {
                        code: 202,
                        message: 'Task will execute asynchronously',
                        errorStack: []
                    }
                )
                .get('/mgmt/tm/task/sys/config/123456')
                .reply(
                    200, // Note: Even though the state FAILED, the status code remains 200
                    {
                        _taskId: 123456,
                        _taskState: 'FAILED',
                        _taskTimeInStateMs: 10000
                    }
                )
                .get('/mgmt/tm/task/sys/config/123456')
                .reply(
                    200,
                    {
                        _taskId: 123456,
                        _taskState: 'VALIDATING',
                        _taskTimeInStateMs: 15000
                    }
                );

            const storage = createStorage();
            storage._dirty = true;
            return assert.isRejected(storage.persist(), /Configuration save failed during execution/)
                .then(() => {
                    assert.deepStrictEqual(
                        localnock.pendingMocks(),
                        [
                            'GET http://localhost:8100/mgmt/tm/task/sys/config/123456'
                        ]
                    );
                });
        });

        it('should error if we run out of retries', () => {
            const localnock = nock('http://localhost:8100')
                .post('/mgmt/tm/task/sys/config')
                .reply(
                    200,
                    {
                        _taskId: 123456,
                        _taskState: 'STARTED',
                        _taskTimeInStateMs: 0
                    }
                )
                .put('/mgmt/tm/task/sys/config/123456', '{"_taskState":"VALIDATING"}')
                .reply(
                    202,
                    {
                        code: 202,
                        message: 'Task will execute asynchronously',
                        errorStack: []
                    }
                )
                .get('/mgmt/tm/task/sys/config/123456')
                .times(121)
                .reply(
                    200,
                    {
                        _taskId: 123456,
                        _taskState: 'VALIDATING',
                        _taskTimeInStateMs: 15000
                    }
                );

            const storage = createStorage();
            storage._dirty = true;
            return assert.isRejected(storage.persist(), /Configuration save taking longer than expected/)
                .then(() => {
                    assert.deepStrictEqual(localnock.pendingMocks(), []);
                });
        });
    });
});
