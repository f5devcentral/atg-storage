'use strict';

const StorageMemory = require('./storageMemory');
const StorageDataGroup = require('./storageDataGroup');

const allStorageClasses = [
    StorageMemory,
    StorageDataGroup
];

module.exports = {
    allStorageClasses,
    StorageMemory,
    StorageDataGroup
};
