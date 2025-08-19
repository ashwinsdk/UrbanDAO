const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Focused script to deploy only the UrbanToken contract with token image
 * This avoids redeploying all contracts and saves gas
 */
async function main() {
  console.log("🚀 Starting UrbanToken deployment only...\n");

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
    tokenName: "UrbanDAO Token",
    tokenSymbol: "URBAN",
    tokenImageURI: "ipfs://bafybeihnesjjdqhqvlnei5kep52tqv6zv3k7nposxaqfdwzlkgh6zorxtu",
    tokenDescription: "UrbanDAO governance token for city management and community voting"
  };

  console.log("🔧 Configuration:");
  console.log("Owner/Govt:", config.ownerGovt);
  console.log("Token Name:", config.tokenName);
  console.log("Token Symbol:", config.tokenSymbol);
  console.log("Token Image URI:", config.tokenImageURI);
  console.log("Token Description:", config.tokenDescription, "\n");

  const deployedContract = {};

  try {
    // Deploy UrbanToken
    console.log("📄 Deploying UrbanToken...");
    const UrbanToken = await ethers.getContractFactory("UrbanToken");
    const urbanToken = await UrbanToken.deploy(
      deployer.address,
      config.tokenName,
      config.tokenSymbol,
      config.tokenImageURI,
      config.tokenDescription
    );
    await urbanToken.waitForDeployment();
    deployedContract.UrbanToken = await urbanToken.getAddress();
    console.log("✅ UrbanToken deployed to:", deployedContract.UrbanToken);

    // Create deployed addresses directory and file
    const deployedDir = path.join(__dirname, "../deployed");
    if (!fs.existsSync(deployedDir)) {
      fs.mkdirSync(deployedDir, { recursive: true });
    }

    // Load existing deployment data if available
    let deploymentData = {};
    const deploymentFilePath = path.join(deployedDir, "addresses.json");
    if (fs.existsSync(deploymentFilePath)) {
      try {
        const existingData = fs.readFileSync(deploymentFilePath);
        deploymentData = JSON.parse(existingData);
        console.log("📋 Loaded existing deployment data");
      } catch (error) {
        console.log("⚠️ Could not load existing deployment data, creating new file");
      }
    }

    // Update with new token address
    const updatedData = {
      ...deploymentData,
      network: network.name,
      chainId: network.chainId.toString(),
      timestamp: new Date().toISOString(),
      contracts: {
        ...deploymentData.contracts,
        UrbanToken: deployedContract.UrbanToken
      },
      metadata: {
        ...deploymentData.metadata,
        urbanToken: {
          imageURI: config.tokenImageURI,
          description: config.tokenDescription
        }
      }
    };

    fs.writeFileSync(
      deploymentFilePath,
      JSON.stringify(updatedData, null, 2)
    );

    console.log("\n🎉 UrbanToken deployment completed successfully!");
    console.log("\n📋 Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`UrbanToken: ${deployedContract.UrbanToken}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("\n✅ Token metadata:");
    console.log("• Image URI:", config.tokenImageURI);
    console.log("• Description:", config.tokenDescription);

    // Verify contract if on testnet/mainnet and API key is available
    if (network.name !== "hardhat" && process.env.ETHERSCAN_API_KEY) {
      console.log("\n🔍 Starting contract verification...");
      await verifyContract(deployedContract.UrbanToken, config);
    }

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

async function verifyContract(tokenAddress, config) {
  const { run } = require("hardhat");

  try {
    // Verify UrbanToken
    await run("verify:verify", {
      address: tokenAddress,
      constructorArguments: [
        config.ownerGovt,
        config.tokenName,
        config.tokenSymbol,
        config.tokenImageURI,
        config.tokenDescription
      ]
    });
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
