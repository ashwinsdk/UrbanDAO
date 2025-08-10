import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of, catchError } from 'rxjs';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Buffer } from 'buffer';
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

  // Real blockchain operations
  async submitGrievance(grievanceData: { details: string }): Promise<string> {
    try {
      const program = this.anchorService.getProgram();
      const wallet = this.walletService.publicKey;
      
      if (!program || !wallet) {
        throw new Error('Program not initialized or wallet not connected');
      }

      // Generate unique grievance ID
      const grievanceId = Date.now().toString();
      const [grievancePDA] = await this.anchorService.generateGrievancePDA(grievanceId);
      
      const tx = await program.methods
        ['fileGrievance'](grievanceData.details)
        .accounts({
          grievance: grievancePDA,
          user: wallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Grievance submitted successfully:', tx);
      return tx;
    } catch (error) {
      console.error('Error submitting grievance:', error);
      throw error;
    }
  }

  async payTax(taxData: { ward: number; year: number }): Promise<string> {
    try {
      const program = this.anchorService.getProgram();
      const wallet = this.walletService.publicKey;
      
      if (!program || !wallet) {
        throw new Error('Program not initialized or wallet not connected');
      }

      // Generate PDAs
      const [statePDA] = await this.anchorService.generateStatePDA();
      const [wardTaxPDA] = await this.anchorService.generateWardTaxPDA(taxData.ward.toString(), taxData.year);
      const [taxPaymentPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from('tax_payment'), wallet.toBuffer(), Buffer.from(taxData.ward.toString()), Buffer.from(taxData.year.toString())],
        this.anchorService.getProgramId()
      );
      const [treasuryPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from('treasury')],
        this.anchorService.getProgramId()
      );
      
      const tx = await program.methods
        ['payTax'](taxData.ward, taxData.year)
        .accounts({
          taxPayment: taxPaymentPDA,
          wardTax: wardTaxPDA,
          state: statePDA,
          treasury: treasuryPDA,
          user: wallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Tax payment successful:', tx);
      return tx;
    } catch (error) {
      console.error('Error paying tax:', error);
      throw error;
    }
  }

  async submitFeedback(feedbackData: { projectId: string; comment: string; satisfied: boolean }): Promise<string> {
    try {
      const program = this.anchorService.getProgram();
      const wallet = this.walletService.publicKey;
      
      if (!program || !wallet) {
        throw new Error('Program not initialized or wallet not connected');
      }

      // Generate PDAs
      const feedbackId = Date.now().toString();
      const [feedbackPDA] = await this.anchorService.generateFeedbackPDA(feedbackId);
      const [projectPDA] = await this.anchorService.generateProjectPDA(feedbackData.projectId);
      
      const tx = await program.methods
        ['giveFeedback'](feedbackData.comment, feedbackData.satisfied)
        .accounts({
          feedback: feedbackPDA,
          project: projectPDA,
          user: wallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Feedback submitted successfully:', tx);
      return tx;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }

  // Data fetching methods
  getGrievances(): Observable<Grievance[]> {
    return from(this.fetchGrievances()).pipe(
      catchError(error => {
        console.error('Error fetching grievances:', error);
        return of([]);
      })
    );
  }

  private async fetchGrievances(): Promise<Grievance[]> {
    try {
      const program = this.anchorService.getProgram();
      if (!program) {
        throw new Error('Program not initialized');
      }

      const grievances = await program.account.grievance.all();
      return grievances.map((g: any) => ({
        id: g.publicKey.toString(),
        user: g.account.user.toString(),
        category: 'General', // Default category
        description: g.account.details,
        details: g.account.details,
        status: this.mapGrievanceStatus(g.account.status),
        timestamp: g.account.timestamp,
        dateSubmitted: new Date(g.account.timestamp * 1000),
        transactionId: g.publicKey.toString()
      }));
    } catch (error) {
      console.error('Error fetching grievances from blockchain:', error);
      return [];
    }
  }

  getTaxPayments(): Observable<TaxPayment[]> {
    return from(this.fetchTaxPayments()).pipe(
      catchError(error => {
        console.error('Error fetching tax payments:', error);
        return of([]);
      })
    );
  }

  private async fetchTaxPayments(): Promise<TaxPayment[]> {
    try {
      const program = this.anchorService.getProgram();
      if (!program) {
        throw new Error('Program not initialized');
      }

      // Note: taxPayment account may not exist in IDL, using alternative approach
      // For now, return empty array until account structure is confirmed
      return [];
    } catch (error) {
      console.error('Error fetching tax payments from blockchain:', error);
      return [];
    }
  }

  getProjects(): Observable<Project[]> {
    return from(this.fetchProjects()).pipe(
      catchError(error => {
        console.error('Error fetching projects:', error);
        return of([]);
      })
    );
  }

  private async fetchProjects(): Promise<Project[]> {
    try {
      const program = this.anchorService.getProgram();
      if (!program) {
        throw new Error('Program not initialized');
      }

      const projects = await program.account.project.all();
      return projects.map((p: any) => ({
        id: p.publicKey.toString(),
        name: p.account.name,
        description: p.account.details,
        details: p.account.details,
        location: 'TBD', // Default location
        createdBy: 'Admin Head', // Default creator
        timestamp: Date.now(),
        status: this.mapProjectStatus(p.account.status),
        startDate: new Date(),
        budget: 1000, // Default budget
        ward: 1, // Default ward
        allocatedFunds: 0,
        completionPercentage: p.account.status === 'Done' ? 100 : 0
      }));
    } catch (error) {
      console.error('Error fetching projects from blockchain:', error);
      return [];
    }
  }

  getFeedback(): Observable<Feedback[]> {
    return from(this.fetchFeedback()).pipe(
      catchError(error => {
        console.error('Error fetching feedback:', error);
        return of([]);
      })
    );
  }

  private async fetchFeedback(): Promise<Feedback[]> {
    try {
      const program = this.anchorService.getProgram();
      if (!program) {
        throw new Error('Program not initialized');
      }

      const feedback = await program.account.feedback.all();
      return feedback.map((f: any) => ({
        id: f.publicKey.toString(),
        user: f.account.user.toString(),
        projectId: f.account.project.toString(),
        comment: f.account.comment,
        satisfied: f.account.satisfied,
        timestamp: Date.now(),
        transactionId: f.publicKey.toString()
      }));
    } catch (error) {
      console.error('Error fetching feedback from blockchain:', error);
      return [];
    }
  }

  getWardTaxes(): Observable<WardTax[]> {
    return from(this.fetchWardTaxes()).pipe(
      catchError(error => {
        console.error('Error fetching ward taxes:', error);
        return of([]);
      })
    );
  }

  private async fetchWardTaxes(): Promise<WardTax[]> {
    try {
      const program = this.anchorService.getProgram();
      if (!program) {
        throw new Error('Program not initialized');
      }

      const wardTaxes = await program.account.wardTax.all();
      return wardTaxes.map((wt: any) => ({
        ward: wt.account.ward,
        amount: wt.account.amount
      }));
    } catch (error) {
      console.error('Error fetching ward taxes from blockchain:', error);
      return [];
    }
  }

  // Admin operations
  async assignAdminHead(newAdminHead: string): Promise<string> {
    try {
      const program = this.anchorService.getProgram();
      const wallet = this.walletService.publicKey;
      
      if (!program || !wallet) {
        throw new Error('Program not initialized or wallet not connected');
      }

      const [statePDA] = await this.anchorService.generateStatePDA();
      const newAdminHeadPubkey = new PublicKey(newAdminHead);
      
      const tx = await program.methods
        ['assignAdminHead'](newAdminHeadPubkey)
        .accounts({
          state: statePDA,
          adminGovt: wallet,
        })
        .rpc();

      console.log('Admin head assigned successfully:', tx);
      return tx;
    } catch (error) {
      console.error('Error assigning admin head:', error);
      throw error;
    }
  }

  async setWardTax(ward: number, amount: number): Promise<string> {
    try {
      const program = this.anchorService.getProgram();
      const wallet = this.walletService.publicKey;
      
      if (!program || !wallet) {
        throw new Error('Program not initialized or wallet not connected');
      }

      const [statePDA] = await this.anchorService.generateStatePDA();
      const [wardTaxPDA] = await this.anchorService.generateWardTaxPDA(ward.toString(), new Date().getFullYear());
      
      const tx = await program.methods
        ['setWardTax'](ward, amount * LAMPORTS_PER_SOL) // Convert SOL to lamports
        .accounts({
          wardTax: wardTaxPDA,
          state: statePDA,
          adminGovt: wallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Ward tax set successfully:', tx);
      return tx;
    } catch (error) {
      console.error('Error setting ward tax:', error);
      throw error;
    }
  }

  async updateGrievanceStatus(grievanceId: string, newStatus: GrievanceStatus): Promise<string> {
    try {
      const program = this.anchorService.getProgram();
      const wallet = this.walletService.publicKey;
      
      if (!program || !wallet) {
        throw new Error('Program not initialized or wallet not connected');
      }

      const [grievancePDA] = await this.anchorService.generateGrievancePDA(grievanceId);
      const [statePDA] = await this.anchorService.generateStatePDA();
      
      const tx = await program.methods
        ['updateGrievanceStatus'](this.mapToSolanaGrievanceStatus(newStatus))
        .accounts({
          grievance: grievancePDA,
          state: statePDA,
          adminHead: wallet,
        })
        .rpc();

      console.log('Grievance status updated successfully:', tx);
      return tx;
    } catch (error) {
      console.error('Error updating grievance status:', error);
      throw error;
    }
  }

  async createProject(projectData: { name: string; details: string }): Promise<string> {
    try {
      const program = this.anchorService.getProgram();
      const wallet = this.walletService.publicKey;
      
      if (!program || !wallet) {
        throw new Error('Program not initialized or wallet not connected');
      }

      const projectId = Date.now().toString();
      const [projectPDA] = await this.anchorService.generateProjectPDA(projectId);
      const [statePDA] = await this.anchorService.generateStatePDA();
      
      const tx = await program.methods
        ['createProject'](projectData.name, projectData.details)
        .accounts({
          project: projectPDA,
          state: statePDA,
          adminHead: wallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Project created successfully:', tx);
      return tx;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  async updateProjectStatus(projectId: string, newStatus: ProjectStatus): Promise<string> {
    try {
      const program = this.anchorService.getProgram();
      const wallet = this.walletService.publicKey;
      
      if (!program || !wallet) {
        throw new Error('Program not initialized or wallet not connected');
      }

      const [projectPDA] = await this.anchorService.generateProjectPDA(projectId);
      const [statePDA] = await this.anchorService.generateStatePDA();
      
      const tx = await program.methods
        ['updateProjectStatus'](this.mapToSolanaProjectStatus(newStatus))
        .accounts({
          project: projectPDA,
          state: statePDA,
          adminHead: wallet,
        })
        .rpc();

      console.log('Project status updated successfully:', tx);
      return tx;
    } catch (error) {
      console.error('Error updating project status:', error);
      throw error;
    }
  }

  // Helper methods for status mapping
  private mapGrievanceStatus(status: any): GrievanceStatus {
    switch (status) {
      case 'Pending': return GrievanceStatus.Pending;
      case 'Accepted': return GrievanceStatus.Accepted;
      case 'Rejected': return GrievanceStatus.Rejected;
      case 'Done': return GrievanceStatus.Done;
      default: return GrievanceStatus.Pending;
    }
  }

  private mapProjectStatus(status: any): ProjectStatus {
    switch (status) {
      case 'Planning': return ProjectStatus.Planning;
      case 'Ongoing': return ProjectStatus.Ongoing;
      case 'Done': return ProjectStatus.Done;
      default: return ProjectStatus.Planning;
    }
  }

  private mapToSolanaGrievanceStatus(status: GrievanceStatus): any {
    switch (status) {
      case GrievanceStatus.Pending: return { pending: {} };
      case GrievanceStatus.Accepted: return { accepted: {} };
      case GrievanceStatus.Rejected: return { rejected: {} };
      case GrievanceStatus.Done: return { done: {} };
      default: return { pending: {} };
    }
  }

  private mapToSolanaProjectStatus(status: ProjectStatus): any {
    switch (status) {
      case ProjectStatus.Planning: return { planning: {} };
      case ProjectStatus.Ongoing: return { ongoing: {} };
      case ProjectStatus.Done: return { done: {} };
      default: return { planning: {} };
    }
  }
}
