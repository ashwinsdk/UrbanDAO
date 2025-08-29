/**
 * Grant OWNER_ROLE to UrbanCore contract
 * This fixes the citizen approval issue where UrbanCore needs OWNER_ROLE
 */

require('dotenv').config();
const { ethers } = require('ethers');

// Import contract artifacts
const UrbanCoreArtifact = require('../../artifacts/contracts/UrbanCore.sol/UrbanCore.json');

async function grantOwnerRoleToContract() {
  try {
    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    console.log('Connected to Sepolia');

    // Setup signer with owner private key
    const ownerPrivateKey = process.env.OWNER_ROLE;
    if (!ownerPrivateKey) {
      throw new Error('OWNER_ROLE private key not found in .env');
    }

    const signer = new ethers.Wallet(ownerPrivateKey, provider);
    console.log(`Using owner wallet: ${signer.address}`);

    // Connect to UrbanCore contract
    const urbanCoreAddress = process.env.URBAN_CORE_ADDRESS;
    if (!urbanCoreAddress) {
      throw new Error('URBAN_CORE_ADDRESS not found in .env');
    }

    const urbanCore = new ethers.Contract(
      urbanCoreAddress,
      UrbanCoreArtifact.abi,
      signer
    );

    console.log(`UrbanCore contract: ${urbanCoreAddress}`);

    // OWNER_ROLE hash
    const ownerRoleHash = ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE"));
    console.log(`OWNER_ROLE hash: ${ownerRoleHash}`);

    // Check if UrbanCore already has OWNER_ROLE
    const hasRole = await urbanCore.hasRole(ownerRoleHash, urbanCoreAddress);
    if (hasRole) {
      console.log('✓ UrbanCore already has OWNER_ROLE');
      return;
    }

    console.log('Granting OWNER_ROLE to UrbanCore contract...');

    // Grant the role
    const tx = await urbanCore.grantRole(ownerRoleHash, urbanCoreAddress);
    console.log(`Transaction hash: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✓ Transaction confirmed in block ${receipt.blockNumber}`);

    // Verify the role was granted
    const hasRoleAfter = await urbanCore.hasRole(ownerRoleHash, urbanCoreAddress);
    if (hasRoleAfter) {
      console.log('✓ Successfully granted OWNER_ROLE to UrbanCore');
    } else {
      console.error('✗ Failed to grant OWNER_ROLE');
    }

  } catch (error) {
    console.error('Error granting OWNER_ROLE:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  grantOwnerRoleToContract()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}
