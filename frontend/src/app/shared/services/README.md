# UrbanDAO Solana Integration Services

This directory contains the core services for integrating the UrbanDAO Angular frontend with the deployed Solana Anchor program.

## Architecture Overview

The Solana integration follows a modular, service-oriented architecture with three main services:

```
SolanaService (Main Interface)
├── WalletService (Phantom Wallet Connection)
└── AnchorService (Anchor Program Initialization)
```

## Services

### 1. WalletService (`wallet.service.ts`)
**Purpose**: Handles Phantom wallet connection and management
**Key Features**:
- Phantom wallet detection and connection
- Wallet state management (connected, connecting, error states)
- Event listeners for account changes and disconnections
- Session persistence across page reloads

**Usage**:
```typescript
import { WalletService } from './shared/services';

constructor(private walletService: WalletService) {}

// Connect wallet
this.walletService.connectWallet().subscribe({
  next: (publicKey) => console.log('Connected:', publicKey),
  error: (error) => console.error('Connection failed:', error)
});

// Monitor wallet state
this.walletService.walletState$.subscribe(state => {
  console.log('Wallet state:', state);
});
```

### 2. AnchorService (`anchor.service.ts`)
**Purpose**: Initializes and manages the Anchor program connection
**Key Features**:
- IDL loading from `/src/idl/urban_dao.json`
- Anchor program initialization with correct programId
- Provider and connection management
- Integration with wallet service for automatic setup

**Configuration**:
```typescript
export const ANCHOR_CONFIG = {
  PROGRAM_ID: 'HLnt2dR9sUSYsogSPp7BA3ca4E6JfqgT8YLA77uTwNVt',
  CLUSTER: 'devnet',
  DEVNET_RPC: 'https://api.devnet.solana.com',
  MAINNET_RPC: 'https://api.mainnet-beta.solana.com'
};
```

### 3. SolanaService (`solana.service.ts`) - **Main Interface**
**Purpose**: Centralized service that orchestrates wallet and Anchor connections
**Key Features**:
- Unified connection state management
- Single point of access for all blockchain operations
- Automatic coordination between wallet and Anchor services
- Environment-based configuration

**Primary Usage Pattern**:
```typescript
import { SolanaService } from './shared/services';

constructor(private solanaService: SolanaService) {}

// Connect to Solana (wallet + program)
this.solanaService.connect().subscribe({
  next: (state) => {
    if (state.walletConnected && state.anchorReady) {
      // Ready for blockchain operations
      const program = this.solanaService.getProgram();
      // Use program for contract calls
    }
  }
});

// Check if ready for operations
if (this.solanaService.isReady()) {
  const program = this.solanaService.getProgram();
  // Make contract calls
}
```

## Integration with Role-Based Modules

Each role-specific module should import and use the `SolanaService`:

### For Citizen Module (`/user/`)
```typescript
import { SolanaService } from '../shared/services';

@Component({...})
export class CitizenComponent {
  constructor(private solanaService: SolanaService) {}
  
  async submitGrievance(grievanceData: any) {
    if (!this.solanaService.isReady()) {
      throw new Error('Solana connection not ready');
    }
    
    const program = this.solanaService.getProgram();
    // Call program methods for grievance submission
  }
}
```

### For Admin Head Module (`/admin-head/`)
```typescript
import { SolanaService } from '../shared/services';

@Component({...})
export class AdminHeadComponent {
  constructor(private solanaService: SolanaService) {}
  
  async approveProject(projectId: string) {
    const program = this.solanaService.getProgram();
    // Call program methods for project approval
  }
}
```

### For Government Module (`/admin-govt/`)
```typescript
import { SolanaService } from '../shared/services';

@Component({...})
export class AdminGovtComponent {
  constructor(private solanaService: SolanaService) {}
  
  async allocateFunds(amount: number, recipient: string) {
    const program = this.solanaService.getProgram();
    // Call program methods for fund allocation
  }
}
```

## Environment Configuration

The services use environment-based configuration for different networks:

### Development (`environment.ts`)
```typescript
export const environment = {
  production: false,
  solana: {
    cluster: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    programId: 'HLnt2dR9sUSYsogSPp7BA3ca4E6JfqgT8YLA77uTwNVt',
    commitment: 'confirmed'
  }
};
```

### Production (`environment.prod.ts`)
```typescript
export const environment = {
  production: true,
  solana: {
    cluster: 'mainnet-beta',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    programId: 'HLnt2dR9sUSYsogSPp7BA3ca4E6JfqgT8YLA77uTwNVt',
    commitment: 'confirmed'
  }
};
```

## Next Steps for Implementation

1. **Install Dependencies**: Run `npm install` to install the Solana packages
2. **Update Anchor Service**: Complete the `initializeAnchorComponents()` method with actual Anchor imports
3. **Test Connection**: Verify wallet connection and program initialization
4. **Implement Contract Methods**: Add specific methods for each role's blockchain operations
5. **Error Handling**: Implement comprehensive error handling and user feedback
6. **Testing**: Create unit tests for each service

## Dependencies Added

The following packages have been added to `package.json`:
- `@project-serum/anchor`: ^0.28.0
- `@solana/web3.js`: ^1.87.6
- `@solana/wallet-adapter-base`: ^0.9.23
- `@solana/wallet-adapter-phantom`: ^0.9.24
- `@solana/wallet-adapter-wallets`: ^0.19.24

## File Structure

```
src/
├── app/
│   ├── shared/
│   │   └── services/
│   │       ├── wallet.service.ts      # Phantom wallet connection
│   │       ├── anchor.service.ts      # Anchor program setup
│   │       ├── solana.service.ts      # Main Solana interface
│   │       ├── device.service.ts      # Existing device service
│   │       ├── index.ts               # Service exports
│   │       └── README.md              # This documentation
│   ├── adminGovt/                     # Government role module
│   ├── adminHead/                     # Municipal head role module
│   ├── user/                          # Citizen role module
│   └── auth/                          # Authentication system
├── environments/
│   ├── environment.ts                 # Development config
│   └── environment.prod.ts            # Production config
└── idl/
    └── urban_dao.json                 # Anchor program IDL
```

## Important Notes

- All services are provided at the root level (`providedIn: 'root'`) for singleton behavior
- The `SolanaService` should be the primary interface used by components
- Wallet connection state is automatically managed and persisted
- The Anchor program is automatically initialized when the wallet connects
- Error states are managed and exposed through observables
- The integration follows the UrbanDAO global development rules for modularity and reusability
