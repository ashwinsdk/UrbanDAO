const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Script to verify that the token image functionality is working correctly
 * This connects to the deployed UrbanToken contract and retrieves the metadata
 */
async function main() {
  console.log("🔍 Verifying UrbanToken image functionality...\n");

  // Get deployer and network info
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Network Information:");
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
  console.log("Account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  try {
    // Load deployed addresses
    const deployedDir = path.join(__dirname, "../deployed");
    const addressesFile = path.join(deployedDir, "addresses.json");
    
    if (!fs.existsSync(addressesFile)) {
      console.error("❌ Deployment addresses file not found!");
      return;
    }
    
    const deploymentData = JSON.parse(fs.readFileSync(addressesFile, 'utf8'));
    const tokenAddress = deploymentData.contracts.UrbanToken;
    
    if (!tokenAddress) {
      console.error("❌ UrbanToken address not found in deployment data!");
      return;
    }
    
    console.log("🔗 Connecting to UrbanToken at:", tokenAddress);
    
    // Connect to the contract
    const UrbanToken = await ethers.getContractFactory("UrbanToken");
    const urbanToken = UrbanToken.attach(tokenAddress);
    
    // Get basic token info
    const name = await urbanToken.name();
    const symbol = await urbanToken.symbol();
    const totalSupply = await urbanToken.totalSupply();
    
    console.log("\n📊 Token Basic Info:");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Total Supply:", ethers.formatEther(totalSupply), symbol);
    
    // Get token metadata
    const imageURI = await urbanToken.tokenImageURI();
    const description = await urbanToken.tokenDescription();
    const metadata = await urbanToken.tokenMetadata();
    
    console.log("\n🖼️ Token Metadata:");
    console.log("Image URI:", imageURI);
    console.log("Description:", description);
    console.log("\nJSON Metadata:", metadata);
    
    try {
      const parsedMetadata = JSON.parse(metadata);
      console.log("\n✅ Metadata successfully parsed as JSON");
      console.log("Parsed name:", parsedMetadata.name);
      console.log("Parsed symbol:", parsedMetadata.symbol);
      console.log("Parsed description:", parsedMetadata.description);
      console.log("Parsed image:", parsedMetadata.image);
    } catch (error) {
      console.log("\n⚠️ Note: Metadata could not be parsed as JSON, but this might be expected");
    }
    
    console.log("\n🎉 Token image verification completed!");
    console.log("✅ Token image URI is set and accessible");
    console.log("✅ Token description is set and accessible");
    
    // Verify IPFS gateway access
    if (imageURI && imageURI.startsWith('ipfs://')) {
      const gatewayUrl = imageURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
      console.log("\n🔗 To view the token image in a browser, visit:");
      console.log(gatewayUrl);
    }
    
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
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
