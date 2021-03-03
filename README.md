# atg-storage

## Overview
This is a Node library to provide an abstraction layer over multiple storage backends for BIG-IP iControl LX Extensions. 

## Installation
You can install the package with NPM:
```bash
npm install --save \@f5devcentral/atg-storage
```

If you need changes that are not yet available on NPM, you can install the package from this repository.
It is recommended that you specify a commit or tag to avoid pulling in unwanted commits from the master branch:
```bash
npm install --save \@f5devcentral/atg-storage@git+https://github.com/f5devcentral/atg-storage.git#v0.1.0
```

## Extensions

The `extentions` directory contains additional NPM modules that can be used with atg-storage.
These are built as separate modules to avoid adding too many dependencies to atg-storage itself.
They can be installed using `npm` as usual.

* atg-storage-postgres - adds a PostgreSQL backend

## Copyright

Copyright 2021 F5 Networks Inc.

## F5 Networks Contributor License Agreement
Before you start contributing to any project sponsored by F5 Networks, Inc. (F5) on GitHub, you will need to sign a Contributor License Agreement (CLA).

If you are signing as an individual, we recommend that you talk to your employer (if applicable) before signing the CLA since some employment agreements may have restrictions on your contributions to other projects. Otherwise by submitting a CLA you represent that you are legally entitled to grant the licenses recited therein.

If your employer has rights to intellectual property that you create, such as your contributions, you represent that you have received permission to make contributions on behalf of that employer, that your employer has waived such rights for your contributions, or that your employer has executed a separate CLA with F5.

If you are signing on behalf of a company, you represent that you are legally entitled to grant the license recited therein. You represent further that each employee of the entity that submits contributions is authorized to submit such contributions on behalf of the entity pursuant to the CLA.
