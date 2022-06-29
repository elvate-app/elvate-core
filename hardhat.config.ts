import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import * as dotenv from "dotenv";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-interface-generator";
import { HardhatUserConfig, task } from "hardhat/config";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.1",
        settings: {
          optimizer: {
            enabled: true,
            runs: 800,
          },
        },
      },
    ],
    overrides: {
      "contracts/libs/WETH9.sol": {
        version: "0.4.18",
        settings: {},
      },
    },
  },
  networks: {
    polygon_mumbai: {
      url: process.env.POLYGON_MUMBAI_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 35000000000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true" || undefined,
    currency: "USD",
    // gasPriceApi:
    //   "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice",
    // token: "MATIC",
    gasPrice: 35,
    coinmarketcap: process.env.CMC_API_KEY,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [':ElvateCore$'],
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
