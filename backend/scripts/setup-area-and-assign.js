// SPDX-License-Identifier: MIT
// Setup an area and assign AdminHead, Validator, TaxCollector, ProjectManager
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.role.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("\n🏗️ Setup Area & Assign (", network.name, ")");

  const deployedDir = path.join(__dirname, "../deployed");
  const addressesPath = path.join(deployedDir, "addresses.json");
  const fromEnv = process.env.URBAN_CORE_ADDRESS && process.env.URBAN_CORE_ADDRESS.trim();
  const fromDeployed = fs.existsSync(addressesPath)
    ? JSON.parse(fs.readFileSync(addressesPath, "utf8")).contracts?.UrbanCore
    : undefined;
  const coreAddress = fromEnv || fromDeployed;
  if (!coreAddress) throw new Error("URBAN_CORE_ADDRESS not found");
  console.log("UrbanCore:", coreAddress);

  // Function to resolve contract addresses
  function getContractAddress(name) {
    const envVar = `${name.replace(/([A-Z])/g, '_$1').toUpperCase()}_ADDRESS`;
    const fromEnv = process.env[envVar] && process.env[envVar].trim();
    const fromDeployed = fs.existsSync(addressesPath)
      ? JSON.parse(fs.readFileSync(addressesPath, "utf8")).contracts?.[name]
      : undefined;
    const address = fromEnv || fromDeployed;
    if (!address) throw new Error(`${envVar} for ${name} not found`);
    console.log(`${name}:`, address);
    return address;
  }

  const hubAddress = getContractAddress("GrievanceHub");
  const registryAddress = getContractAddress("ProjectRegistry");
  const taxAddress = getContractAddress("TaxModule");

  const AREA_ID = (process.env.AREA_ID || '').trim();
  if (!AREA_ID) throw new Error("AREA_ID env required");
  const numericAreaId = BigInt(AREA_ID);
  const ADMIN_HEAD_ADDRESS = (process.env.ADMIN_HEAD_ADDRESS || '').trim();
  const VALIDATOR_ADDRESS = (process.env.VALIDATOR_ADDRESS || '').trim();
  const TAX_COLLECTOR_ADDRESS = (process.env.TAX_COLLECTOR_ADDRESS || '').trim();
  const PROJECT_MANAGER_ADDRESS = (process.env.PROJECT_MANAGER_ADDRESS || '').trim();
  if (!ADMIN_HEAD_ADDRESS) throw new Error("ADMIN_HEAD_ADDRESS env required");

  const ADMIN_GOVT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_GOVT_ROLE"));
  const ADMIN_HEAD_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_HEAD_ROLE"));
  const VALIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VALIDATOR_ROLE"));
  const TAX_COLLECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TAX_COLLECTOR_ROLE"));
  const PROJECT_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROJECT_MANAGER_ROLE"));

  const pk = (n) => process.env[n] && process.env[n].trim();
  const ownerPK = pk("OWNER_ROLE_PRIVATE_KEY") || pk("ADMIN_GOVT_ROLE_PRIVATE_KEY") || process.env.PRIVATE_KEY;
  const adminHeadPK = pk("ADMIN_HEAD_ROLE_PRIVATE_KEY");
  if (!ownerPK) throw new Error("Missing OWNER/ADMIN_GOVT PK");

  const owner = new ethers.Wallet(ownerPK, ethers.provider);
  const adminHead = adminHeadPK ? new ethers.Wallet(adminHeadPK, ethers.provider) : null;
  console.log("Owner:", owner.address);
  if (adminHead) console.log("AdminHead signer:", adminHead.address);

  const coreAsOwner = await ethers.getContractAt("UrbanCore", coreAddress, owner);
  const coreAsAdminHead = adminHead ? await ethers.getContractAt("UrbanCore", coreAddress, adminHead) : coreAsOwner;
  const hubAsOwner = await ethers.getContractAt("GrievanceHub", hubAddress, owner);
  const hubAsAdminHead = adminHead ? await ethers.getContractAt("GrievanceHub", hubAddress, adminHead) : null;
  const registryAsOwner = await ethers.getContractAt("ProjectRegistry", registryAddress, owner);
  const registryAsAdminHead = adminHead ? await ethers.getContractAt("ProjectRegistry", registryAddress, adminHead) : null;
  const taxAsOwner = await ethers.getContractAt("TaxModule", taxAddress, owner);
  const taxAsAdminHead = adminHead ? await ethers.getContractAt("TaxModule", taxAddress, adminHead) : null;

  // Ensure all modules are wired to UrbanCore
  async function wireModule(contract, name) {
    try {
      const currentCore = await contract.urbanCore();
      if (currentCore.toLowerCase() !== coreAddress.toLowerCase()) {
        console.log(`\n➡️ Wiring ${name} to UrbanCore...`);
        const tx = await contract.setUrbanCore(coreAddress);
        await tx.wait();
        console.log(`✓ ${name}.urbanCore set`);
      }
    } catch (e) {
      console.warn(`[${name}] Could not verify/set urbanCore:`, e.message);
    }
  }

  await wireModule(hubAsOwner, "GrievanceHub");
  await wireModule(registryAsOwner, "ProjectRegistry");
  await wireModule(taxAsOwner, "TaxModule");

  // 1) Assign area head
  console.log(`\n➡️ assignAreaHead(${AREA_ID}, ${ADMIN_HEAD_ADDRESS})`);
  let tx = await coreAsOwner.assignAreaHead(numericAreaId, ADMIN_HEAD_ADDRESS);
  await tx.wait();
  console.log("✓ area head assigned");

  // 2) Ensure base roles and area-scoped assignment
  async function ensureRole(role, account) {
    try {
      const hasRole = await coreAsOwner.hasRole(role, account);
      if (!hasRole) {
        console.log(`   Granting base role to ${account}`);
        const t = await coreAsOwner.assignRole(role, account);
        await t.wait();
      }
    } catch (e) {
      console.warn(`   Failed to ensure role for ${account}:`, e.message);
    }
  }

  // Ensure role on a specific contract, using the correct signer
  async function ensureRoleOnContract(contractAsAdmin, contractName, role, account) {
    if (!contractAsAdmin) {
        console.warn(`   [${contractName}] Admin signer not available to grant role. Skipping.`);
        return;
    }
    try {
      const has = await contractAsAdmin.hasRole(role, account);
      if (has) return;
      console.log(`   [${contractName}] Granting role ${role.slice(0,10)}... to ${account.slice(0,10)}...`);
      const tx = await contractAsAdmin.grantRole(role, account);
      await tx.wait();
    } catch (e) {
      console.warn(`   [${contractName}] Failed to grant role to ${account}:`, e.message);
    }
  }

  if (VALIDATOR_ADDRESS) {
    console.log(`➡️ assignValidatorToArea(${AREA_ID}, ${VALIDATOR_ADDRESS})`);
    await ensureRole(VALIDATOR_ROLE, VALIDATOR_ADDRESS);
    tx = await coreAsAdminHead.assignValidatorToArea(numericAreaId, VALIDATOR_ADDRESS);
    await tx.wait();
    console.log("✓ validator assigned");

    // Grant roles on GrievanceHub (Owner grants AdminHead, AdminHead grants Validator)
    await ensureRoleOnContract(hubAsOwner, "GrievanceHub", ADMIN_GOVT_ROLE, owner.address);
    await ensureRoleOnContract(hubAsOwner, "GrievanceHub", ADMIN_HEAD_ROLE, ADMIN_HEAD_ADDRESS);
    await ensureRoleOnContract(hubAsAdminHead, "GrievanceHub", VALIDATOR_ROLE, VALIDATOR_ADDRESS);
  }

  if (TAX_COLLECTOR_ADDRESS) {
    console.log(`➡️ assignTaxCollectorToArea(${AREA_ID}, ${TAX_COLLECTOR_ADDRESS})`);
    await ensureRole(TAX_COLLECTOR_ROLE, TAX_COLLECTOR_ADDRESS);
    tx = await coreAsAdminHead.assignTaxCollectorToArea(numericAreaId, TAX_COLLECTOR_ADDRESS);
    await tx.wait();
    console.log("✓ tax collector assigned");

    // Grant roles on TaxModule (Owner grants AdminHead, AdminHead grants TaxCollector)
    await ensureRoleOnContract(taxAsOwner, "TaxModule", ADMIN_GOVT_ROLE, owner.address);
    await ensureRoleOnContract(taxAsOwner, "TaxModule", ADMIN_HEAD_ROLE, ADMIN_HEAD_ADDRESS);
    await ensureRoleOnContract(taxAsAdminHead, "TaxModule", TAX_COLLECTOR_ROLE, TAX_COLLECTOR_ADDRESS);
  }

  if (PROJECT_MANAGER_ADDRESS) {
    console.log(`➡️ assignProjectManagerToArea(${AREA_ID}, ${PROJECT_MANAGER_ADDRESS})`);
    await ensureRole(PROJECT_MANAGER_ROLE, PROJECT_MANAGER_ADDRESS);
    tx = await coreAsAdminHead.assignProjectManagerToArea(numericAreaId, PROJECT_MANAGER_ADDRESS);
    await tx.wait();
    console.log("✓ project manager assigned");

    // Grant roles on ProjectRegistry (Owner grants AdminHead, AdminHead grants ProjectManager)
    await ensureRoleOnContract(registryAsOwner, "ProjectRegistry", ADMIN_GOVT_ROLE, owner.address);
    await ensureRoleOnContract(registryAsOwner, "ProjectRegistry", ADMIN_HEAD_ROLE, ADMIN_HEAD_ADDRESS);
    await ensureRoleOnContract(registryAsAdminHead, "ProjectRegistry", PROJECT_MANAGER_ROLE, PROJECT_MANAGER_ADDRESS);
  }

  console.log("\n✔️ Done\n");
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error("❌ Failed:", e); process.exit(1); });
}
