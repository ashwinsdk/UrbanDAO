# UrbanDAO

UrbanDAO is a **blockchain-powered smart-city management platform** built as an Angular PWA with a gasless, role-based decentralized governance system. The project combines on-chain transparency, operational efficiency, and frictionless user experience to coordinate every aspect of municipal interaction—from **citizen grievances and taxation to project funding and feedback**—through a multi-level DAO fueled by Ethereum (Sepolia, Polygon mainnet soon) and a robust Hardhat development environment.

***

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Roles & Permissions](#roles--permissions)
- [Core Smart Contracts](#core-smart-contracts)
- [Workflow Lifecycles](#workflow-lifecycles)
- [Gasless Meta-Transactions](#gasless-meta-transactions)
- [Security Practices](#security-practices)
- [Tech Stack & Setup](#tech-stack--setup)
- [UI/UX Guidelines](#uiux-guidelines)
- [Contributing](#contributing)
- [License](#license)

***

## Overview

**UrbanDAO** is designed as an operating layer for smart cities, modernizing traditional grievance and tax management into an on-chain, trustless, and democratic system. Every major civic process is coordinated through carefully tiered roles in a DAO, ensuring **accountability**, **efficiency**, and **accessibility** with **gasless transactions**.

UrbanDAO’s entire governance, project management, and transaction lifecycles are **enforced by smart contracts** and powered by ERC-20 and NFT incentives. The project demonstrates advanced mastery of Solidity, DAO patterns, meta-transaction relayer systems, and seamless UI engineering.

***

## Key Features

| Feature                      | Description                                                                                       |
|------------------------------|---------------------------------------------------------------------------------------------------|
| **Multilevel DAO**           | 8-tiered roles for fine-grained, decentralized municipal management.                              |
| **Gasless UX**               | ERC-2771/relayer system for frictionless onboarding; citizens never pay gas directly.             |
| **Grievance Management**     | File, escalate, and track issues with off-chain/IPFS storage for extensibility and privacy.       |
| **Quadratic Voting**         | No single participant can dominate project funding or policy votes.                               |
| **Tax Automation**           | Tax assessment and NFT “TaxReceipt” generation; on-chain evidence ensures voting rights.          |
| **Project Registry & Funding** | Milestone-based funding with escrow—fully auditable, abuse-resistant, and transparent.          |
| **Upgradeable Contracts**     | Uses UUPS proxies for upgradability of all major modules.                                         |
| **Role-based Access Control** | One address per role (OpenZeppelin AccessControl); strictly hierarchical privileges.              |
| **IPFS Integration**         | Critical citizen and project docs stored off-chain; hashes are referenced on-chain for verifiability.|
| **Operational Security**     | Timelocks, reentrancy guards, oracle integration (Chainlink) for milestone proofs, and anti-abuse. |

***

## System Architecture

- **Frontend:** Angular PWA, mobile-first, optimal responsiveness, no sidebar, smooth navigation.
- **Blockchain Layer:** Solidity smart contracts, Hardhat environment (v2.16.0+), deployed on Ethereum Sepolia testnet (Polygon and other L1/L2s planned), all contracts designed for upgradeability (UUPS).
- **Interaction Layer:** Ethers.js v6.15.0+, ERC-2771 meta-transactions using OpenGSN/Biconomy for gasless calls.
- **Storage Layer:** Event logs on-chain, text bodies/proofs on [IPFS via Pinata](#).
- **Access Control:** Each role mapped to one EOA; OpenZeppelin’s AccessControl keeps admin hierarchy enforceable.
- **Relayer Module:** Trusted "Tx Payer" account for all contract gas.

***

## Roles & Permissions

### Complete Role Hierarchy

| Role Name      | Responsibility | Admin By                 | UI Access | Notes                        |
|----------------|---------------|--------------------------|-----------|------------------------------|
| Owner          | Project owner (top tier)                | —         | No        | Assigns `adminGovt`         |
| adminGovt      | Supervises all zones, funds, policy     | Owner     | Yes       | Appoints `adminHead`        |
| adminHead      | City-level manager, appoints validators | adminGovt | Yes       | Assigns `TaxCollector`, etc.|
| ProjectManager | Executes projects                       | adminHead | Yes       | Escrow fund withdrawal      |
| TaxCollector   | Assesses/collects tax, issues NFT       | adminHead | Yes       | TaxReceipt NFT issuer       |
| Validator      | KYC, grievance & feedback approval      | adminHead | Yes       | Screens citizens/grievances |
| Citizen        | Registers, files grievances, pays taxes | Validator | Yes       | Can object to taxes         |
| Tx Payer       | Relayer for all gas payments            | Owner     | No        | Only one account            |

_Note: Each role = one address, except `Citizen`: multiple citizens per city/district. See `roles.png` for a diagram._

### Access Control
- Enforced by OpenZeppelin AccessControl (on contract level).
- Each role’s admin is its _immediate superior_.
- All addresses can be changed/rotated only by their respective admins.

***

## Core Smart Contracts

| Contract Name        | Functionality                                                                    |
|----------------------|----------------------------------------------------------------------------------|
| **UrbanToken.sol**   | ERC-20 governance + utility token, stake for voting/discounts, onboarding rewards|
| **UrbanDAO.sol**     | Governor + Timelock Controller; handles proposals, fund release, appointment     |
| **GrievanceHub.sol** | Files, validates, tracks grievances and citizen feedback                         |
| **TaxModule.sol**    | Tax assessment, ERC-20 SBT TaxReceipt NFT issuance, compliance tracking          |
| **ProjectRegistry.sol** | Tracks projects from proposal to funds release to completion                  |
| **MetaForwarder.sol**| ERC-2771 Trusted Forwarder for all meta-transactions (gasless UX)                |

### Storage Gas Optimization
- Use of mappings (vs arrays) for O(1) lookups.
- Packed enums for status (vs strings).
- All event logs (no large text) on-chain; heavy data stored on IPFS.
- Upgradable (UUPS) proxies throughout.

***

## Workflow Lifecycles

### 1. Citizen Onboarding
1. Register on UI with KYC details (IPFS hash upload).
2. Validator checks documents and approves/rejects.
3. UrbanToken mints minimal reward for every new successful onboard.

### 2. Tax Cycle
1. TaxCollector assigns annual tax post KYC (per address/user).
2. Citizen pays using payTax() (meta-tx, so no gas paid directly).
3. Receipt minted as ERC-721 SBT; proves tax paid (required for DAO votes).

### 3. Grievance Lifecycle
1. Citizen files up to 3 grievances/month.
2. Validator reviews for spam/abuse.
3. adminHead adjudicates, may open new project if valid.
4. Project proposal is open for quadratic vote.
5. If passed, ProjectManager handles execution and fund tranches released on milestone proofs.

### 4. Feedback & Dispute
- Citizens can send feedback after resolution.
- Unresolved status = grievance reopens; three reopens auto-escalate to adminGovt.

***

## Gasless Meta-Transactions

- **Meta-tx Framework:** ERC-2771 (OpenGSN/Biconomy) for relayed, gasless txs.
- **Contract Engineering:** Inherit `ERC2771Context`, override `_msgSender()` for identity recovery.
- **Security:** Nonce mapping to prevent replay, trusted forwarder address timelocked, permissioned.

**Relayer Workflow:**
1. Citizen signs tx offline.
2. Tx Payer (forwarder/relayer) pays gas, forwards tx to contracts.
3. Contract authenticates sender and processes.
4. Fees reclaimed/reimbursed via stablecoin from treasury.

***

## Security Practices

- **Hierarchical Role Control:** Tiered getRoleAdmin() prevents privilege escalation.
- **Timelock:** All treasury transfers have a 24-hour delay.
- **Reentrancy Guards:** All sensitive functions (`payTax`, milestone withdrawal) protected.
- **Oracle Integration:** Milestone claims use Chainlink proofs if required.
- **Gas Relayer Hardening:** Nonce + signature checks for anti-replay; relayer address changes require DAO vote.

***

## Tech Stack & Setup

### Contract Development

- **Solidity:** ^0.8.22
- **Hardhat:** ^2.16.0
- **ethers.js:** ^6.15.0
- **OpenZeppelin Contracts:** AccessControl, ERC-20, ERC-721, UUPS proxies, ERC-2771Context
- **Pinata/IPFS:** Citizen data, project docs off-chain (see `PinataAPI-KEYS.txt`)

### Frontend Development

- **Angular PWA:** Mobile-first, responsive PWA (no sidebar, all rounded corners).
- **Theming:** Primary color is linear-gradient(135deg, #a259d9, #5e239d), with dark background.

### Running Locally

```bash
# Clone the repo
git clone https://github.com/yourusername/UrbanDAO.git
cd UrbanDAO

# Install dependencies
npm install

# Start the Angular App (with proxy if needed)
ng serve --open

# For contracts, enter /contracts and run Hardhat locally:
cd contracts
npm install
npx hardhat compile
npx hardhat test
npx hardhat node
```

**First-Time Setup:**  
- Populate `.env` files for Angular and Hardhat.
- Place `PinataAPI-KEYS.txt` for IPFS key provisioning.

***

## UI/UX Guidelines

| Principle                   | Details                                                                                  |
|-----------------------------|------------------------------------------------------------------------------------------|
| **Clean, Minimal UI**       | Reference [parse.bot](https://parse.bot/) for simplicity, clarity, and smoothness.       |
| **Colors**                  | Primary: `linear-gradient(135deg, #a259d9, #5e239d)`; Bg: Black/Dark.                   |
| **No Sidebar**              | Navigation is tabbed/modal-based for ultimate UX.                                       |
| **Responsiveness**          | Works perfectly across all device viewports and browsers.                               |
| **All Elements Rounded**    | Buttons, containers, modals, inputs all have rounded corners.                           |
| **Fast, No Lag Experience** | Optimize for zero jank in navigation or transitions.                                    |

### UI Structure

- **Index / Home**
- **Login**
- **Register**
- **Registration Status**

#### Per-Role Dashboards

- **Citizens:**  
  - Dashboard
  - File/check grievances, view project status, KYC/tax module

- **Validator:**  
  - Dashboard
  - Approve citizens, filter grievances, validate feedback

- **Tax Collector:**  
  - Dashboard
  - Assign/read taxes, issue receipts

- **Project Manager:**  
  - Dashboard
  - Project milestones, fund requests

- **adminHead:**  
  - Dashboard
  - Appoint roles, accept/reject grievances, curate projects

- **adminGovt:**  
  - Dashboard
  - Manage zones, funds, all project/tax/citizen records

- **Tx Payer & Owner:**  
  - **No UI** (fully backend/blockchain roles)

***

## Contributing

1. Fork the repo; create your branch (`git checkout -b my-feature`).
2. Commit changes with clear messages.
3. Submit a PR and describe what your changes add/improve.

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.

***

## License

UrbanDAO is released under the [MIT License](LICENSE.md).

***

**UrbanDAO brings transparency, efficiency, and inclusivity to smart-city governance—by the people, for the people, on-chain.**