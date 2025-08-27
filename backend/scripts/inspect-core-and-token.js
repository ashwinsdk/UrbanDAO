require('dotenv').config();
const { ethers } = require('ethers');

const UrbanCoreArtifact = require('../artifacts/contracts/UrbanCore.sol/UrbanCore.json');
const UrbanTokenArtifact = require('../artifacts/contracts/UrbanToken.sol/UrbanToken.json');

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('Missing SEPOLIA_RPC_URL in .env');
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const coreAddress = process.env.URBAN_CORE_ADDRESS;
  const tokenAddressEnv = process.env.URBAN_TOKEN_ADDRESS;
  if (!coreAddress || !tokenAddressEnv) throw new Error('Missing URBAN_CORE_ADDRESS/URBAN_TOKEN_ADDRESS in .env');

  const core = new ethers.Contract(coreAddress, UrbanCoreArtifact.abi, provider);

  const coreTokenAddr = await core.urbanToken();
  console.log('UrbanCore.urbanToken():', coreTokenAddr);
  console.log('Env URBAN_TOKEN_ADDRESS:', tokenAddressEnv);
  console.log('Match?', coreTokenAddr.toLowerCase() === tokenAddressEnv.toLowerCase());

  const token = new ethers.Contract(tokenAddressEnv, UrbanTokenArtifact.abi, provider);
  const OWNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OWNER_ROLE'));
  const hasOwnerOnToken = await token.hasRole(OWNER_ROLE, coreAddress);
  console.log('UrbanToken.hasRole(OWNER_ROLE, UrbanCore):', hasOwnerOnToken);

  // Optional: check a validator has VALIDATOR_ROLE on core
  const validator = process.env.VALIDATOR_ADDRESS;
  if (validator) {
    const VALIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('VALIDATOR_ROLE'));
    const validatorHas = await core.hasRole(VALIDATOR_ROLE, validator);
    console.log('UrbanCore.hasRole(VALIDATOR_ROLE, validator):', validatorHas, 'validator', validator);
  } else {
    console.log('Set VALIDATOR_ADDRESS in .env to also check validator role.');
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
