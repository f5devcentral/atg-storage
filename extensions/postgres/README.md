# atg-storage-postgres

## Overview
[atg-storage](https://github.com/f5devcentral/atg-storage/) extension to add support for PostgreSQL as a backend.

## Installation
You can install the package with NPM:
```bash
npm install --save \@f5devcentral/atg-storage-postgres
```

## Usage

```javascript
const { StoragePostgres } = require('@f5devcentral/atg-storage-postgres');
const config = {
...
};
const storage = new StoragePostgres(config);
```

`config` gets passed along to the [pg.Client constructor](https://node-postgres.com/api/client), and can be used to configure the database connection.

## Copyright

Copyright 2021 F5 Networks Inc.

## F5 Networks Contributor License Agreement
Before you start contributing to any project sponsored by F5 Networks, Inc. (F5) on GitHub, you will need to sign a Contributor License Agreement (CLA).

If you are signing as an individual, we recommend that you talk to your employer (if applicable) before signing the CLA since some employment agreements may have restrictions on your contributions to other projects. Otherwise by submitting a CLA you represent that you are legally entitled to grant the licenses recited therein.

If your employer has rights to intellectual property that you create, such as your contributions, you represent that you have received permission to make contributions on behalf of that employer, that your employer has waived such rights for your contributions, or that your employer has executed a separate CLA with F5.

If you are signing on behalf of a company, you represent that you are legally entitled to grant the license recited therein. You represent further that each employee of the entity that submits contributions is authorized to submit such contributions on behalf of the entity pursuant to the CLA.
