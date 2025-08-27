/**
 * Grant OWNER_ROLE on UrbanToken to UrbanCore contract
 * Fixes revert: "AccessControl: account <UrbanCore> is missing role <OWNER_ROLE>"
 * That revert occurs when UrbanCore calls UrbanToken.mintOnboard(), which requires OWNER_ROLE on UrbanToken.
 */

require('dotenv').config();
const { ethers } = require('ethers');

// Import token artifact
const UrbanTokenArtifact = require('../artifacts/contracts/UrbanToken.sol/UrbanToken.json');

async function main() {
  // Basic env checks
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('Missing SEP0LIA_RPC_URL in .env');

  const ownerPrivKey = process.env.OWNER_ROLE; // Private key of an address that HAS OWNER_ROLE on UrbanToken
  if (!ownerPrivKey) throw new Error('Missing OWNER_ROLE private key in .env');

  const tokenAddress = process.env.URBAN_TOKEN_ADDRESS;
  if (!tokenAddress) throw new Error('Missing URBAN_TOKEN_ADDRESS in .env');

  const urbanCoreAddress = process.env.URBAN_CORE_ADDRESS;
  if (!urbanCoreAddress) throw new Error('Missing URBAN_CORE_ADDRESS in .env');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(ownerPrivKey, provider);

  console.log('Network:', await provider.getNetwork());
  console.log('Signer:', signer.address);
  console.log('UrbanToken:', tokenAddress);
  console.log('UrbanCore (grantee):', urbanCoreAddress);

  const token = new ethers.Contract(tokenAddress, UrbanTokenArtifact.abi, signer);

  const OWNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OWNER_ROLE'));
  console.log('OWNER_ROLE hash:', OWNER_ROLE);

  // Check current role
  const hasRole = await token.hasRole(OWNER_ROLE, urbanCoreAddress);
  console.log('UrbanCore has OWNER_ROLE on UrbanToken?', hasRole);
  if (hasRole) {
    console.log('✓ Already granted. Nothing to do.');
    return;
  }

  // Grant role
  console.log('Granting OWNER_ROLE on UrbanToken to UrbanCore...');
  const tx = await token.grantRole(OWNER_ROLE, urbanCoreAddress);
  console.log('Tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed in block', receipt.blockNumber);

  const after = await token.hasRole(OWNER_ROLE, urbanCoreAddress);
  console.log('Post-check UrbanCore has OWNER_ROLE?', after);
  if (!after) throw new Error('Grant failed: UrbanCore still missing OWNER_ROLE on UrbanToken');
  console.log('✓ Success');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
}
