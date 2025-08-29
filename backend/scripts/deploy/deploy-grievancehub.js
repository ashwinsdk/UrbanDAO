/*
Usage:
  npx hardhat run backend/scripts/deploy-grievancehub.js --network sepolia 

Reads:
  docs/contract_addresses.json for:
    - MetaForwarder address
    - config.ownerGovt (used as owner + adminGovt by default)

Constructor: GrievanceHub(owner, adminGovt, trustedForwarder)
*/

const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

async function main() {
  const addressesPath = path.resolve(__dirname, '..', 'deployed', 'addresses.json');
  const docsAddressesPath = path.resolve(__dirname, '..', '..', 'docs', 'contract_addresses.json');

  // Prefer docs/contract_addresses.json if present, else fallback to backend/deployed/addresses.json
  const sourcePath = fs.existsSync(docsAddressesPath) ? docsAddressesPath : addressesPath;
  const registry = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
  const contracts = registry.contracts || registry; // handle either shape

  const metaForwarder = contracts.MetaForwarder;
  if (!metaForwarder) throw new Error('MetaForwarder address not found in addresses JSON');

  const ownerGovt = (registry.config && registry.config.ownerGovt) || process.env.OWNER_GOVT;
  if (!ownerGovt) throw new Error('ownerGovt not found in addresses JSON config and OWNER_GOVT env not set');

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Using trusted forwarder: ${metaForwarder}`);
  console.log(`Owner/AdminGovt seed: ${ownerGovt}`);

  const GHFactory = await ethers.getContractFactory('GrievanceHub');
  const gh = await GHFactory.deploy(ownerGovt, ownerGovt, metaForwarder);
  const receipt = await gh.deploymentTransaction().wait();

  console.log('GrievanceHub deployed at:', gh.target);
  console.log('Tx hash:', receipt.hash);

  // Persist address back to JSON
  try {
    if (registry.contracts) {
      registry.contracts.GrievanceHub = gh.target;
      registry.timestamp = new Date().toISOString();
      fs.writeFileSync(sourcePath, JSON.stringify(registry, null, 2));
    } else {
      contracts.GrievanceHub = gh.target;
      fs.writeFileSync(sourcePath, JSON.stringify(contracts, null, 2));
    }
    console.log(`Updated addresses JSON at ${sourcePath}`);
  } catch (e) {
    console.warn('Failed to persist address update:', e.message);
  }

  // Print a command hint to map UrbanCore -> new GH
  const coreAddr = contracts.UrbanCore;
  if (coreAddr) {
    console.log('\nNext: map new GrievanceHub in UrbanCore via setGrievanceHub');
    console.log(`  UrbanCore: ${coreAddr}`);
    console.log(`  New GrievanceHub: ${gh.target}`);
    console.log('  Command: npx hardhat run backend/scripts/map-grievancehub-to-core.js --network sepolia --gh', gh.target);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
