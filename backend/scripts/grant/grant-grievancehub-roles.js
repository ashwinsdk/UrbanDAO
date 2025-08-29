/*
Usage (prefer environment variables to avoid Hardhat HH305 unknown param errors):
  GH=0x<GH_ADDR> ADMIN_HEAD=0x<ADMIN_HEAD_ADDR> \
    npx hardhat run backend/scripts/grant-grievancehub-roles.js --network sepolia

  GH=0x<GH_ADDR> VALIDATOR=0x<VALIDATOR_ADDR> \
    npx hardhat run backend/scripts/grant-grievancehub-roles.js --network sepolia

Also supports argv flags when not using Hardhat (e.g. `node`):
  node backend/scripts/grant-grievancehub-roles.js --gh 0x<GH_ADDR> --validator 0x<VALIDATOR_ADDR>

Notes:
- Caller must have the admin rights on GrievanceHub for the roles being granted:
  * ADMIN_GOVT_ROLE can grant ADMIN_HEAD_ROLE
  * ADMIN_HEAD_ROLE can grant VALIDATOR_ROLE
- You can run this twice: first from ADMIN_GOVT to grant ADMIN_HEAD; then from ADMIN_HEAD to grant VALIDATOR.
*/

const { ethers } = require('hardhat');

function getArgOrEnv(name, envName) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1) return process.argv[idx + 1];
  return process.env[envName || name.toUpperCase()];
}

async function main() {
  const ghAddr = getArgOrEnv('gh', 'GH');
  const adminHead = getArgOrEnv('adminHead', 'ADMIN_HEAD');
  const validator = getArgOrEnv('validator', 'VALIDATOR');

  if (!ghAddr) {
    throw new Error('Missing GrievanceHub address. Set GH env var or pass --gh when using node (not hardhat).');
  }

  const [signer] = await ethers.getSigners();
  console.log('Signer:', signer.address);
  console.log('GrievanceHub:', ghAddr);

  const gh = await ethers.getContractAt('GrievanceHub', ghAddr);

  // GrievanceHub uses AccessRoles library; role identifiers are keccak256 hashes of role names.
  // They are not exposed as public getters on GrievanceHub. Compute locally:
  const getRole = (name) => ethers.keccak256(ethers.toUtf8Bytes(name));
  const OWNER_ROLE = getRole('OWNER_ROLE');
  const ADMIN_GOVT_ROLE = getRole('ADMIN_GOVT_ROLE');
  const ADMIN_HEAD_ROLE = getRole('ADMIN_HEAD_ROLE');
  const VALIDATOR_ROLE = getRole('VALIDATOR_ROLE');

  console.log('Roles:');
  console.log('  OWNER_ROLE       ', OWNER_ROLE);
  console.log('  ADMIN_GOVT_ROLE  ', ADMIN_GOVT_ROLE);
  console.log('  ADMIN_HEAD_ROLE  ', ADMIN_HEAD_ROLE);
  console.log('  VALIDATOR_ROLE   ', VALIDATOR_ROLE);

  // Helper to grant and wait
  async function grant(role, addr, label) {
    if (!addr) return;
    const has = await gh.hasRole(role, addr);
    if (has) {
      console.log(`✓ ${label}: ${addr} already has role`);
      return;
    }
    console.log(`Granting ${label} to ${addr} ...`);
    const tx = await gh.grantRole(role, addr);
    const rc = await tx.wait();
    console.log(`✓ Granted ${label}. Tx:`, rc.hash);
  }

  if (adminHead) {
    // Requires caller with ADMIN_GOVT_ROLE admin
    const callerHasAdminGovt = await gh.hasRole(ADMIN_GOVT_ROLE, signer.address);
    console.log('Caller has ADMIN_GOVT_ROLE:', callerHasAdminGovt);
    if (!callerHasAdminGovt) {
      console.warn('! Caller lacks ADMIN_GOVT_ROLE. Grant will likely revert.');
    }
    await grant(ADMIN_HEAD_ROLE, adminHead, 'ADMIN_HEAD_ROLE');
  }

  if (validator) {
    // Requires caller with ADMIN_HEAD_ROLE admin
    const callerHasAdminHead = await gh.hasRole(ADMIN_HEAD_ROLE, signer.address);
    console.log('Caller has ADMIN_HEAD_ROLE:', callerHasAdminHead);
    if (!callerHasAdminHead) {
      console.warn('! Caller lacks ADMIN_HEAD_ROLE. Grant may revert. If so, run from an Admin Head signer.');
    }
    await grant(VALIDATOR_ROLE, validator, 'VALIDATOR_ROLE');
  }

  // Final verification report
  if (adminHead) {
    console.log('Verify adminHead:');
    console.log('  has ADMIN_HEAD_ROLE:', await gh.hasRole(ADMIN_HEAD_ROLE, adminHead));
  }
  if (validator) {
    console.log('Verify validator:');
    console.log('  has VALIDATOR_ROLE:', await gh.hasRole(VALIDATOR_ROLE, validator));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
