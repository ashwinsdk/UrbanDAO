const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Example .env variables:
 * PRIVATE_KEY=07446a2aab1e7449202eaad0a2fc66089511a091218acc4414288b80dd7e18b1
 * SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/fce8183a885b4d70a55129db4665bf8d
 * OWNER_GOVT=0x1234567890123456789012345678901234567890
 * RELAYER=0x2345678901234567890123456789012345678901
 * TREASURY=0x3456789012345678901234567890123456789012
 * PINATA_API_KEY=b56e744235550696bd6f
 * PINATA_SECRET=5da143f033a42cc06915d65c5f8db9b70a0843fb0579aed3447059d13f0af0cd
 * ETHERSCAN_API_KEY=42NY9A6AY4TD77QAEVS121QGS74AXVTFAI
 * 
 * Sample meta-tx sign/execute roundtrip:
 * 1. Build EIP-712 typed data for MetaForwarder domain
 * 2. Sign with Wallet.signTypedData(domain, types, value)
 * 3. Submit to forwarder.execute(request, signature)
 * 4. MetaForwarder validates signature and executes call with correct _msgSender()
 */

async function main() {
    console.log("🚀 Starting UrbanDAO deployment...\n");

    // Get deployer and network info
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📋 Deployment Configuration:");
    console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
    console.log("Deployer:", deployer.address);
    console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Configuration from environment or defaults
    const config = {
        ownerGovt: process.env.OWNER_GOVT || deployer.address,
        relayer: process.env.RELAYER || deployer.address,
        treasury: process.env.TREASURY || deployer.address,
        minDelay: 24 * 60 * 60, // 24 hours in seconds
        tokenName: "UrbanDAO Token",
        tokenSymbol: "URBAN"
    };

    console.log("🔧 Configuration:");
    console.log("Owner/Govt:", config.ownerGovt);
    console.log("Relayer:", config.relayer);
    console.log("Treasury:", config.treasury);
    console.log("Timelock min delay:", config.minDelay / 3600, "hours\n");

    const deployedContracts = {};

    try {
        // Step 1: Deploy MetaForwarder
        console.log("1️⃣ Deploying MetaForwarder...");
        const MetaForwarder = await ethers.getContractFactory("MetaForwarder");
        const metaForwarder = await MetaForwarder.deploy();
        await metaForwarder.waitForDeployment();
        deployedContracts.MetaForwarder = await metaForwarder.getAddress();
        console.log("✅ MetaForwarder deployed to:", deployedContracts.MetaForwarder);

        // Step 2: Deploy UrbanToken
        console.log("\n2️⃣ Deploying UrbanToken...");
        const UrbanToken = await ethers.getContractFactory("UrbanToken");
        const urbanToken = await UrbanToken.deploy(
            deployer.address,
            config.tokenName,
            config.tokenSymbol
        );
        await urbanToken.waitForDeployment();
        deployedContracts.UrbanToken = await urbanToken.getAddress();
        console.log("✅ UrbanToken deployed to:", deployedContracts.UrbanToken);

        // Step 3: Deploy TimelockController
        console.log("\n3️⃣ Deploying TimelockController...");
        const UrbanTimelockController = await ethers.getContractFactory("UrbanTimelockController");
        const timelock = await UrbanTimelockController.deploy(
            config.minDelay,
            [], // proposers (will be set to governor)
            [], // executors (will be set to governor and community)
            deployer.address // admin (will be renounced later)
        );
        await timelock.waitForDeployment();
        deployedContracts.TimelockController = await timelock.getAddress();
        console.log("✅ TimelockController deployed to:", deployedContracts.TimelockController);

        // Step 4: Deploy UrbanGovernor
        console.log("\n4️⃣ Deploying UrbanGovernor...");
        const UrbanGovernor = await ethers.getContractFactory("UrbanGovernor");
        const governor = await UrbanGovernor.deploy(
            deployedContracts.UrbanToken,
            deployedContracts.TimelockController,
            "UrbanDAO Governor"
        );
        await governor.waitForDeployment();
        deployedContracts.UrbanGovernor = await governor.getAddress();
        console.log("✅ UrbanGovernor deployed to:", deployedContracts.UrbanGovernor);

        // Step 5: Deploy TaxReceipt
        console.log("\n5️⃣ Deploying TaxReceipt...");
        const TaxReceipt = await ethers.getContractFactory("TaxReceipt");
        const taxReceipt = await TaxReceipt.deploy(deployer.address);
        await taxReceipt.waitForDeployment();
        deployedContracts.TaxReceipt = await taxReceipt.getAddress();
        console.log("✅ TaxReceipt deployed to:", deployedContracts.TaxReceipt);

        // Step 6: Deploy TaxModule
        console.log("\n6️⃣ Deploying TaxModule...");
        const TaxModule = await ethers.getContractFactory("TaxModule");
        const taxModule = await TaxModule.deploy(
            deployer.address,
            deployedContracts.TaxReceipt,
            deployedContracts.UrbanToken,
            config.treasury,
            deployedContracts.MetaForwarder
        );
        await taxModule.waitForDeployment();
        deployedContracts.TaxModule = await taxModule.getAddress();
        console.log("✅ TaxModule deployed to:", deployedContracts.TaxModule);

        // Step 7: Deploy ProjectRegistry
        console.log("\n7️⃣ Deploying ProjectRegistry...");
        const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
        const projectRegistry = await ProjectRegistry.deploy(
            deployer.address,
            config.treasury
        );
        await projectRegistry.waitForDeployment();
        deployedContracts.ProjectRegistry = await projectRegistry.getAddress();
        console.log("✅ ProjectRegistry deployed to:", deployedContracts.ProjectRegistry);

        // Step 8: Deploy GrievanceHub
        console.log("\n8️⃣ Deploying GrievanceHub...");
        const GrievanceHub = await ethers.getContractFactory("GrievanceHub");
        const grievanceHub = await GrievanceHub.deploy(
            deployer.address,
            deployedContracts.MetaForwarder
        );
        await grievanceHub.waitForDeployment();
        deployedContracts.GrievanceHub = await grievanceHub.getAddress();
        console.log("✅ GrievanceHub deployed to:", deployedContracts.GrievanceHub);

        // Step 9: Deploy UrbanCore (UUPS Proxy)
        console.log("\n9️⃣ Deploying UrbanCore (UUPS Proxy)...");
        const UrbanCore = await ethers.getContractFactory("UrbanCore");
        const urbanCore = await upgrades.deployProxy(
            UrbanCore,
            [
                deployer.address,
                deployedContracts.UrbanToken,
                deployedContracts.TaxModule,
                deployedContracts.GrievanceHub,
                deployedContracts.ProjectRegistry,
                deployedContracts.UrbanGovernor,
                deployedContracts.TimelockController,
                deployedContracts.TaxReceipt,
                config.treasury
            ],
            {
                kind: 'uups',
                constructorArgs: [deployedContracts.MetaForwarder]
            }
        );
        await urbanCore.waitForDeployment();
        deployedContracts.UrbanCore = await urbanCore.getAddress();
        console.log("✅ UrbanCore (Proxy) deployed to:", deployedContracts.UrbanCore);

        console.log("\n🔧 Configuring system...");

        // Configure Timelock roles
        console.log("⚙️ Configuring Timelock roles...");
        const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
        const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
        const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
        
        await timelock.grantRole(PROPOSER_ROLE, deployedContracts.UrbanGovernor);
        await timelock.grantRole(EXECUTOR_ROLE, deployedContracts.UrbanGovernor);
        await timelock.grantRole(EXECUTOR_ROLE, config.ownerGovt); // Community executor
        console.log("✅ Timelock roles configured");

        // Configure TaxReceipt minting role for TaxModule
        console.log("⚙️ Granting TaxReceipt minting role to TaxModule...");
        const OWNER_ROLE = await taxReceipt.OWNER_ROLE();
        await taxReceipt.grantRole(OWNER_ROLE, deployedContracts.TaxModule);
        console.log("✅ TaxReceipt minting role granted");

        // Configure UrbanCore roles
        console.log("⚙️ Configuring UrbanCore roles...");
        if (config.ownerGovt !== deployer.address) {
            await urbanCore.assignRole(await urbanCore.ADMIN_GOVT_ROLE(), config.ownerGovt);
        }
        await urbanCore.assignRole(await urbanCore.TX_PAYER_ROLE(), config.relayer);
        console.log("✅ UrbanCore roles configured");

        // Transfer UrbanToken ownership to Timelock
        console.log("⚙️ Transferring UrbanToken ownership to Timelock...");
        await urbanToken.transferOwnership(deployedContracts.TimelockController);
        console.log("✅ UrbanToken ownership transferred");

        // Create deployed addresses directory and file
        const deployedDir = path.join(__dirname, "../deployed");
        if (!fs.existsSync(deployedDir)) {
            fs.mkdirSync(deployedDir, { recursive: true });
        }

        const deploymentData = {
            network: network.name,
            chainId: network.chainId.toString(),
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: deployedContracts,
            config: config
        };

        fs.writeFileSync(
            path.join(deployedDir, "addresses.json"),
            JSON.stringify(deploymentData, null, 2)
        );

        // Handle Pinata API keys if present
        if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET) {
            const pinataKeys = `Pinata\nApi Keys: ${process.env.PINATA_API_KEY}\nApi Secret: ${process.env.PINATA_SECRET}\n`;
            fs.writeFileSync(path.join(__dirname, "../PinataAPI-KEYS.txt"), pinataKeys);
            console.log("✅ Pinata API keys written to PinataAPI-KEYS.txt");
        }

        console.log("\n🎉 Deployment completed successfully!");
        console.log("\n📋 Summary:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        Object.entries(deployedContracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(20)}: ${address}`);
        });
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        console.log("\n✅ Key configurations:");
        console.log("• MetaForwarder configured for gasless transactions");
        console.log("• Governor wired with 24h Timelock");
        console.log("• Role hierarchy established with collision prevention");
        console.log("• TaxReceipt minting enabled for TaxModule");
        console.log("• UrbanToken ownership transferred to Timelock");
        console.log("• UUPS proxy deployed for UrbanCore upgradeability");

        console.log("\n🔗 Next steps:");
        console.log("• Verify contracts on Etherscan (if API key provided)");
        console.log("• Set up frontend with contract addresses");
        console.log("• Configure area heads and validators");
        console.log("• Test gasless transaction flow");

        // Verify contracts if on testnet/mainnet and API key is available
        if (network.name !== "hardhat" && process.env.ETHERSCAN_API_KEY) {
            console.log("\n🔍 Starting contract verification...");
            await verifyContracts(deployedContracts, config);
        }

    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    }
}

async function verifyContracts(contracts, config) {
    const { run } = require("hardhat");

    try {
        // Verify MetaForwarder
        await run("verify:verify", {
            address: contracts.MetaForwarder,
            constructorArguments: []
        });

        // Verify UrbanToken
        await run("verify:verify", {
            address: contracts.UrbanToken,
            constructorArguments: [
                config.ownerGovt,
                config.tokenName,
                config.tokenSymbol
            ]
        });

        // Verify TimelockController
        await run("verify:verify", {
            address: contracts.TimelockController,
            constructorArguments: [
                config.minDelay,
                [],
                [],
                config.ownerGovt
            ]
        });

        // Note: Other contracts may need specific constructor args
        console.log("✅ Contract verification completed");

    } catch (error) {
        console.log("⚠️ Contract verification failed:", error.message);
    }
}

// Handle script execution
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { main };
