# UrbanDAO Backend

A blockchain-powered smart-city management platform built on Ethereum using Solidity smart contracts.

## Overview

UrbanDAO is a decentralized platform for urban governance that enables citizens, government officials, and administrators to interact in a transparent and efficient manner. The system facilitates tax collection, grievance filing, project management, and democratic decision-making through a role-based access control system.

## Architecture

The UrbanDAO system consists of several interconnected smart contracts organized as follows:

### Core Contracts

1. **UrbanCore.sol**: Central orchestrator with UUPS upgradeability pattern
   - Manages contract integrations and references
   - Controls role assignments with collision prevention
   - Handles citizen onboarding and area management

2. **UrbanToken.sol**: ERC-20 governance token
   - Used for tax payments and governance voting
   - Supports permit operations for gasless approvals
   - Minting controls for rewards and incentives

3. **UrbanGovernor.sol**: Governance system with timelock
   - Implements OpenZeppelin Governor with extensions
   - Uses quadratic voting approximation via power caps
   - Includes TimelockController for execution delays (24 hours)

### Functional Modules

4. **GrievanceHub.sol**: Manages citizen grievances
   - Tracks filing, validation, acceptance, and resolution
   - Supports monthly filing limits (3 per month)
   - Includes feedback and escalation mechanisms

5. **TaxModule.sol**: Handles tax assessments and payments
   - Creates annual tax assessments for citizens
   - Processes tax payments using UrbanToken
   - Issues TaxReceipt NFTs as payment proof
   - Supports objections and meeting scheduling

6. **ProjectRegistry.sol**: Project management system
   - Handles project proposals, funding, and execution
   - Implements milestone-based fund releases
   - Allows citizen upvotes for proposals

7. **TaxReceipt.sol**: Soul-bound NFT receipt system
   - Non-transferable ERC-721 implementation
   - Provides on-chain verification of tax payments
   - Includes on-chain metadata generation

### Infrastructure Contracts

8. **MetaForwarder.sol**: ERC-2771 trusted forwarder
   - Enables gasless transactions across the platform
   - Implements EIP-712 signatures for meta-transactions
   - Provides replay protection via nonces

9. **AccessRoles.sol**: Role management library
   - Defines 8 distinct roles with hierarchical permissions
   - Implements collision prevention mechanisms
   - Used by all contracts for access control

## Role Hierarchy

UrbanDAO implements 8 distinct roles in ascending order of authority:

1. **Citizen**: Regular users who can file grievances and pay taxes
2. **Validator**: Approves citizens and screens grievances
3. **Tax Collector**: Assesses taxes based on citizen documents
4. **Project Manager**: Manages urban development projects
5. **Admin Head**: Local superintendent who manages validators and project managers
6. **Admin Govt**: Oversees multiple zones and audits funds
7. **Tx Payer**: Special role that pays gas for all transactions (gasless UX)
8. **Owner**: Ultimate administrator with system control

## Setup & Installation

### Prerequisites

- Node.js v16+
- npm v8+
- Hardhat v2.16.0+
- An Ethereum wallet with Sepolia ETH for testing

### Installation

1. Clone the repository
2. Navigate to the backend directory
3. Install dependencies:

```bash
npm install
```

### Environment Setup

Create a `.env` file in the backend directory with the following variables:

```
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=your_sepolia_rpc_endpoint
ETHERSCAN_API_KEY=your_etherscan_api_key
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key
```

## Testing

The project includes comprehensive tests for all major functionalities:

```bash
# Run all tests
npx hardhat test

# Run specific test
npx hardhat test test/CleanUrbanDAOTax.test.js
```

### Test Files

- **CleanUrbanDAOTax.test.js**: Tests tax assessment and payment flows with deployed contracts
- **Other tests**: Check specific contract functionalities

### Notes on ABI Decoding Errors

When running tests against deployed contracts, you may encounter ABI decoding errors on some read operations. These errors are non-blocking and do not affect core functionality:

- Write operations complete successfully
- Tests can handle these errors gracefully
- Core business logic works as expected

## Deployment

The contracts are deployed on Sepolia testnet. Addresses are stored in `deployed/addresses.json`.

### Deploy New Contracts

```bash
# Deploy all contracts
npx hardhat run scripts/deploy.js --network sepolia

# Deploy only token
npx hardhat run scripts/deploy-token.js --network sepolia
```

### Verify Contracts on Etherscan

```bash
# Verify a contract
npx hardhat verify --network sepolia CONTRACT_ADDRESS [CONSTRUCTOR_ARGS]
```

## Interaction

### Using Hardhat Console

```bash
npx hardhat console --network sepolia
```

Example interaction:

```javascript
const TaxModule = await ethers.getContractFactory("TaxModule");
const taxModule = TaxModule.attach("0x96AAB8Bad87725C7FD032f29d7D4240a306b1Dc1");
const treasuryAddress = await taxModule.treasury();
console.log(`Treasury address: ${treasuryAddress}`);
```

### Using Scripts

The `scripts` directory contains helper scripts for common operations:

- `deploy.js`: Deploy all contracts
- `deploy-token.js`: Deploy only the UrbanToken contract
- `verify-token-image.js`: Verify token image URI

## Gas Optimization & Security

The contracts implement several gas optimizations:

1. **Gasless Transactions**: ERC-2771 meta-transactions for better UX
2. **Storage Optimization**: Packed enums and efficient data structures
3. **IPFS Integration**: Only hash references stored on-chain

Security features include:

1. **Role-Based Access Control**: OpenZeppelin AccessControl implementation
2. **Timelock**: 24-hour delay on critical governance actions
3. **Upgradeability**: UUPS proxy pattern for future improvements
4. **Role Collision Prevention**: Prevents privilege escalation
