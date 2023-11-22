# Contributing

## How to run source tests
To run the unit tests run: `npm run test`

To check unit test coverage run: `npm run coverage`

To run the linter run: `npm run lint`

* Note: Node v14 or lower must be used when running source tests. Newer versions of Node will result in an Uncaught TypeError due to constraints involving the Nock package version. Consider using Node Version Manager (NVM) to quickly switch between Node versions.

## How to submit changes
Thank you for considering contributing changes to this repository.
If you have some changes you wish to submit, please fork the repository and submit a pull request.

## F5 Networks Contributor License Agreement
Before you start contributing to any project sponsored by F5 Networks, Inc. (F5) on GitHub, you will need to sign a Contributor License Agreement (CLA).

If you are signing as an individual, we recommend that you talk to your employer (if applicable) before signing the CLA since some employment agreements may have restrictions on your contributions to other projects. Otherwise by submitting a CLA you represent that you are legally entitled to grant the licenses recited therein.

If your employer has rights to intellectual property that you create, such as your contributions, you represent that you have received permission to make contributions on behalf of that employer, that your employer has waived such rights for your contributions, or that your employer has executed a separate CLA with F5.

If you are signing on behalf of a company, you represent that you are legally entitled to grant the license recited therein. You represent further that each employee of the entity that submits contributions is authorized to submit such contributions on behalf of the entity pursuant to the CLA.

## Release process
* Merge changes into `master` branch
* Update CHANGELOG with date for release (likely today)
* `git checkout master`
* `git pull`
* `npm version`
  * Note: depending on what version is being released this command might be changed to `npm version patch` or another command
* `git push`
* `git push origin v{newVersion}`
  * Example: `git push origin v1.3.2`
  * Note: This will push the new tags created by the previous `npm version` command. You can confirm this via GitHub.
* Via GitHub create a new GitHub release, using the tag just pushed. Copy the relevant CHANGELOG entry into the release version message.
* `npm publish --dry-run`
  * Note: dry-run is used to confirm version number and changes
* `npm publish --access=public`
  * Note: this will publish the new npm version
