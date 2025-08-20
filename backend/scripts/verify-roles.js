// SPDX-License-Identifier: MIT
/**
 * UrbanDAO Role Verification Script
 * 
 * This script verifies the current role assignments in the UrbanDAO system
 * without making any changes. It's useful for checking the current state
 * before deciding to make any role assignments.
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Import contract artifacts
const UrbanCoreArtifact = require('../artifacts/contracts/UrbanCore.sol/UrbanCore.json');
const AccessRolesArtifact = require('../artifacts/contracts/AccessRoles.sol/AccessRoles.json');

// Load deployment addresses and role configuration
const DEPLOYED_ADDRESSES = require('../deployed/addresses.json');
const ROLES_CONFIG = require('../../docs/roles.json');

// Role constants - these match the constants in AccessRoles.sol
const ROLE_CONSTANTS = {
  OWNER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE")),
  ADMIN_GOVT_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ADMIN_GOVT_ROLE")),
  ADMIN_HEAD_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ADMIN_HEAD_ROLE")),
  PROJECT_MANAGER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("PROJECT_MANAGER_ROLE")),
  TAX_COLLECTOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("TAX_COLLECTOR_ROLE")),
  VALIDATOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("VALIDATOR_ROLE")),
  CITIZEN_ROLE: ethers.keccak256(ethers.toUtf8Bytes("CITIZEN_ROLE")),
  TX_PAYER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("TX_PAYER_ROLE"))
};

// Provider setup
async function setupProvider() {
  let provider;
  let networkName;
  
  if (process.env.SEPOLIA_RPC_URL) {
    provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    networkName = 'sepolia';
  } else {
    // Default to local development network
    provider = new ethers.JsonRpcProvider('http://localhost:8545');
    networkName = 'localhost';
  }
  
  console.log(`Connected to network: ${networkName}`);
  return provider;
}

// Connect to the UrbanCore contract in read-only mode
async function getUrbanCoreContract(provider) {
  const urbanCoreAddress = DEPLOYED_ADDRESSES.contracts.UrbanCore;
  console.log(`UrbanCore address: ${urbanCoreAddress}`);
  
  const urbanCore = new ethers.Contract(
    urbanCoreAddress,
    UrbanCoreArtifact.abi,
    provider
  );
  
  return urbanCore;
}

// Main function to verify roles
async function verifyRoles() {
  try {
    // Setup provider
    const provider = await setupProvider();
    const urbanCore = await getUrbanCoreContract(provider);
    
    console.log("\n======= UrbanDAO Role Verification =======");
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Network: ${DEPLOYED_ADDRESSES.network}`);
    console.log(`Contract: ${DEPLOYED_ADDRESSES.contracts.UrbanCore}`);
    
    const results = {
      verified: [],
      missing: [],
      unknown: []
    };
    
    // Check each role in the configuration
    for (const [roleName, roleData] of Object.entries(ROLES_CONFIG.roles)) {
      const { address } = roleData;
      console.log(`\nChecking ${roleName} for address ${address}...`);
      
      try {
        const hasRole = await urbanCore.hasRole(ROLE_CONSTANTS[roleName], address);
        
        if (hasRole) {
          console.log(`✅ ${address} HAS the ${roleName} role`);
          results.verified.push({ role: roleName, address });
        } else {
          console.log(`❌ ${address} does NOT have the ${roleName} role`);
          results.missing.push({ role: roleName, address });
        }
      } catch (error) {
        console.error(`Error checking ${roleName}: ${error.message}`);
        results.unknown.push({ role: roleName, address, error: error.message });
      }
    }
    
    // Print summary
    console.log("\n======= Verification Summary =======");
    console.log(`✅ Verified roles: ${results.verified.length}`);
    console.log(`❌ Missing roles: ${results.missing.length}`);
    console.log(`⚠️ Unknown status: ${results.unknown.length}`);
    
    // Print details for missing roles
    if (results.missing.length > 0) {
      console.log("\nMissing role assignments:");
      results.missing.forEach(item => {
        console.log(`- ${item.role}: ${item.address}`);
      });
    }
    
    // Write verification results to file
    const outputPath = path.join(__dirname, '../../docs/role-verification.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      network: DEPLOYED_ADDRESSES.network,
      contract: DEPLOYED_ADDRESSES.contracts.UrbanCore,
      results
    }, null, 2));
    
    console.log(`\nVerification results saved to: ${outputPath}`);
    return results;
    
  } catch (error) {
    console.error(`Error in verifyRoles: ${error.message}`);
    console.error(error);
    return { verified: [], missing: [], unknown: [] };
  }
}

// Run the script if called directly
if (require.main === module) {
  verifyRoles()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { verifyRoles };
