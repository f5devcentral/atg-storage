'use strict';

const { Pool } = require('pg');

const sinon = require('sinon');

const StoragePostgres = require('../src/storagePostgres');

const generateCommonTests = require('../../../test/generateCommonTests');


describe('StoragePostgres', () => {
    function createStorage() {
        return new StoragePostgres('test');
    }

    beforeEach(() => {
        let data = null;

        const queries = {
            'CREATE TABLE': () => {
                if (!data) {
                    data = {
                        hello: 'world',
                        world: 'hello'
                    };
                }
            },
            'DROP TABLE': () => {
                if (data) {
                    data = null;
                }
            },
            'SELECT key FROM': () => ({
                rows: Object.keys(data).map(key => ({
                    key
                }))
            }),
            'SELECT value FROM': (_queryString, queryParams) => ({
                rows: [
                    { value: data[queryParams[0]] }
                ]
            }),
            'DELETE FROM': (_queryString, queryParams) => {
                delete data[queryParams[0]];
            },
            'INSERT INTO': (_queryString, queryParams) => {
                const [key, value] = queryParams;
                data[key] = value;
            }
        };
        sinon.stub(Pool.prototype, 'query').callsFake((queryString, queryParams) => {
            let retval = null;
            Object.keys(queries).forEach((queryStub) => {
                if (queryString.startsWith(queryStub)) {
                    retval = Promise.resolve(queries[queryStub](queryString, queryParams));
                }
            });
            if (!retval) {
                return Promise.reject(new Error(`No mock found for queryString: ${queryString}`));
            }

            return retval;
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    generateCommonTests(createStorage);
});
