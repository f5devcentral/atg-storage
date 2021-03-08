'use strict';

const { Pool } = require('pg');


class StoragePostgres {
    constructor(tablename, options) {
        options = options || {};

        this.pool = new Pool(Object.assign({}, options, {
            max: 1
        }));
        this.tablename = tablename;
        this._ready = false;
    }

    ensureTable() {
        return this.pool.query(`CREATE TABLE IF NOT EXISTS ${this.tablename} (
            key text NOT NULL,
            value jsonb NOT NULL,
            PRIMARY KEY (key)
        )`);
    }

    _lazyInit() {
        if (this._ready) {
            return Promise.resolve();
        }

        return this.ensureTable();
    }

    keys() {
        return this._lazyInit()
            .then(() => this.pool.query(`SELECT key FROM ${this.tablename}`))
            .then(result => result.rows.map(x => x.key));
    }

    hasItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return this.keys()
            .then(result => result.includes(keyName));
    }

    deleteItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return this._lazyInit()
            .then(() => this.pool.query(`DELETE FROM ${this.tablename} WHERE key=$1`, [keyName]));
    }

    setItem(keyName, keyValue) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }
        return this._lazyInit()
            .then(() => this.pool.query(
                [
                    `INSERT INTO ${this.tablename} (key, value) VALUES ($1, $2)`,
                    'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value'
                ].join(' '),
                [keyName, keyValue]
            ));
    }

    getItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return this._lazyInit()
            .then(() => this.pool.query(`SELECT value FROM ${this.tablename} WHERE key=$1`, [keyName]))
            .then(result => result.rows[0] && result.rows[0].value);
    }

    persist() {
        return Promise.resolve();
    }
}

module.exports = StoragePostgres;
