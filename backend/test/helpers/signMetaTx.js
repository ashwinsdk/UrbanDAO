const { ethers } = require("hardhat");

/**
 * Helper functions for ERC-2771 meta-transaction signing and execution
 * Demonstrates sample meta-tx sign/execute roundtrip using EIP-712
 */

/**
 * Build EIP-712 typed data for MetaForwarder domain
 * @param {string} forwarderAddress - The MetaForwarder contract address
 * @param {number} chainId - The chain ID
 * @returns {Object} - EIP-712 domain object
 */
function buildDomain(forwarderAddress, chainId) {
    return {
        name: "MetaForwarder",
        version: "1.0.0",
        chainId: chainId,
        verifyingContract: forwarderAddress
    };
}

/**
 * Build EIP-712 types for ForwardRequest
 * @returns {Object} - EIP-712 types object
 */
function buildTypes() {
    return {
        ForwardRequest: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "gas", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "data", type: "bytes" }
        ]
    };
}

/**
 * Create a ForwardRequest structure
 * @param {Object} params - Request parameters
 * @returns {Object} - ForwardRequest object
 */
function buildRequest(params) {
    return {
        from: params.from,
        to: params.to,
        value: params.value || 0,
        gas: params.gas || 1000000,
        nonce: params.nonce,
        data: params.data
    };
}

/**
 * Sign a meta-transaction using EIP-712
 * @param {Object} signer - Ethers signer object
 * @param {Object} forwarder - MetaForwarder contract instance
 * @param {Object} request - ForwardRequest object
 * @returns {string} - Signature
 */
async function signMetaTx(signer, forwarder, request) {
    const domain = buildDomain(
        await forwarder.getAddress(),
        await signer.provider.getNetwork().then(n => n.chainId)
    );
    
    const types = buildTypes();
    
    // Sign the typed data
    const signature = await signer.signTypedData(domain, types, request);
    return signature;
}

/**
 * Execute a meta-transaction through the forwarder
 * @param {Object} forwarder - MetaForwarder contract instance
 * @param {Object} request - ForwardRequest object
 * @param {string} signature - EIP-712 signature
 * @param {Object} relayer - Signer that will pay for gas
 * @returns {Object} - Transaction result
 */
async function executeMetaTx(forwarder, request, signature, relayer) {
    // Connect forwarder with relayer (who pays gas)
    const forwarderWithRelayer = forwarder.connect(relayer);
    
    // Execute the meta-transaction
    const tx = await forwarderWithRelayer.execute(request, signature);
    const receipt = await tx.wait();
    
    return { tx, receipt };
}

/**
 * Complete meta-transaction flow: sign and execute
 * @param {Object} params - Complete flow parameters
 * @returns {Object} - Transaction result
 */
async function signAndExecuteMetaTx(params) {
    const {
        signer,        // User who signs the transaction
        relayer,       // Account that pays gas
        forwarder,     // MetaForwarder contract
        to,           // Target contract
        data,         // Call data
        value = 0,    // ETH value
        gas = 1000000 // Gas limit
    } = params;
    
    // Get nonce for the signer
    const nonce = await forwarder.getNonce(signer.address);
    
    // Build the request
    const request = buildRequest({
        from: signer.address,
        to: to,
        value: value,
        gas: gas,
        nonce: nonce,
        data: data
    });
    
    // Sign the request
    const signature = await signMetaTx(signer, forwarder, request);
    
    // Execute through relayer
    const result = await executeMetaTx(forwarder, request, signature, relayer);
    
    return { request, signature, ...result };
}

/**
 * Helper to create call data for contract function calls
 * @param {Object} contract - Contract instance
 * @param {string} functionName - Function name to call
 * @param {Array} args - Function arguments
 * @returns {string} - Encoded call data
 */
function encodeCallData(contract, functionName, args = []) {
    return contract.interface.encodeFunctionData(functionName, args);
}

/**
 * Verify that a meta-transaction was executed correctly
 * @param {Object} receipt - Transaction receipt
 * @param {string} expectedSender - Expected _msgSender() value
 * @returns {boolean} - True if verification passes
 */
function verifyMetaTxExecution(receipt, expectedSender) {
    // Look for MetaTransactionExecuted event
    const metaTxEvent = receipt.logs.find(log => {
        try {
            const decoded = ethers.Interface.parseLog(log);
            return decoded && decoded.name === "MetaTransactionExecuted";
        } catch {
            return false;
        }
    });
    
    if (!metaTxEvent) {
        throw new Error("MetaTransactionExecuted event not found");
    }
    
    const decoded = ethers.Interface.parseLog(metaTxEvent);
    return decoded.args.from.toLowerCase() === expectedSender.toLowerCase();
}

/**
 * Test helper to simulate gasless transaction scenarios
 */
class MetaTxTestHelper {
    constructor(forwarder, relayer) {
        this.forwarder = forwarder;
        this.relayer = relayer;
    }
    
    async executeAsUser(user, target, functionName, args = [], value = 0) {
        const callData = encodeCallData(target, functionName, args);
        
        return await signAndExecuteMetaTx({
            signer: user,
            relayer: this.relayer,
            forwarder: this.forwarder,
            to: await target.getAddress(),
            data: callData,
            value: value
        });
    }
    
    async expectRevert(user, target, functionName, args = [], expectedError) {
        try {
            await this.executeAsUser(user, target, functionName, args);
            throw new Error("Expected transaction to revert");
        } catch (error) {
            if (!error.message.includes(expectedError)) {
                throw new Error(`Expected error "${expectedError}", got "${error.message}"`);
            }
        }
    }
}

module.exports = {
    buildDomain,
    buildTypes,
    buildRequest,
    signMetaTx,
    executeMetaTx,
    signAndExecuteMetaTx,
    encodeCallData,
    verifyMetaTxExecution,
    MetaTxTestHelper
};
