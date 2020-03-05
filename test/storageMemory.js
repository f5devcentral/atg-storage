'use strict';

const StorageMemory = require('../src/storageMemory');

const generateCommonTests = require('./generateCommonTests');

describe('StorageMemory', () => {
    function createStorage() {
        return new StorageMemory({
            hello: 'world',
            world: 'hello'
        });
    }

    generateCommonTests(createStorage);
});
