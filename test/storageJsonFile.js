'use strict';

const fs = require('fs');

const mockfs = require('mock-fs');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const StorageJsonFile = require('../src/storageJsonFile');

const generateCommonTests = require('./generateCommonTests');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('StorageJsonFile', () => {
    function createStorage() {
        return new StorageJsonFile('test.json', {
            hello: 'world',
            world: 'hello'
        });
    }

    afterEach(() => {
        mockfs.restore();
    });

    generateCommonTests(createStorage);

    describe('Init', () => {
        it('should allow loading inital values from file', () => {
            mockfs({
                'test.json': '{ "foo": 10 }'
            });

            const storage = createStorage();
            return assert.becomes(storage.getItem('foo'), 10);
        });
        it('should not error on an empty file', () => {
            mockfs({
                'test.json': ''
            });

            const storage = createStorage();
            assert.ok(storage);
        });
        it('should error if file cannot be read', () => {
            mockfs({
                'test.json': {}
            });

            try {
                createStorage();
                assert(false, 'creation should fail');
            } catch (e) {
                assert.match(e.message, /EISDIR/);
            }
        });
    });

    describe('persist()', () => {
        it('should persist data to disk', () => {
            mockfs({
            });

            const storage = createStorage();

            return Promise.resolve()
                .then(() => storage.setItem('foo', 2))
                .then(() => storage.persist())
                .then(() => {
                    assert(fs.existsSync('test.json'));
                    const data = JSON.parse(fs.readFileSync('test.json', { encoding: 'utf8' }));
                    assert.strictEqual(data.foo, 2);
                });
        });
        it('should pass up write errors', () => {
            mockfs({
            });

            const storage = createStorage();

            mockfs({
                'test.json': {}
            });

            return assert.isRejected(storage.persist(), /EISDIR/);
        });
    });
});
