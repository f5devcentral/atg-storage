'use strict';

const childProcess = require('child_process');
const sinon = require('sinon');
const stripIndent = require('common-tags').stripIndent;

beforeEach(() => {
    let isFolderCreated = false;
    let isDataGroupCreated = false;
    process.tmshcmds = {
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
        Object.keys(process.tmshcmds).forEach((cmdstr) => {
            if (command.includes(cmdstr)) {
                process.tmshcmds[cmdstr](callback, command);
                foundCmd = true;
            }
        });

        if (!foundCmd) {
            callback();
        }
    });
});

afterEach(() => {
    sinon.restore();
});
