// SPDX-License-Identifier: MIT
// UrbanDAO Role Assignment Script
// Uses .role.env and deployed/addresses.json to assign roles via UrbanCore

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load envs
dotenv.config({ path: path.join(__dirname, "../.role.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("\n🔑 UrbanDAO Role Assignment");
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

  // Resolve UrbanCore address
  const deployedJsonPath = path.join(__dirname, "../deployed/addresses.json");
  const fromEnv = process.env.URBAN_CORE_ADDRESS && process.env.URBAN_CORE_ADDRESS.trim();
  const fromDeployed = fs.existsSync(deployedJsonPath)
    ? JSON.parse(fs.readFileSync(deployedJsonPath, "utf8")).contracts?.UrbanCore
    : undefined;
  const coreAddress = fromEnv || fromDeployed;
  if (!coreAddress) {
    throw new Error("URBAN_CORE_ADDRESS not found in .role.env or deployed/addresses.json");
  }
  console.log("UrbanCore:", coreAddress);

  // Role constants (mirror AccessRoles.sol)
  const ADMIN_GOVT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_GOVT_ROLE"));
  const OWNER_ROLE = ADMIN_GOVT_ROLE; // alias
  const ADMIN_HEAD_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_HEAD_ROLE"));
  const PROJECT_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROJECT_MANAGER_ROLE"));
  const TAX_COLLECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TAX_COLLECTOR_ROLE"));
  const VALIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VALIDATOR_ROLE"));
  const TX_PAYER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TX_PAYER_ROLE"));

  // Build wallets from .role.env
  const pk = (name) => process.env[name] && process.env[name].trim();
  const ownerPK = pk("OWNER_ROLE_PRIVATE_KEY") || pk("ADMIN_GOVT_ROLE_PRIVATE_KEY") || process.env.PRIVATE_KEY;
  const adminHeadPK = pk("ADMIN_HEAD_ROLE_PRIVATE_KEY");
  const projectMgrPK = pk("PROJECT_MANAGER_ROLE_PRIVATE_KEY");
  const taxCollectorPK = pk("TAX_COLLECTOR_ROLE_PRIVATE_KEY");
  const validatorPK = pk("VALIDATOR_ROLE_PRIVATE_KEY");
  const txPayerPK = pk("TX_PAYER_ROLE_PRIVATE_KEY");

  const provider = ethers.provider;
  const mkWallet = (priv) => priv ? new ethers.Wallet(priv, provider) : null;

  const owner = mkWallet(ownerPK);
  const adminHead = mkWallet(adminHeadPK);
  const projectMgr = mkWallet(projectMgrPK);
  const taxCollector = mkWallet(taxCollectorPK);
  const validator = mkWallet(validatorPK);
  const txPayer = mkWallet(txPayerPK);

  if (!owner) throw new Error("OWNER_ROLE_PRIVATE_KEY or PRIVATE_KEY missing in .role.env/.env");

  console.log("\nSigners:");
  console.log("• Owner/AdminGovt:", owner.address);
  if (adminHead) console.log("• AdminHead:", adminHead.address);
  if (projectMgr) console.log("• ProjectManager:", projectMgr.address);
  if (taxCollector) console.log("• TaxCollector:", taxCollector.address);
  if (validator) console.log("• Validator:", validator.address);
  if (txPayer) console.log("• TxPayer:", txPayer.address);

  // Contracts
  const coreAsOwner = await ethers.getContractAt("UrbanCore", coreAddress, owner);

  const assignments = [];

  // Helper to safely assign and record
  async function assign(signer, role, account, roleName) {
    if (!signer || !account) return;
    const core = await ethers.getContractAt("UrbanCore", coreAddress, signer);
    console.log(`\n➡️  ${roleName}: assigning to`, account, "via", (await signer.getAddress()));
    const tx = await core.assignRole(role, account);
    const rcpt = await tx.wait();
    console.log(`✅ ${roleName} assigned in tx`, rcpt.hash);
    assignments.push({ role: roleName, account, txHash: rcpt.hash });
  }

  // 1) Assign ADMIN_HEAD_ROLE (admin: OWNER/ADMIN_GOVT)
  if (adminHead) {
    await assign(owner, ADMIN_HEAD_ROLE, adminHead.address, "ADMIN_HEAD_ROLE");
  } else {
    console.log("(skip) ADMIN_HEAD_ROLE: no ADMIN_HEAD_ROLE_PRIVATE_KEY in .role.env");
  }

  // 2) Assign subordinate roles using AdminHead signer
  if (adminHead) {
    if (validator) await assign(adminHead, VALIDATOR_ROLE, validator.address, "VALIDATOR_ROLE");
    else console.log("(skip) VALIDATOR_ROLE: no VALIDATOR_ROLE_PRIVATE_KEY");

    if (taxCollector) await assign(adminHead, TAX_COLLECTOR_ROLE, taxCollector.address, "TAX_COLLECTOR_ROLE");
    else console.log("(skip) TAX_COLLECTOR_ROLE: no TAX_COLLECTOR_ROLE_PRIVATE_KEY");

    if (projectMgr) await assign(adminHead, PROJECT_MANAGER_ROLE, projectMgr.address, "PROJECT_MANAGER_ROLE");
    else console.log("(skip) PROJECT_MANAGER_ROLE: no PROJECT_MANAGER_ROLE_PRIVATE_KEY");
  } else {
    console.log("(skip) Subordinate roles: no ADMIN_HEAD signer available");
  }

  // 3) Assign TX_PAYER_ROLE using Owner/AdminGovt
  if (txPayer) {
    await assign(owner, TX_PAYER_ROLE, txPayer.address, "TX_PAYER_ROLE");
  } else {
    console.log("(skip) TX_PAYER_ROLE: no TX_PAYER_ROLE_PRIVATE_KEY");
  }

  // Persist role assignments
  const outDir = path.join(__dirname, "../deployed");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const rolesJsonPath = path.join(outDir, "roles.json");
  const payload = {
    network: network.name,
    chainId: network.chainId.toString(),
    core: coreAddress,
    timestamp: new Date().toISOString(),
    assignments,
  };
  fs.writeFileSync(rolesJsonPath, JSON.stringify(payload, null, 2));
  console.log("\n📄 Wrote", rolesJsonPath);

  console.log("\n🎉 Role assignment complete\n");
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error("❌ Failed:", e); process.exit(1); });
}

module.exports = { main };
