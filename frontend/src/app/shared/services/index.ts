// Centralized exports for all shared services
export { DeviceService } from './device.service';
export { WalletService } from './wallet.service';
export { AnchorService } from './anchor.service';
export { SolanaService } from './solana.service';
export { AdminService } from './admin.service';
export { AdminGovtService } from './admin-govt.service';

// Re-export types and constants
export type { WalletState } from './wallet.service';
export type { SolanaConnectionState } from './solana.service';
export type { AdminGrievance, AdminProject } from './admin.service';
export type { 
  GovtDashboardStats, 
  AdminHead, 
  TaxRate, 
  GovtGrievance, 
  GovtProject 
} from './admin-govt.service';

// Note: ANCHOR_CONFIG and SOLANA_CONFIG are not exported from their respective services
// These would need to be added to the services if needed
