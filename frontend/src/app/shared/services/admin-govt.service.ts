import { Injectable } from '@angular/core';
import { Observable, from, BehaviorSubject, of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { PublicKey } from '@solana/web3.js';
import { SolanaService } from './solana.service';

// AdminGovt-specific interfaces
export interface GovtDashboardStats {
  totalTaxCollected: number;
  totalProjects: number;
  ongoingProjects: number;
  completedProjects: number;
  totalGrievances: number;
  pendingGrievances: number;
  resolvedGrievances: number;
  configuredWards: string[];
  adminHeadStatus: boolean;
}

export interface AdminHead {
  id: string;
  name: string;
  department: string;
  walletAddress: string;
  dateAssigned: Date;
  isActive: boolean;
}

export interface TaxRate {
  id: string;
  ward: string;
  year: number;
  amount: number;
  lastUpdated: Date;
  setBy: string; // wallet address of govt admin who set it
}

export interface GovtGrievance {
  id: string;
  title: string;
  category: string; // Added missing category property
  description: string;
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Rejected';
  priority: 'High' | 'Medium' | 'Low';
  ward: string;
  submitter: string; // wallet address
  submitterName?: string;
  dateSubmitted: Date;
  dateUpdated?: Date;
  response?: string;
  assignedHead?: string; // wallet address of assigned admin head
}

export interface GovtProject {
  id: string;
  title: string;
  description: string;
  ward: string;
  budget: number;
  status: 'Proposed' | 'Approved' | 'In Progress' | 'Completed' | 'Rejected';
  dateSubmitted: Date;
  dateUpdated?: Date;
  submitter: string; // wallet address
  votes: number;
  documents?: string[];
  images?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminGovtService {
  // BehaviorSubjects for reactive data
  private dashboardStatsSubject = new BehaviorSubject<GovtDashboardStats | null>(null);
  private adminHeadsSubject = new BehaviorSubject<AdminHead[]>([]);
  private taxRatesSubject = new BehaviorSubject<TaxRate[]>([]);
  private grievancesSubject = new BehaviorSubject<GovtGrievance[]>([]);
  private projectsSubject = new BehaviorSubject<GovtProject[]>([]);

  // Public observables
  public dashboardStats$ = this.dashboardStatsSubject.asObservable();
  public adminHeads$ = this.adminHeadsSubject.asObservable();
  public taxRates$ = this.taxRatesSubject.asObservable();
  public grievances$ = this.grievancesSubject.asObservable();
  public projects$ = this.projectsSubject.asObservable();

  constructor(private solanaService: SolanaService) {}

  // Dashboard Statistics
  getDashboardStats(): Observable<GovtDashboardStats> {
    return from(this.fetchDashboardStatsFromBlockchain()).pipe(
      tap(stats => this.dashboardStatsSubject.next(stats)),
      catchError(error => {
        console.error('Error fetching dashboard stats:', error);
        throw error;
      })
    );
  }

  private async fetchDashboardStatsFromBlockchain(): Promise<GovtDashboardStats> {
    const program = this.solanaService.getProgram();
    if (!program) throw new Error('Anchor program not available');

    try {
      // Fetch all relevant accounts from blockchain
      const [taxPayments, projects, grievances] = await Promise.all([
        program.account.taxPayment.all(),
        program.account.project.all(),
        program.account.grievance.all()
      ]);

      // Calculate statistics
      const totalTaxCollected = taxPayments
        .filter((payment: any) => payment.account.status === 'Paid')
        .reduce((total: number, payment: any) => total + payment.account.amount, 0);

      const totalProjects = projects.length;
      const ongoingProjects = projects.filter((p: any) => p.account.status === 'Ongoing').length;
      const completedProjects = projects.filter((p: any) => p.account.status === 'Done').length;

      const totalGrievances = grievances.length;
      const pendingGrievances = grievances.filter((g: any) => g.account.status === 'Pending').length;
      const resolvedGrievances = grievances.filter((g: any) => g.account.status === 'Resolved').length;

      // Get configured wards (from environment or blockchain state)
      const configuredWards = this.getConfiguredWards();

      return {
        totalTaxCollected,
        totalProjects,
        ongoingProjects,
        completedProjects,
        totalGrievances,
        pendingGrievances,
        resolvedGrievances,
        configuredWards,
        adminHeadStatus: true // Check if admin heads are assigned
      };
    } catch (error) {
      console.error('Error in fetchDashboardStatsFromBlockchain:', error);
      throw error;
    }
  }

  // Admin Head Management
  getAllAdminHeads(): Observable<AdminHead[]> {
    return from(this.fetchAdminHeadsFromBlockchain()).pipe(
      tap(heads => this.adminHeadsSubject.next(heads)),
      catchError(error => {
        console.error('Error fetching admin heads:', error);
        throw error;
      })
    );
  }

  private async fetchAdminHeadsFromBlockchain(): Promise<AdminHead[]> {
    const program = this.solanaService.getProgram();
    if (!program) throw new Error('Anchor program not available');

    try {
      // Fetch all admin head accounts from blockchain
      const adminHeadAccounts = await program.account.adminHead.all();
      
      return adminHeadAccounts.map((account: any, index: number) => ({
        id: account.publicKey.toString().slice(-8),
        name: account.account.name || `Admin Head ${index + 1}`,
        department: account.account.department || 'General',
        walletAddress: account.account.authority.toString(),
        dateAssigned: new Date(account.account.createdAt * 1000),
        isActive: account.account.isActive || true
      }));
    } catch (error) {
      console.error('Error in fetchAdminHeadsFromBlockchain:', error);
      throw error;
    }
  }

  assignAdminHead(name: string, department: string, walletAddress: string): Observable<AdminHead> {
    return from(this.performAssignAdminHead(name, department, walletAddress)).pipe(
      tap(newHead => {
        const currentHeads = this.adminHeadsSubject.value;
        this.adminHeadsSubject.next([...currentHeads, newHead]);
      }),
      catchError(error => {
        console.error('Error assigning admin head:', error);
        throw error;
      })
    );
  }

  private async performAssignAdminHead(name: string, department: string, walletAddress: string): Promise<AdminHead> {
    const program = this.solanaService.getProgram();
    const provider = this.solanaService.getProvider();
    if (!program || !provider) throw new Error('Anchor program or provider not available');

    const publicKey = this.solanaService.getPublicKey();
    if (!publicKey) throw new Error('Wallet not connected');

    try {
      const govtAdminPublicKey = new PublicKey(publicKey);
      const newAdminHeadPublicKey = new PublicKey(walletAddress);
      
      // Generate PDA for the new admin head
      const [adminHeadPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('admin_head'), newAdminHeadPublicKey.toBuffer()],
        program.programId
      );

      // Get state PDA
      const [statePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('state')],
        program.programId
      );

      // Call the assignAdminHead instruction
      const txSignature = await program.methods
        .assignAdminHead(name, department)
        .accounts({
          adminHead: adminHeadPDA,
          authority: newAdminHeadPublicKey,
          govtAdmin: govtAdminPublicKey,
          state: statePDA,
        })
        .rpc();

      console.log('Admin head assigned successfully:', txSignature);

      return {
        id: adminHeadPDA.toString().slice(-8),
        name,
        department,
        walletAddress,
        dateAssigned: new Date(),
        isActive: true
      };
    } catch (error) {
      console.error('Error in performAssignAdminHead:', error);
      throw error;
    }
  }

  // Tax Rate Management
  getAllTaxRates(): Observable<TaxRate[]> {
    return from(this.fetchTaxRatesFromBlockchain()).pipe(
      tap(rates => this.taxRatesSubject.next(rates)),
      catchError(error => {
        console.error('Error fetching tax rates:', error);
        throw error;
      })
    );
  }

  private async fetchTaxRatesFromBlockchain(): Promise<TaxRate[]> {
    const program = this.solanaService.getProgram();
    if (!program) throw new Error('Anchor program not available');

    try {
      // Fetch all tax rate accounts from blockchain
      const taxRateAccounts = await program.account.taxRate.all();
      
      return taxRateAccounts.map((account: any) => ({
        id: account.publicKey.toString().slice(-8),
        ward: account.account.ward,
        year: account.account.year,
        amount: account.account.amount,
        lastUpdated: new Date(account.account.lastUpdated * 1000),
        setBy: account.account.setBy.toString()
      }));
    } catch (error) {
      console.error('Error in fetchTaxRatesFromBlockchain:', error);
      throw error;
    }
  }

  setTaxRate(ward: string, year: number, amount: number): Observable<TaxRate> {
    return from(this.performSetTaxRate(ward, year, amount)).pipe(
      tap(newRate => {
        const currentRates = this.taxRatesSubject.value;
        const existingIndex = currentRates.findIndex(r => r.ward === ward && r.year === year);
        
        if (existingIndex >= 0) {
          currentRates[existingIndex] = newRate;
        } else {
          currentRates.push(newRate);
        }
        
        this.taxRatesSubject.next([...currentRates]);
      }),
      catchError(error => {
        console.error('Error setting tax rate:', error);
        throw error;
      })
    );
  }

  private async performSetTaxRate(ward: string, year: number, amount: number): Promise<TaxRate> {
    const program = this.solanaService.getProgram();
    const provider = this.solanaService.getProvider();
    if (!program || !provider) throw new Error('Anchor program or provider not available');

    const publicKey = this.solanaService.getPublicKey();
    if (!publicKey) throw new Error('Wallet not connected');

    try {
      const govtAdminPublicKey = new PublicKey(publicKey);
      
      // Generate PDA for tax rate
      const [taxRatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('tax_rate'), Buffer.from(ward), Buffer.from(year.toString())],
        program.programId
      );

      // Get state PDA
      const [statePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('state')],
        program.programId
      );

      // Call the setTaxRate instruction
      const txSignature = await program.methods
        .setTaxRate(ward, year, amount)
        .accounts({
          taxRate: taxRatePDA,
          govtAdmin: govtAdminPublicKey,
          state: statePDA,
        })
        .rpc();

      console.log('Tax rate set successfully:', txSignature);

      return {
        id: taxRatePDA.toString().slice(-8),
        ward,
        year,
        amount,
        lastUpdated: new Date(),
        setBy: publicKey
      };
    } catch (error) {
      console.error('Error in performSetTaxRate:', error);
      throw error;
    }
  }

  // Grievance Management (View-only for Govt)
  getAllGrievances(): Observable<GovtGrievance[]> {
    return from(this.fetchGrievancesFromBlockchain()).pipe(
      tap(grievances => this.grievancesSubject.next(grievances)),
      catchError(error => {
        console.error('Error fetching grievances:', error);
        throw error;
      })
    );
  }

  private async fetchGrievancesFromBlockchain(): Promise<GovtGrievance[]> {
    const program = this.solanaService.getProgram();
    if (!program) throw new Error('Anchor program not available');

    try {
      const grievanceAccounts = await program.account.grievance.all();
      
      return grievanceAccounts.map((account: any) => ({
        id: account.publicKey.toString().slice(-8),
        title: `Grievance ${account.publicKey.toString().slice(-5)}`,
        category: account.account.category || 'General',
        description: account.account.description,
        status: this.mapBlockchainStatusToUI(account.account.status),
        priority: account.account.priority || 'Medium',
        ward: account.account.ward || 'General',
        submitter: account.account.citizen.toString(),
        submitterName: account.account.citizenName || 'Unknown',
        dateSubmitted: new Date(account.account.timestamp * 1000),
        dateUpdated: account.account.updatedAt ? new Date(account.account.updatedAt * 1000) : undefined,
        response: account.account.response || undefined,
        assignedHead: account.account.assignedHead?.toString() || undefined
      }));
    } catch (error) {
      console.error('Error in fetchGrievancesFromBlockchain:', error);
      throw error;
    }
  }

  // Project Management (View-only for Govt)
  getAllProjects(): Observable<GovtProject[]> {
    return from(this.fetchProjectsFromBlockchain()).pipe(
      tap(projects => this.projectsSubject.next(projects)),
      catchError(error => {
        console.error('Error fetching projects:', error);
        throw error;
      })
    );
  }

  private async fetchProjectsFromBlockchain(): Promise<GovtProject[]> {
    const program = this.solanaService.getProgram();
    if (!program) throw new Error('Anchor program not available');

    try {
      const projectAccounts = await program.account.project.all();
      
      return projectAccounts.map((account: any) => ({
        id: account.publicKey.toString().slice(-8),
        title: account.account.name,
        description: account.account.description,
        ward: account.account.ward || this.getRandomWard(),
        budget: account.account.budget,
        status: this.mapProjectStatusToUI(account.account.status),
        dateSubmitted: new Date(account.account.createdAt * 1000),
        dateUpdated: account.account.updatedAt ? new Date(account.account.updatedAt * 1000) : undefined,
        submitter: account.account.adminHead.toString(),
        votes: Math.floor(Math.random() * 100), // TODO: Add voting to blockchain
        documents: [],
        images: []
      }));
    } catch (error) {
      console.error('Error in fetchProjectsFromBlockchain:', error);
      throw error;
    }
  }

  // Helper methods
  private mapBlockchainStatusToUI(status: any): 'Pending' | 'In Progress' | 'Resolved' | 'Rejected' {
    if (typeof status === 'object') {
      if (status.pending) return 'Pending';
      if (status.inProgress) return 'In Progress';
      if (status.resolved) return 'Resolved';
      if (status.rejected) return 'Rejected';
    }
    return 'Pending';
  }

  private mapProjectStatusToUI(status: any): 'Proposed' | 'Approved' | 'In Progress' | 'Completed' | 'Rejected' {
    if (typeof status === 'object') {
      if (status.planning) return 'Proposed';
      if (status.ongoing) return 'In Progress';
      if (status.done) return 'Completed';
    }
    return 'Proposed';
  }

  private getConfiguredWards(): string[] {
    // This could come from blockchain state or environment config
    return [
      'Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5',
      'Ward 6', 'Ward 7', 'Ward 8', 'Ward 9', 'Ward 10'
    ];
  }

  private getRandomWard(): string {
    const wards = this.getConfiguredWards();
    return wards[Math.floor(Math.random() * wards.length)];
  }

  private getRandomPriority(): 'High' | 'Medium' | 'Low' {
    const priorities: ('High' | 'Medium' | 'Low')[] = ['High', 'Medium', 'Low'];
    return priorities[Math.floor(Math.random() * priorities.length)];
  }
}
