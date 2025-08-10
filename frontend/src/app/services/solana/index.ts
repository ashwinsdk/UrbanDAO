// Solana Services Index
export { WalletService } from './wallet.service';
export type { WalletState } from './wallet.service';
export { AnchorService } from './anchor.service';
export { SolanaService } from './solana.service';
export type { UserRole } from './solana.service';

// Re-export blockchain service types for convenience
export type {
  Grievance,
  TaxPayment,
  Project,
  Feedback,
  WardTax
} from '../../shared/services/blockchain.service';

export {
  GrievanceStatus,
  ProjectStatus,
  FeedbackStatus
} from '../../shared/services/blockchain.service';
