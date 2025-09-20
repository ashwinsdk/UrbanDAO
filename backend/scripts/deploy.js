// SPDX-License-Identifier: MIT
// UrbanDAO Clean Deployment Script
// Deploys: MetaForwarder, UrbanToken, Timelock, UrbanGovernor, TaxReceipt, TaxModule, ProjectRegistry, GrievanceHub, UrbanCore (UUPS)
// Wires modules, grants roles, and writes addresses to deployed/addresses.json

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function main() {
  console.log("\n🚀 Starting UrbanDAO clean deployment...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📋 Network:", network.name, "Chain ID:", network.chainId.toString());
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Load addresses from accounts.txt if present (best-effort)
  const accountsTxt = safeRead(path.join(__dirname, "../..", "docs", "accounts.txt"));
  const parsed = parseAccountsTxt(accountsTxt);

  const ownerGovtAddr = process.env.OWNER_GOVT || parsed.owner || deployer.address;
  const relayerAddr = process.env.RELAYER || parsed.txPayer || deployer.address;
  const treasuryAddr = process.env.TREASURY || parsed.owner || deployer.address;

  const config = {
    ownerGovt: ownerGovtAddr,
    relayer: relayerAddr,
    treasury: treasuryAddr,
    minDelay: 24 * 60 * 60,
    tokenName: "UrbanDAO Token",
    tokenSymbol: "URBAN",
    tokenImageURI: "ipfs://bafybeihnesjjdqhqvlnei5kep52tqv6zv3k7nposxaqfdwzlkgh6zorxtu",
    tokenDescription: "UrbanDAO governance token for city management and community voting",
  };

  console.log("🔧 Deployment Config:");
  console.log("• Owner/Govt:", config.ownerGovt);
  console.log("• Relayer:", config.relayer);
  console.log("• Treasury:", config.treasury);
  console.log("• Timelock delay:", config.minDelay / 3600, "hours\n");

  const deployed = {};

  try {
    // 1) MetaForwarder
    console.log("1️⃣ Deploying MetaForwarder...");
    const MetaForwarder = await ethers.getContractFactory("MetaForwarder");
    const metaForwarder = await MetaForwarder.deploy();
    await metaForwarder.waitForDeployment();
    deployed.MetaForwarder = await metaForwarder.getAddress();
    console.log("✅ MetaForwarder:", deployed.MetaForwarder);

    // 2) UrbanToken
    console.log("\n2️⃣ Deploying UrbanToken...");
    const UrbanToken = await ethers.getContractFactory("UrbanToken");
    const urbanToken = await UrbanToken.deploy(
      config.ownerGovt,
      config.tokenName,
      config.tokenSymbol,
      config.tokenImageURI,
      config.tokenDescription
    );
    await urbanToken.waitForDeployment();
    deployed.UrbanToken = await urbanToken.getAddress();
    console.log("✅ UrbanToken:", deployed.UrbanToken);

    // 3) TimelockController
    console.log("\n3️⃣ Deploying TimelockController...");
    const UrbanTimelockController = await ethers.getContractFactory("UrbanTimelockController");
    const timelock = await UrbanTimelockController.deploy(
      config.minDelay,
      [],
      [],
      deployer.address
    );
    await timelock.waitForDeployment();
    deployed.TimelockController = await timelock.getAddress();
    console.log("✅ Timelock:", deployed.TimelockController);

    // 4) UrbanGovernor
    console.log("\n4️⃣ Deploying UrbanGovernor...");
    const UrbanGovernor = await ethers.getContractFactory("UrbanGovernor");
    const governor = await UrbanGovernor.deploy(deployed.UrbanToken, deployed.TimelockController, "UrbanDAO Governor");
    await governor.waitForDeployment();
    deployed.UrbanGovernor = await governor.getAddress();
    console.log("✅ UrbanGovernor:", deployed.UrbanGovernor);

    // 5) TaxReceipt
    console.log("\n5️⃣ Deploying TaxReceipt...");
    const TaxReceipt = await ethers.getContractFactory("TaxReceipt");
    const taxReceipt = await TaxReceipt.deploy(config.ownerGovt);
    await taxReceipt.waitForDeployment();
    deployed.TaxReceipt = await taxReceipt.getAddress();
    console.log("✅ TaxReceipt:", deployed.TaxReceipt);

    console.log("⚙️ Configuring TaxReceipt metadata...");
    const defaultImageCID = "bafybeihnesjjdqhqvlnei5kep52tqv6zv3k7nposxaqfdwzlkgh6zorxtu";
    await (await taxReceipt.setDefaultImageCID(defaultImageCID)).wait();

    // 6) TaxModule
    console.log("\n6️⃣ Deploying TaxModule...");
    const TaxModule = await ethers.getContractFactory("TaxModule");
    const taxModule = await TaxModule.deploy(
      config.ownerGovt,
      deployed.TaxReceipt,
      deployed.UrbanToken,
      config.treasury,
      deployed.MetaForwarder
    );
    await taxModule.waitForDeployment();
    deployed.TaxModule = await taxModule.getAddress();
    console.log("✅ TaxModule:", deployed.TaxModule);

    // 7) ProjectRegistry
    console.log("\n7️⃣ Deploying ProjectRegistry...");
    const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
    const projectRegistry = await ProjectRegistry.deploy(config.ownerGovt, config.treasury);
    await projectRegistry.waitForDeployment();
    deployed.ProjectRegistry = await projectRegistry.getAddress();
    console.log("✅ ProjectRegistry:", deployed.ProjectRegistry);

    // 8) GrievanceHub
    console.log("\n8️⃣ Deploying GrievanceHub...");
    const GrievanceHub = await ethers.getContractFactory("GrievanceHub");
    const grievanceHub = await GrievanceHub.deploy(config.ownerGovt, config.ownerGovt, deployed.MetaForwarder);
    await grievanceHub.waitForDeployment();
    deployed.GrievanceHub = await grievanceHub.getAddress();
    console.log("✅ GrievanceHub:", deployed.GrievanceHub);

    // 9) UrbanCore (UUPS Proxy)
    console.log("\n9️⃣ Deploying UrbanCore (UUPS Proxy)...");
    const UrbanCore = await ethers.getContractFactory("UrbanCore");
    const urbanCore = await upgrades.deployProxy(
      UrbanCore,
      [
        config.ownerGovt,
        deployed.UrbanToken,
        deployed.TaxModule,
        deployed.GrievanceHub,
        deployed.ProjectRegistry,
        deployed.UrbanGovernor,
        deployed.TimelockController,
        deployed.TaxReceipt,
        config.treasury,
      ],
      {
        kind: "uups",
        constructorArgs: [deployed.MetaForwarder],
      }
    );
    await urbanCore.waitForDeployment();
    deployed.UrbanCore = await urbanCore.getAddress();
    console.log("✅ UrbanCore (Proxy):", deployed.UrbanCore);

    // Prepare owner signer for owner-restricted calls
    let ownerSigner = (await ethers.getSigners())[0];
    if (ownerSigner.address.toLowerCase() !== config.ownerGovt.toLowerCase()) {
      if (process.env.OWNER_GOVT_PRIVATE_KEY) {
        const tryOwner = new ethers.Wallet(process.env.OWNER_GOVT_PRIVATE_KEY, ethers.provider);
        if (tryOwner.address.toLowerCase() === config.ownerGovt.toLowerCase()) {
          ownerSigner = tryOwner;
        } else {
          console.warn("⚠️ OWNER_GOVT_PRIVATE_KEY address does not match configured ownerGovt. Using deployer for owner-only calls may fail.");
        }
      } else {
        console.warn("⚠️ Deployer is not ownerGovt and OWNER_GOVT_PRIVATE_KEY not set. Owner-only calls may fail.");
      }
    }

    // Wire modules
    console.log("\n🔧 Wiring modules with UrbanCore reference...");
    await (await grievanceHub.connect(ownerSigner).setUrbanCore(deployed.UrbanCore)).wait();
    await (await projectRegistry.connect(ownerSigner).setUrbanCore(deployed.UrbanCore)).wait();
    await (await taxModule.connect(ownerSigner).setUrbanCore(deployed.UrbanCore)).wait();
    console.log("✅ Modules wired to UrbanCore");

    // Timelock roles
    console.log("\n🔧 Configuring Timelock roles...");
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    await (await timelock.grantRole(PROPOSER_ROLE, deployed.UrbanGovernor)).wait();
    await (await timelock.grantRole(EXECUTOR_ROLE, deployed.UrbanGovernor)).wait();
    await (await timelock.grantRole(EXECUTOR_ROLE, config.ownerGovt)).wait();
    console.log("✅ Timelock roles configured");

    // Role constant: OWNER == ADMIN_GOVT on-chain
    const OWNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_GOVT_ROLE"));

    // Allow TaxModule to mint receipts
    console.log("\n🔧 Granting TaxReceipt minting to TaxModule...");
    await (await taxReceipt.connect(ownerSigner).grantRole(OWNER_ROLE, deployed.TaxModule)).wait();
    console.log("✅ TaxModule granted OWNER_ROLE on TaxReceipt");

    // Give UrbanCore mint authority on UrbanToken for onboarding
    console.log("\n🔧 Granting UrbanCore OWNER_ROLE on UrbanToken for onboarding mints...");
    await (await (await ethers.getContractAt("UrbanToken", deployed.UrbanToken)).connect(ownerSigner).grantRole(OWNER_ROLE, deployed.UrbanCore)).wait();
    console.log("✅ UrbanCore granted OWNER_ROLE on UrbanToken");

    // Transfer UrbanToken ownership to Timelock for governance
    console.log("\n🔧 Transferring UrbanToken ownership to Timelock...");
    await (await (await ethers.getContractAt("UrbanToken", deployed.UrbanToken)).connect(ownerSigner).transferOwnership(deployed.TimelockController)).wait();
    console.log("✅ UrbanToken ownership transferred to Timelock");

    // Persist addresses
    const outDir = path.join(__dirname, "../deployed");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const deploymentData = {
      network: network.name,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployed,
      config: {
        ownerGovt: config.ownerGovt,
        relayer: config.relayer,
        treasury: config.treasury,
        minDelay: config.minDelay,
      },
      metadata: {
        taxReceipt: {
          defaultImageCID,
          baseTokenURI: "ipfs://",
        },
      },
    };

    fs.writeFileSync(path.join(outDir, "addresses.json"), JSON.stringify(deploymentData, null, 2));
    console.log("\n📄 Wrote deployed/addresses.json");

    console.log("\n🎉 Deployment completed successfully!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    for (const [k, v] of Object.entries(deployed)) {
      console.log(`${k.padEnd(20)}: ${v}`);
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (err) {
    console.error("\n❌ Deployment failed:", err);
    process.exit(1);
  }
}

function safeRead(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function parseAccountsTxt(txt) {
  if (!txt) return {};
  const out = {};
  const addrRe = /(0x[a-fA-F0-9]{40})/;
  const lines = txt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i].trim();
    if (/Owner,\s*AdminGovt/i.test(L)) {
      const m = addrRe.exec(lines[i + 1] || "");
      if (m) out.owner = m[1];
    }
    if (/TX_Payer/i.test(L)) {
      const m = addrRe.exec(lines[i + 1] || "");
      if (m) out.txPayer = m[1];
    }
  }
  return out;
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { main };
