// SPDX-License-Identifier: MIT
// UrbanDAO Role Revocation Script
// Revokes ADMIN_HEAD_ROLE, VALIDATOR_ROLE, TAX_COLLECTOR_ROLE, PROJECT_MANAGER_ROLE
// Uses Owner (for ADMIN_HEAD) and AdminHead (for others). No contract changes.

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.role.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("\n🧹 UrbanDAO Role Revocation");
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

  const deployedDir = path.join(__dirname, "../deployed");
  const addressesPath = path.join(deployedDir, "addresses.json");
  const rolesPath = path.join(deployedDir, "roles.json");

  const fromEnv = process.env.URBAN_CORE_ADDRESS && process.env.URBAN_CORE_ADDRESS.trim();
  const fromDeployed = fs.existsSync(addressesPath)
    ? JSON.parse(fs.readFileSync(addressesPath, "utf8")).contracts?.UrbanCore
    : undefined;
  const coreAddress = fromEnv || fromDeployed;
  if (!coreAddress) throw new Error("URBAN_CORE_ADDRESS not found");
  console.log("UrbanCore:", coreAddress);

  const ADMIN_GOVT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_GOVT_ROLE"));
  const OWNER_ROLE = ADMIN_GOVT_ROLE;
  const ADMIN_HEAD_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_HEAD_ROLE"));
  const PROJECT_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROJECT_MANAGER_ROLE"));
  const TAX_COLLECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TAX_COLLECTOR_ROLE"));
  const VALIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VALIDATOR_ROLE"));

  const pk = (n) => process.env[n] && process.env[n].trim();
  const ownerPK = pk("OWNER_ROLE_PRIVATE_KEY") || pk("ADMIN_GOVT_ROLE_PRIVATE_KEY") || process.env.PRIVATE_KEY;
  const adminHeadPK = pk("ADMIN_HEAD_ROLE_PRIVATE_KEY");
  if (!ownerPK) throw new Error("OWNER/ADMIN_GOVT private key missing");
  if (!adminHeadPK) console.warn("(warn) ADMIN_HEAD_ROLE_PRIVATE_KEY missing - cannot revoke subordinate roles");

  const owner = new ethers.Wallet(ownerPK, ethers.provider);
  const adminHead = adminHeadPK ? new ethers.Wallet(adminHeadPK, ethers.provider) : null;

  const coreAsOwner = await ethers.getContractAt("UrbanCore", coreAddress, owner);
  const coreAsAdminHead = adminHead ? await ethers.getContractAt("UrbanCore", coreAddress, adminHead) : null;

  if (!fs.existsSync(rolesPath)) throw new Error("roles.json not found in backend/deployed/");
  const rolesJson = JSON.parse(fs.readFileSync(rolesPath, "utf8"));
  const assignments = Array.isArray(rolesJson.assignments) ? rolesJson.assignments : [];

  const TARGETS = new Set(["ADMIN_HEAD_ROLE", "VALIDATOR_ROLE", "TAX_COLLECTOR_ROLE", "PROJECT_MANAGER_ROLE"]);
  const targets = assignments.filter(a => TARGETS.has(a.role));
  console.log(`Found ${targets.length} assignments to revoke`);
  
  // Sort targets: subordinate roles first, then ADMIN_HEAD_ROLE last
  targets.sort((a, b) => {
    if (a.role === "ADMIN_HEAD_ROLE") return 1;
    if (b.role === "ADMIN_HEAD_ROLE") return -1;
    return 0;
  });

  const roleBytes = {
    ADMIN_HEAD_ROLE,
    VALIDATOR_ROLE,
    TAX_COLLECTOR_ROLE,
    PROJECT_MANAGER_ROLE,
  };

  for (const { role, account } of targets) {
    // Check if the account still has the role before attempting to revoke
    const hasRole = await coreAsOwner.hasRole(roleBytes[role], account);
    if (!hasRole) {
      console.log(`(skip) ${account} no longer has ${role}`);
      continue;
    }

    // Use Owner for all revocations since AdminHead was already revoked
    // Owner has DEFAULT_ADMIN_ROLE which can revoke any role
    console.log(`\n🗑️  Revoking ${role} from ${account} using ${owner.address}`);
    const tx = await coreAsOwner.revokeRole(roleBytes[role], account);
    const rcpt = await tx.wait();
    console.log(`✅ Revoked ${role} from ${account} in tx`, rcpt.hash);
  }

  console.log("\n✔️  Done\n");
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error("❌ Failed:", e); process.exit(1); });
}
