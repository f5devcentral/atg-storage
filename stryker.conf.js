'use strict';

module.exports = (config) => {
    config.set({
        mutator: 'javascript',
        packageManager: 'npm',
        reporters: ['clear-text', 'progress'],
        testRunner: 'mocha',
        transpilers: [],
        testFramework: 'mocha',
        coverageAnalysis: 'perTest'
    });
};
