# Elvate Core

This repository contains the core smart contracts for the Elvate App V1.

## Local deployment

Install the npm package `@elvate/v1-core`

using `npm`:

```shell
npm install --save-dev @elvate/v1-core
```

using `yarn`:

```shell
yarn add --dev @elvate/v1-core
```

You can now import the factory bytecode located at `@elvate/v1-core/artifacts/contracts/ElvateCore.sol/ElvateCore.json`. For example:

```js
import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@elvate/v1-core/artifacts/contracts/ElvateCore.sol/ElvateCore.json'

// deploy the bytecode
```

## Run Tests

```shell
npm install
npm run compile
npm run test
```
