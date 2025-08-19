const { ethers } = require("hardhat");

// Define the same role constants as in AccessRoles.sol
const AccessRoles = {
    OWNER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE")),
    ADMIN_GOVT_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ADMIN_GOVT_ROLE")),
    ADMIN_HEAD_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ADMIN_HEAD_ROLE")),
    PROJECT_MANAGER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("PROJECT_MANAGER_ROLE")),
    TAX_COLLECTOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("TAX_COLLECTOR_ROLE")),
    VALIDATOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("VALIDATOR_ROLE")),
    CITIZEN_ROLE: ethers.keccak256(ethers.toUtf8Bytes("CITIZEN_ROLE")),
    TX_PAYER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("TX_PAYER_ROLE"))
};

module.exports = {
    AccessRoles
};
