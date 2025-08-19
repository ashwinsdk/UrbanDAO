require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-contract-sizer");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/**
 * Example .env variables (create .env file in backend/ directory):
 * PRIVATE_KEY=07446a2aab1e7449202eaad0a2fc66089511a091218acc4414288b80dd7e18b1
 * SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/fce8183a885b4d70a55129db4665bf8d
 * OWNER_GOVT=0x1234567890123456789012345678901234567890
 * RELAYER=0x2345678901234567890123456789012345678901
 * TREASURY=0x3456789012345678901234567890123456789012
 * PINATA_API_KEY=b56e744235550696bd6f
 * PINATA_SECRET=5da143f033a42cc06915d65c5f8db9b70a0843fb0579aed3447059d13f0af0cd
 * ETHERSCAN_API_KEY=42NY9A6AY4TD77QAEVS121QGS74AXVTFAI
 */

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
