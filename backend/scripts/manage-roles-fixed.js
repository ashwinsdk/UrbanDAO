// SPDX-License-Identifier: MIT
/**
 * UrbanDAO Role Management Script (Fixed for ethers.js v6)
 * 
 * This script manages roles for the UrbanDAO system by:
 * 1. Reading roles configuration from roles.json
 * 2. Connecting to the deployed UrbanCore contract
 * 3. Verifying current role assignments
 * 4. Assigning missing roles following proper hierarchy
 * 5. Updating roles.json with verification status
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Import contract artifacts
const UrbanCoreArtifact = require('../artifacts/contracts/UrbanCore.sol/UrbanCore.json');

// Load deployment addresses and role configuration
const DEPLOYED_ADDRESSES = require('../deployed/addresses.json');
const ROLES_JSON_PATH = path.join(__dirname, '../../docs/roles.json');
const ROLES_CONFIG = require(ROLES_JSON_PATH);

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

// Role assignment hierarchy based on AccessRoles.sol
const ROLE_HIERARCHY = {
  OWNER_ROLE: null, // Owner is set during deployment
  ADMIN_GOVT_ROLE: "OWNER_ROLE",
  ADMIN_HEAD_ROLE: "ADMIN_GOVT_ROLE",
  PROJECT_MANAGER_ROLE: "ADMIN_HEAD_ROLE",
  TAX_COLLECTOR_ROLE: "ADMIN_HEAD_ROLE",
  VALIDATOR_ROLE: "ADMIN_HEAD_ROLE",
  CITIZEN_ROLE: null, // Not assigned through this script
  TX_PAYER_ROLE: "OWNER_ROLE"
};

// Setup provider
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

// Connect to contracts with the specified signer
async function connectWithSigner(privateKey, provider) {
  const signer = new ethers.Wallet(privateKey, provider);
  console.log(`Using wallet with address: ${signer.address}`);
  
  const urbanCoreAddress = process.env.URBAN_CORE_ADDRESS || DEPLOYED_ADDRESSES.contracts.UrbanCore;
  console.log(`UrbanCore address: ${urbanCoreAddress}`);
  
  const urbanCore = new ethers.Contract(
    urbanCoreAddress,
    UrbanCoreArtifact.abi,
    signer
  );
  
  return { urbanCore, signer };
}

// Helper to get private key for a role
function getPrivateKeyForRole(roleName) {
  // First try to get from environment variables
  const envVar = `${roleName}_PRIVATE_KEY`;
  if (process.env[envVar]) {
    return process.env[envVar];
  }
  
  // Fall back to roles.json if available
  if (ROLES_CONFIG.roles[roleName] && ROLES_CONFIG.roles[roleName].private_key) {
    return ROLES_CONFIG.roles[roleName].private_key;
  }
  
  throw new Error(`No private key found for role ${roleName}`);
}

// Assign a role to an address
async function assignRole(role, targetAddress, signerPrivateKey, provider) {
  try {
    const { urbanCore, signer } = await connectWithSigner(signerPrivateKey, provider);
    
    // Check if role is already assigned
    const roleHash = ROLE_CONSTANTS[role];
    const hasRole = await urbanCore.hasRole(roleHash, targetAddress);
    
    if (hasRole) {
      console.log(`✓ Address ${targetAddress} already has role ${role}`);
      return { success: true, status: 'already_assigned' };
    }
    
    // If not assigned, grant the role using low-level call
    console.log(`Assigning ${role} to ${targetAddress}...`);
    
    // Encode function call manually to avoid name resolution issues
    // Function signature: grantRole(bytes32 role, address account)
    const grantRoleFunction = urbanCore.interface.getFunction('grantRole');
    const data = urbanCore.interface.encodeFunctionData(
      grantRoleFunction, 
      [roleHash, targetAddress]
    );
    
    // Send transaction
    const tx = await signer.sendTransaction({
      to: urbanCore.target,
      data: data,
      gasLimit: 300000
    });
    
    console.log(`Transaction hash: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`✓ Successfully assigned ${role} to ${targetAddress}`);
    
    return { 
      success: true, 
      status: 'assigned', 
      txHash: tx.hash, 
      blockNumber: receipt.blockNumber 
    };
    
  } catch (error) {
    console.error(`Error assigning role ${role} to ${targetAddress}: ${error.message}`);
    return { 
      success: false, 
      status: 'failed', 
      error: error.message 
    };
  }
}

// Main function to manage roles
async function manageRoles() {
  try {
    // Setup provider
    const provider = await setupProvider();
    
    // Track results
    const results = {
      alreadyAssigned: [],
      successfullyAssigned: [],
      failed: []
    };
    
    // First, verify the owner role
    const ownerAddress = ROLES_CONFIG.roles.OWNER_ROLE.address;
    const { urbanCore } = await connectWithSigner(
      getPrivateKeyForRole('OWNER_ROLE'), 
      provider
    );
    
    const hasOwnerRole = await urbanCore.hasRole(ROLE_CONSTANTS.OWNER_ROLE, ownerAddress);
    if (hasOwnerRole) {
      console.log(`\n======= Processing OWNER_ROLE =======`);
      console.log(`Target address: ${ownerAddress}`);
      console.log(`✓ Verified ${ownerAddress} has OWNER_ROLE`);
      results.alreadyAssigned.push({ role: 'OWNER_ROLE', address: ownerAddress });
    } else {
      console.error(`OWNER_ROLE is not assigned to ${ownerAddress}. This role should be set during deployment.`);
      results.failed.push({ 
        role: 'OWNER_ROLE', 
        address: ownerAddress, 
        reason: 'Owner role missing but should be set during deployment' 
      });
      // Early exit as owner is required for other role assignments
      console.error('Cannot proceed with role assignments as OWNER_ROLE is missing.');
      return results;
    }
    
    // Process other roles in hierarchy order
    const roleOrder = [
      'ADMIN_GOVT_ROLE',
      'ADMIN_HEAD_ROLE',
      'PROJECT_MANAGER_ROLE',
      'TAX_COLLECTOR_ROLE',
      'VALIDATOR_ROLE',
      'TX_PAYER_ROLE'
    ];
    
    for (const roleName of roleOrder) {
      const roleData = ROLES_CONFIG.roles[roleName];
      if (!roleData) continue; // Skip if role not in config
      
      const { address } = roleData;
      
      console.log(`\n======= Processing ${roleName} =======`);
      console.log(`Target address: ${address}`);
      
      // Get admin role that can assign this role
      const adminRoleName = ROLE_HIERARCHY[roleName];
      if (!adminRoleName) {
        console.log(`${roleName} has no admin role defined, skipping`);
        continue;
      }
      
      // Get private key for admin role
      let adminPrivateKey;
      try {
        adminPrivateKey = getPrivateKeyForRole(adminRoleName);
      } catch (error) {
        console.error(`Cannot get private key for ${adminRoleName}: ${error.message}`);
        results.failed.push({ 
          role: roleName, 
          address, 
          reason: `Admin private key not available: ${error.message}` 
        });
        continue;
      }
      
      // Assign role
      const result = await assignRole(roleName, address, adminPrivateKey, provider);
      
      if (result.success) {
        if (result.status === 'already_assigned') {
          results.alreadyAssigned.push({ role: roleName, address });
        } else {
          results.successfullyAssigned.push({ 
            role: roleName, 
            address, 
            txHash: result.txHash 
          });
        }
      } else {
        results.failed.push({ 
          role: roleName, 
          address, 
          reason: result.error 
        });
      }
    }
    
    // Print summary
    console.log("\n======= Role Management Summary =======");
    console.log(`Roles already assigned: ${results.alreadyAssigned.length}`);
    console.log(`Roles successfully assigned: ${results.successfullyAssigned.length}`);
    console.log(`Failed role assignments: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
      console.log("\nFailed assignments:");
      results.failed.forEach(item => {
        console.log(`- ${item.role} -> ${item.address}`);
      });
    }
    
    // Update roles.json with verification status
    updateRolesJson(results);
    
    return results;
  } catch (error) {
    console.error(`Error in manageRoles: ${error.message}`);
    console.error(error);
    return { alreadyAssigned: [], successfullyAssigned: [], failed: [] };
  }
}

// Update roles.json with verification status
function updateRolesJson(results) {
  const updatedConfig = { ...ROLES_CONFIG };
  
  // Update status for each role
  for (const role of results.alreadyAssigned) {
    if (updatedConfig.roles[role.role]) {
      updatedConfig.roles[role.role].status = 'verified';
    }
  }
  
  for (const role of results.successfullyAssigned) {
    if (updatedConfig.roles[role.role]) {
      updatedConfig.roles[role.role].status = 'verified';
      updatedConfig.roles[role.role].txHash = role.txHash;
    }
  }
  
  for (const role of results.failed) {
    if (updatedConfig.roles[role.role]) {
      updatedConfig.roles[role.role].status = 'failed';
      updatedConfig.roles[role.role].reason = role.reason;
    }
  }
  
  // Write updated config back to file
  fs.writeFileSync(ROLES_JSON_PATH, JSON.stringify(updatedConfig, null, 2));
  console.log(`Updated roles.json with verification status at ${ROLES_JSON_PATH}`);
}

// Run the script if called directly
if (require.main === module) {
  manageRoles()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { manageRoles };
