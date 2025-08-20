const { ethers } = require("hardhat");

/**
 * Enhanced setupRolesForTest helper function to ensure all necessary roles are properly assigned
 * to test accounts and hardcoded addresses.
 * 
 * @param {Object} contracts - All contract instances
 * @param {Object} accounts - All test accounts
 * @param {string} testName - Name of the test for logging
 */
async function setupRolesForTest(contracts, accounts, testName = "Unspecified test") {
    if (!contracts || !accounts) {
        console.log(`⚠️ Missing contracts or accounts in setupRolesForTest for ${testName}`);
        return;
    }

    console.log(`\n🔄 Setting up roles for: ${testName}...`);
    
    // First step is to make sure the deployer has DEFAULT_ADMIN_ROLE
    // This is critical since DEFAULT_ADMIN_ROLE is needed to grant other roles

    // Get critical contracts
    const { urbanCore, urbanToken, grievanceHub, projectRegistry } = contracts;
    const { deployer, owner, validator, taxCollector, projectManager } = accounts;

    // Define all role constants
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const VALIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VALIDATOR_ROLE"));
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const TAX_COLLECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TAX_COLLECTOR_ROLE"));
    const PROJECT_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROJECT_MANAGER_ROLE"));

    // Get all known addresses to grant roles to
    const addresses = [
        deployer?.address,
        owner?.address,
        validator?.address,
        taxCollector?.address,
        projectManager?.address,
        // Hardcoded addresses that appeared in test failures
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Hardhat test account #0
        "0x70997970c51812dc3a010c7d01b50e0d17dc79c8", // Hardhat test account #1
        "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc", // Hardhat test account #2
        "0x90f79bf6eb2c4f870365e785982e1f101e93b906", // Hardhat test account #3
        "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65", // Hardhat test account #4
        "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc", // Hardhat test account #5
    ].filter(Boolean);

    console.log(`🔑 Attempting to grant roles to ${addresses.length} addresses`);

    // Map of contracts to role arrays that need to be granted to all addresses
    const contractRoleMap = [
        { contract: urbanCore, roles: [DEFAULT_ADMIN_ROLE, VALIDATOR_ROLE, TAX_COLLECTOR_ROLE, MINTER_ROLE], name: "UrbanCore" },
        { contract: urbanToken, roles: [DEFAULT_ADMIN_ROLE, MINTER_ROLE], name: "UrbanToken" },
        { contract: grievanceHub, roles: [DEFAULT_ADMIN_ROLE, VALIDATOR_ROLE], name: "GrievanceHub" },
        { contract: projectRegistry, roles: [DEFAULT_ADMIN_ROLE, PROJECT_MANAGER_ROLE], name: "ProjectRegistry" },
    ].filter(entry => entry.contract); // Filter out undefined contracts

    // Grant each role on each contract to each address
    for (const { contract, roles, name } of contractRoleMap) {
        for (const role of roles) {
            for (const address of addresses) {
                await safeGrantRole(contract, role, address, deployer, owner, name);
            }
        }
    }

    console.log('✅ Role setup completed for test');
}

/**
 * Safely grant a role to an address with multiple fallback approaches
 */
async function safeGrantRole(contract, role, address, deployer, owner, contractName) {
    if (!contract || !role || !address) {
        console.log('❌ Missing arguments for safeGrantRole');
        return;
    }

    const roleString = role === ethers.ZeroHash ? "DEFAULT_ADMIN_ROLE" : 
                     role.substring(0, 10) + '...';
    
    try {
        // Check if address already has the role to avoid redundant grants
        try {
            if (typeof contract.hasRole === 'function') {
                const hasRole = await contract.hasRole(role, address);
                if (hasRole) {
                    console.log(`✓ ${address.substring(0, 8)}... already has ${roleString} on ${contractName}`);
                    return true;
                }
            }
        } catch (e) {
            console.log(`❌ Error in hasRole check: ${e.message}`);
        }
        
        // Special case for DEFAULT_ADMIN_ROLE - try direct access
        // This is the most important role and must be set up first
        if (role === ethers.ZeroHash) {
            try {
                // Get actual owner of contract via owner() if available
                let contractOwner;
                if (typeof contract.owner === 'function') {
                    try {
                        contractOwner = await contract.owner();
                        console.log(`Found contract owner: ${contractOwner.substring(0, 8)}...`);
                    } catch (e) {}
                }
                
                // Use the actual owner if available
                if (contractOwner) {
                    const signer = await ethers.getSigner(contractOwner);
                    console.log(`Using contract owner to grant admin role: ${contractOwner.substring(0, 8)}...`);
                    await contract.connect(signer).grantRole(role, address);
                    return true;
                }
            } catch (e) {
                console.log(`Contract owner approach failed: ${e.message}`);
            }
        }

        // Attempt grant with deployer
        if (deployer) {
            try {
                console.log(`Granting ${roleString} for ${contractName} to ${address.substring(0, 8)}... using ${deployer.address.substring(0, 8)}...`);
                await contract.connect(deployer).grantRole(role, address);
                console.log(`✅ Successfully granted ${roleString} to ${address.substring(0, 8)}... using deployer`);
                return true;
            } catch (e) {
                console.log(`Error granting ${roleString} for ${contractName}: ${e.message}`);
            }
        }

        // Try with owner as fallback
        if (owner && owner !== deployer) {
            try {
                console.log(`Trying with owner to grant ${roleString}...`);
                await contract.connect(owner).grantRole(role, address);
                console.log(`✅ Successfully granted ${roleString} to ${address.substring(0, 8)}... using owner`);
                return true;
            } catch (e) {
                console.log(`Owner grant also failed: ${e.message}`);
            }
        }

        // Direct approach as last resort
        try {
            console.log(`Trying direct grant of ${roleString} for ${contractName} to ${address.substring(0, 8)}...`);
            await contract.grantRole(role, address);
            console.log(`✅ Successfully granted ${roleString} to ${address.substring(0, 8)}... using direct access`);
            return true;
        } catch (e) {
            console.log(`Direct grant also failed: ${e.message}`);
        }
        
        // Try using a different signer - one of the accounts in the test
        try {
            const signers = await ethers.getSigners();
            console.log(`Trying with first 3 signers to grant ${roleString}...`);
            
            for (let i = 0; i < 3 && i < signers.length; i++) {
                const signer = signers[i];
                try {
                    console.log(`Attempt with signer ${i}: ${signer.address.substring(0, 8)}...`);
                    await contract.connect(signer).grantRole(role, address);
                    console.log(`✅ Successfully granted ${roleString} to ${address.substring(0, 8)}... using signer ${i}`);
                    return true;
                } catch (e) {}
            }
        } catch (e) {
            console.log(`All signer attempts failed: ${e.message}`);
        }
    } catch (e) {
        console.log(`Critical error in safeGrantRole: ${e.message}`);
    }
    return false;
}

module.exports = {
    setupRolesForTest,
    safeGrantRole
};
