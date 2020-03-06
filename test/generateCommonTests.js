'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

module.exports = function generateCommonTests(createStorage) {
    describe('.hasItem() (common)', () => {
        it('should reject on missing keyName', () => {
            const storage = createStorage();
            return assert.isRejected(storage.hasItem(), 'keyName');
        });
        it('should return true if key exists', () => {
            const storage = createStorage();
            return assert.becomes(storage.hasItem('hello'), true);
        });
        it('should return false if key does not exist', () => {
            const storage = createStorage();
            return assert.becomes(storage.hasItem('does_not_exist'), false);
        });
    });

    describe('.keys() (common)', () => {
        it('should return a list of keys', () => {
            const storage = createStorage();
            return Promise.resolve()
                .then(() => storage.keys())
                .then((keys) => {
                    assert(keys.indexOf('hello') > -1);
                });
        });
    });

    describe('.setItem() (common)', () => {
        it('should reject on missing keyName', () => {
            const storage = createStorage();
            return assert.isRejected(storage.setItem(), 'keyName');
        });
        it('should resolve when given keyName', () => {
            const storage = createStorage();
            return assert.isFulfilled(storage.setItem('foo', 'bar'));
        });
        it('should be reachable with getItem()', () => {
            const storage = createStorage();
            return Promise.resolve()
                .then(() => storage.setItem('foo', 'bar'))
                .then(() => assert.becomes(storage.getItem('foo'), 'bar'));
        });
    });

    describe('.getItem() (common)', () => {
        it('should reject on missing keyName', () => {
            const storage = createStorage();
            return assert.isRejected(storage.getItem(), 'keyName');
        });
        it('should return data if the key is defined', () => {
            const storage = createStorage();
            return assert.becomes(storage.getItem('hello'), 'world');
        });
        it('should return undefined if key is missing', () => {
            const storage = createStorage();
            return assert.becomes(storage.getItem('missing'), undefined);
        });
    });

    describe('.deleteItem() (common)', () => {
        it('should reject on missing keyName', () => {
            const storage = createStorage();
            return assert.isRejected(storage.deleteItem(), 'keyName');
        });
        it('should remove key', () => {
            const storage = createStorage();
            return Promise.resolve()
                .then(() => storage.deleteItem('hello'))
                .then(() => storage.keys())
                .then((keys) => {
                    assert(keys.indexOf('hello') < 0, 'hello was not deleted');
                    assert(keys.indexOf('world') > -1, 'world was deleted');
                });
        });
    });
};
