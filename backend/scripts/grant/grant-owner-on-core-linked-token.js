/**
 * Grant OWNER_ROLE on the token that UrbanCore is actually linked to (UrbanCore.urbanToken())
 */
require('dotenv').config();
const { ethers } = require('ethers');

const UrbanCoreArtifact = require('../../artifacts/contracts/UrbanCore.sol/UrbanCore.json');
const UrbanTokenArtifact = require('../../artifacts/contracts/UrbanToken.sol/UrbanToken.json');

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('Missing SEPOLIA_RPC_URL in .env');
  const ownerPrivKey = process.env.OWNER_ROLE;
  if (!ownerPrivKey) throw new Error('Missing OWNER_ROLE private key in .env');
  const coreAddress = process.env.URBAN_CORE_ADDRESS;
  if (!coreAddress) throw new Error('Missing URBAN_CORE_ADDRESS in .env');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(ownerPrivKey, provider);

  const core = new ethers.Contract(coreAddress, UrbanCoreArtifact.abi, signer);
  const linkedTokenAddr = await core.urbanToken();

  console.log('Signer:', signer.address);
  console.log('UrbanCore:', coreAddress);
  console.log('UrbanCore.urbanToken():', linkedTokenAddr);

  const token = new ethers.Contract(linkedTokenAddr, UrbanTokenArtifact.abi, signer);
  const OWNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OWNER_ROLE'));

  const hasBefore = await token.hasRole(OWNER_ROLE, coreAddress);
  console.log('Has OWNER_ROLE before?', hasBefore);
  if (hasBefore) {
    console.log('✓ Already granted on core-linked token. Nothing to do.');
    return;
  }

  console.log('Granting OWNER_ROLE on core-linked token to UrbanCore...');
  const tx = await token.grantRole(OWNER_ROLE, coreAddress);
  console.log('Tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed in block', receipt.blockNumber);

  const hasAfter = await token.hasRole(OWNER_ROLE, coreAddress);
  console.log('Has OWNER_ROLE after?', hasAfter);
  if (!hasAfter) throw new Error('Grant failed on core-linked token');
  console.log('✓ Success');
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
