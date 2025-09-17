require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-contract-sizer");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris", // Use paris to avoid mcopy issues
    },
    viaIR: true,
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/fce8183a885b4d70a55129db4665bf8d",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : ["07446a2aab1e7449202eaad0a2fc66089511a091218acc4414288b80dd7e18b1"],
      // accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : ["157703d904153e724d8126002483b5a2cb389b641ebb35637870eec2f0b40b12"],
      gasPrice: 30000000000, // 30 gwei
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "42NY9A6AY4TD77QAEVS121QGS74AXVTFAI",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    ownerGovt: {
      default: process.env.OWNER_GOVT || 1,
    },
    relayer: {
      default: process.env.RELAYER || 2,
    },
    treasury: {
      default: process.env.TREASURY || 3,
    },
  },
  mocha: {
    timeout: 300000, // 5 minutes
  },
};
