import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletService } from './wallet.service';
import { AnchorService } from './anchor.service';
import { 
  Grievance, 
  TaxPayment, 
  Project,
  Feedback,
  WardTax,
  GrievanceStatus,
  ProjectStatus,
  FeedbackStatus
} from '../../shared/services/blockchain.service';

export interface UserRole {
  role: 'citizen' | 'head' | 'government' | null;
  account?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SolanaService {
  private _userRole$ = new BehaviorSubject<UserRole>({ role: null });

  constructor(
    private walletService: WalletService,
    private anchorService: AnchorService
  ) {
    // Listen for wallet connection changes and update user role
    this.walletService.state$.subscribe(async (walletState) => {
      if (walletState.connected && walletState.publicKey) {
        await this.detectUserRole(walletState.publicKey);
      } else {
        this._userRole$.next({ role: null });
      }
    });
  }

  // Wallet Management
  get isWalletConnected(): boolean {
    return this.walletService.isConnected;
  }

  get walletPublicKey(): PublicKey | null {
    return this.walletService.publicKey;
  }

  get walletState$(): Observable<any> {
    return this.walletService.state$;
  }

  get userRole$(): Observable<UserRole> {
    return this._userRole$.asObservable();
  }

  async connectWallet(): Promise<boolean> {
    return await this.walletService.connect();
  }

  async disconnectWallet(): Promise<void> {
    await this.walletService.disconnect();
    this._userRole$.next({ role: null });
  }

  getPublicKey(): PublicKey | null {
    return this.walletService.publicKey;
  }

  // User Role Detection
  private async detectUserRole(publicKey: PublicKey): Promise<void> {
    try {
      const program = this.anchorService.getProgram();
      if (!program) {
        console.error('Anchor program not initialized');
        return;
      }

      // Check citizen account
      try {
        const [citizenPDA] = await this.anchorService.generateCitizenPDA(publicKey);
        const citizenAccount = await program.account.citizen.fetchNullable(citizenPDA);
        if (citizenAccount) {
          this._userRole$.next({ role: 'citizen', account: citizenAccount });
          return;
        }
      } catch (error) {
        // Account doesn't exist, continue checking
      }

      // Check head account
      try {
        const [headPDA] = await this.anchorService.generateHeadPDA(publicKey);
        const headAccount = await program.account.head.fetchNullable(headPDA);
        if (headAccount) {
          this._userRole$.next({ role: 'head', account: headAccount });
          return;
        }
      } catch (error) {
        // Account doesn't exist, continue checking
      }

      // Check government account
      try {
        const [governmentPDA] = await this.anchorService.generateGovernmentPDA(publicKey);
        const governmentAccount = await program.account.government.fetchNullable(governmentPDA);
        if (governmentAccount) {
          this._userRole$.next({ role: 'government', account: governmentAccount });
          return;
        }
      } catch (error) {
        // Account doesn't exist
      }

      // No role found
      this._userRole$.next({ role: null });
    } catch (error) {
      console.error('Error detecting user role:', error);
      this._userRole$.next({ role: null });
    }
  }

  // Registration Methods
  async performAnchorRegistration(userData: {
    name: string;
    email: string;
    phone: string;
    address: string;
    ward: string;
    role: 'citizen' | 'head' | 'government';
    [key: string]: any;
  }): Promise<any> {
    try {
      const program = this.anchorService.getProgram();
      const wallet = this.walletService.publicKey;
      
      if (!program || !wallet) {
        throw new Error('Program not initialized or wallet not connected');
      }

      switch (userData.role) {
        case 'citizen':
          return await this.registerCitizen(userData);
        case 'head':
          return await this.registerHead(userData);
        case 'government':
          return await this.registerGovernment(userData);
        default:
          throw new Error('Invalid role specified');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  private async registerCitizen(userData: any): Promise<any> {
    const program = this.anchorService.getProgram();
    const wallet = this.walletService.publicKey;
    
    if (!program || !wallet) {
      throw new Error('Program or wallet not available');
    }

    const [citizenPDA] = await this.anchorService.generateCitizenPDA(wallet);
    
    const tx = await program.methods
      ['initializeCitizen'](
        userData.name,
        userData.email,
        userData.phone,
        userData.address,
        userData.ward
      )
      .accounts({
        citizen: citizenPDA,
        authority: wallet,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('Citizen registration transaction:', tx);
    return { success: true, signature: tx, role: 'citizen' };
  }

  private async registerHead(userData: any): Promise<any> {
    const program = this.anchorService.getProgram();
    const wallet = this.walletService.publicKey;
    
    if (!program || !wallet) {
      throw new Error('Program or wallet not available');
    }

    const [headPDA] = await this.anchorService.generateHeadPDA(wallet);
    
    const tx = await program.methods
      ['initializeHead'](
        userData.name,
        userData.email,
        userData.phone,
        userData.address,
        userData.ward,
        userData.department || 'General Administration'
      )
      .accounts({
        head: headPDA,
        authority: wallet,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('Head registration transaction:', tx);
    return { success: true, signature: tx, role: 'head' };
  }

  private async registerGovernment(userData: any): Promise<any> {
    const program = this.anchorService.getProgram();
    const wallet = this.walletService.publicKey;
    
    if (!program || !wallet) {
      throw new Error('Program or wallet not available');
    }

    const [governmentPDA] = await this.anchorService.generateGovernmentPDA(wallet);
    
    const tx = await program.methods
      ['initializeGovernment'](
        userData.name,
        userData.email,
        userData.phone,
        userData.address,
        userData.department || 'Municipal Corporation'
      )
      .accounts({
        government: governmentPDA,
        authority: wallet,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('Government registration transaction:', tx);
    return { success: true, signature: tx, role: 'government' };
  }

  // Registration Check (Duplicate Detection)
  async performDuplicateCheck(): Promise<any> {
    try {
      const wallet = this.walletService.publicKey;
      const program = this.anchorService.getProgram();
      
      if (!wallet || !program) {
        return null;
      }

      // Check all role PDAs for existing accounts
      const [citizenPDA] = await this.anchorService.generateCitizenPDA(wallet);
      const [headPDA] = await this.anchorService.generateHeadPDA(wallet);
      const [governmentPDA] = await this.anchorService.generateGovernmentPDA(wallet);

      const citizenAccount = await program.account.citizen.fetchNullable(citizenPDA);
      if (citizenAccount) {
        return { role: 'citizen', account: citizenAccount };
      }

      const headAccount = await program.account.head.fetchNullable(headPDA);
      if (headAccount) {
        return { role: 'head', account: headAccount };
      }

      const governmentAccount = await program.account.government.fetchNullable(governmentPDA);
      if (governmentAccount) {
        return { role: 'government', account: governmentAccount };
      }

      return null; // No existing registration found
    } catch (error) {
      console.error('Error checking for duplicate registration:', error);
      throw error;
    }
  }

  // Registration Check for Login
  async performRegistrationCheck(): Promise<UserRole> {
    const wallet = this.walletService.publicKey;
    if (!wallet) {
      return { role: null };
    }

    await this.detectUserRole(wallet);
    return this._userRole$.value;
  }

  // Placeholder methods for blockchain operations (to be implemented)
  async submitGrievance(grievanceData: any): Promise<string> {
    // TODO: Implement real grievance submission
    console.error('Real blockchain integration: submitGrievance not yet implemented');
    throw new Error('Real blockchain integration required');
  }

  async payTax(taxData: any): Promise<string> {
    // TODO: Implement real tax payment
    console.error('Real blockchain integration: payTax not yet implemented');
    throw new Error('Real blockchain integration required');
  }

  async submitFeedback(feedbackData: any): Promise<string> {
    // TODO: Implement real feedback submission
    console.error('Real blockchain integration: submitFeedback not yet implemented');
    throw new Error('Real blockchain integration required');
  }

  // Data fetching methods (placeholders)
  getGrievances(): Observable<Grievance[]> {
    console.error('Real blockchain integration: getGrievances not yet implemented');
    return of([]);
  }

  getTaxPayments(): Observable<TaxPayment[]> {
    console.error('Real blockchain integration: getTaxPayments not yet implemented');
    return of([]);
  }

  getProjects(): Observable<Project[]> {
    console.error('Real blockchain integration: getProjects not yet implemented');
    return of([]);
  }

  getFeedback(): Observable<Feedback[]> {
    console.error('Real blockchain integration: getFeedback not yet implemented');
    return of([]);
  }

  getWardTaxes(): Observable<WardTax[]> {
    console.error('Real blockchain integration: getWardTaxes not yet implemented');
    return of([]);
  }
}
