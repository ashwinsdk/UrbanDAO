/**
 * JavaScript equivalent of AccessRoles.sol constants
 * For use in tests to reference role hashes consistently
 */
const { ethers } = require("hardhat");

// OpenZeppelin's DEFAULT_ADMIN_ROLE is 0x00
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Calculate role hashes using the same keccak256 function as the contract
const OWNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE"));
const ADMIN_GOVT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_GOVT_ROLE"));
const ADMIN_HEAD_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_HEAD_ROLE"));
const PROJECT_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROJECT_MANAGER_ROLE"));
const TAX_COLLECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TAX_COLLECTOR_ROLE"));
const VALIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VALIDATOR_ROLE"));
const CITIZEN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("CITIZEN_ROLE"));
const TX_PAYER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TX_PAYER_ROLE"));
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

module.exports = {
    OWNER_ROLE,
    ADMIN_GOVT_ROLE,
    ADMIN_HEAD_ROLE,
    PROJECT_MANAGER_ROLE,
    TAX_COLLECTOR_ROLE,
    VALIDATOR_ROLE,
    CITIZEN_ROLE,
    TX_PAYER_ROLE,
    DEFAULT_ADMIN_ROLE,
    MINTER_ROLE
};
