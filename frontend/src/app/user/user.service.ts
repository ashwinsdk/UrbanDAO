import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, from, throwError } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { SolanaService } from '../shared/services';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';

// Declare Buffer for Node.js compatibility
declare const Buffer: {
  from(data: string | number[]): any;
};

export interface Grievance {
  id: string;
  category: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Rejected';
  dateSubmitted: Date;
  response?: string;
}

export interface TaxPayment {
  id: string;
  ward: string;
  year: number;
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
  datePaid: Date;
  transactionId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'Planning' | 'Ongoing' | 'Done';
  startDate: Date;
  endDate?: Date;
  budget: number;
  location: string;
  ward: string;
}

export interface UserFeedback {
  id: string;
  projectId: string;
  projectName: string;
  comment: string;
  satisfaction: 1 | 2 | 3 | 4 | 5;
  dateSubmitted: Date;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private grievancesSubject = new BehaviorSubject<Grievance[]>([]);
  private taxPaymentsSubject = new BehaviorSubject<TaxPayment[]>([]);
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  private feedbackSubject = new BehaviorSubject<UserFeedback[]>([]);

  grievances$ = this.grievancesSubject.asObservable();
  taxPayments$ = this.taxPaymentsSubject.asObservable();
  projects$ = this.projectsSubject.asObservable();
  feedback$ = this.feedbackSubject.asObservable();

  constructor(
    private authService: AuthService,
    private solanaService: SolanaService
  ) {
    // Initialize with empty data - will be loaded from blockchain
    this.initializeService();
  }

  private initializeService(): void {
    // Initialize with empty arrays - data will be loaded from blockchain when needed
    this.grievancesSubject.next([]);
    this.taxPaymentsSubject.next([]);
    this.projectsSubject.next([]);
    this.feedbackSubject.next([]);
  }

  /**
   * Load user's grievances from blockchain
   */
  private loadGrievancesFromBlockchain(userPublicKey: string): Observable<Grievance[]> {
    const program = this.solanaService.getProgram();
    if (!program) {
      return throwError(() => new Error('Anchor program not available'));
    }

    // Fetch all grievance accounts for this user
    return from(program.account.grievance.all([
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: new PublicKey(userPublicKey).toBase58()
        }
      }
    ]) as Promise<any[]>).pipe(
      map((accounts: any[]) => {
        return accounts.map((account: any, index: number) => ({
          id: account.publicKey.toString().slice(-8),
          category: this.extractCategoryFromDetails(account.account.details),
          description: account.account.details,
          status: this.mapGrievanceStatus(account.account.status),
          dateSubmitted: new Date(account.account.timestamp * 1000),
          response: account.account.response || undefined
        } as Grievance));
      }),
      catchError((error: any) => {
        console.error('Failed to load grievances from blockchain:', error);
        return of([]);
      })
    );
  }

  /**
   * Load user's tax payments from blockchain
   */
  private loadTaxPaymentsFromBlockchain(userPublicKey: string): Observable<TaxPayment[]> {
    const program = this.solanaService.getProgram();
    if (!program) {
      return throwError(() => new Error('Anchor program not available'));
    }

    // Fetch all tax payment accounts for this user
    return from(program.account.taxPayment.all([
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: new PublicKey(userPublicKey).toBase58()
        }
      }
    ]) as Promise<any[]>).pipe(
      map((accounts: any[]) => {
        return accounts.map((account: any) => ({
          id: account.publicKey.toString().slice(-8),
          ward: `Ward ${account.account.ward}`,
          year: account.account.year,
          amount: account.account.amount / 1e9, // Convert lamports to SOL
          status: 'Paid' as const,
          datePaid: new Date(account.account.timestamp * 1000),
          transactionId: account.publicKey.toString()
        } as TaxPayment));
      }),
      catchError((error: any) => {
        console.error('Failed to load tax payments from blockchain:', error);
        return of([]);
      })
    );
  }

  /**
   * Load projects from blockchain
   */
  private loadProjectsFromBlockchain(): Observable<Project[]> {
    const program = this.solanaService.getProgram();
    if (!program) {
      return throwError(() => new Error('Anchor program not available'));
    }

    return from(program.account.project.all() as Promise<any[]>).pipe(
      map((accounts: any[]) => {
        return accounts.map((account: any) => ({
          id: account.publicKey.toString().slice(-8),
          name: account.account.name,
          description: account.account.description,
          status: this.mapProjectStatus(account.account.status),
          startDate: new Date(account.account.timestamp * 1000),
          endDate: account.account.endDate ? new Date(account.account.endDate * 1000) : undefined,
          budget: account.account.budget || 0,
          location: this.extractLocationFromDetails(account.account.description),
          ward: `Ward ${account.account.ward || 'All'}`
        } as Project));
      }),
      catchError((error: any) => {
        console.error('Failed to load projects from blockchain:', error);
        return of([]);
      })
    );
  }

  /**
   * Load user's feedback from blockchain
   */
  private loadFeedbackFromBlockchain(userPublicKey: string): Observable<UserFeedback[]> {
    const program = this.solanaService.getProgram();
    if (!program) {
      return throwError(() => new Error('Anchor program not available'));
    }

    // Fetch all feedback accounts for this user
    return from(program.account.feedback.all([
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: new PublicKey(userPublicKey).toBase58()
        }
      }
    ]) as Promise<any[]>).pipe(
      map((accounts: any[]) => {
        return accounts.map((account: any) => ({
          id: account.publicKey.toString().slice(-8),
          projectId: account.account.projectId || 'unknown',
          projectName: account.account.projectName || 'Unknown Project',
          comment: account.account.comment,
          satisfaction: account.account.satisfied ? 5 : 2, // Convert boolean to 1-5 scale
          dateSubmitted: new Date(account.account.timestamp * 1000)
        } as UserFeedback));
      }),
      catchError((error: any) => {
        console.error('Failed to load feedback from blockchain:', error);
        return of([]);
      })
    );
  }

  // Helper methods for mapping blockchain data
  private extractCategoryFromDetails(details: string): string {
    // Simple category extraction - in real app, this might be stored separately
    const categories = ['Roads', 'Sanitation', 'Street Lights', 'Water Supply', 'Electricity', 'Parks'];
    for (const category of categories) {
      if (details.toLowerCase().includes(category.toLowerCase())) {
        return category;
      }
    }
    return 'Other';
  }

  private extractLocationFromDetails(details: string): string {
    // Simple location extraction - in real app, this might be stored separately
    return 'Location from details'; // Placeholder
  }

  private mapGrievanceStatus(status: any): 'Pending' | 'In Progress' | 'Resolved' | 'Rejected' {
    // Map blockchain status to UI status
    switch (status) {
      case 'pending': return 'Pending';
      case 'inProgress': return 'In Progress';
      case 'resolved': return 'Resolved';
      case 'rejected': return 'Rejected';
      default: return 'Pending';
    }
  }

  private mapProjectStatus(status: any): 'Planning' | 'Ongoing' | 'Done' {
    // Map blockchain status to UI status
    switch (status) {
      case 'planning': return 'Planning';
      case 'ongoing': return 'Ongoing';
      case 'completed': return 'Done';
      default: return 'Planning';
    }
  }

  // Grievance methods
  getGrievances(): Observable<Grievance[]> {
    // Load from blockchain if user is connected
    if (this.solanaService.isWalletConnected()) {
      const publicKey = this.solanaService.getPublicKey();
      if (publicKey) {
        return this.loadGrievancesFromBlockchain(publicKey).pipe(
          tap((grievances: Grievance[]) => this.grievancesSubject.next(grievances))
        );
      }
    }
    return this.grievances$;
  }

  submitGrievance(category: string, description: string): Observable<Grievance> {
    const program = this.solanaService.getProgram();
    const provider = this.solanaService.getProvider();
    
    if (!program || !provider) {
      return throwError(() => new Error('Anchor program or provider not available'));
    }

    const publicKey = this.solanaService.getPublicKey();
    if (!publicKey) {
      return throwError(() => new Error('Wallet not connected'));
    }

    const userPublicKey = new PublicKey(publicKey);
    const grievanceKeypair = Keypair.generate();
    
    // Find the state PDA
    const statePDA = PublicKey.findProgramAddressSync(
      [Buffer.from('state')],
      program.programId
    )[0];
    
    console.log('Submitting grievance for user:', userPublicKey.toString());
    console.log('Grievance account:', grievanceKeypair.publicKey.toString());
    
    return from(program.methods
      .fileGrievance(description)
      .accounts({
        grievance: grievanceKeypair.publicKey,
        user: userPublicKey,
        state: statePDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([grievanceKeypair])
      .rpc() as Promise<string>
    ).pipe(
      map((txSignature: string) => {
            const newGrievance: Grievance = {
              id: grievanceKeypair.publicKey.toString().slice(-8),
              category,
              description,
              status: 'Pending',
              dateSubmitted: new Date()
            };
            
            // Update local state
            const currentGrievances = this.grievancesSubject.value;
            this.grievancesSubject.next([newGrievance, ...currentGrievances]);
            
            console.log('Grievance filed successfully. Transaction:', txSignature);
        return newGrievance;
      }),
      catchError((error: any) => {
        console.error('Failed to file grievance:', error);
        return throwError(() => error);
      })
    );
  }

  getCurrentTaxDue(): Observable<{ ward: string; year: number; amount: number }> {
    const program = this.solanaService.getProgram();
    if (!program) {
      return throwError(() => new Error('Anchor program not available'));
    }

    const publicKey = this.solanaService.getPublicKey();
    if (!publicKey) {
      return throwError(() => new Error('Wallet not connected'));
    }

    const currentYear = new Date().getFullYear();
    const ward = 'Ward 1'; // Default ward - in real app, get from user profile
    
    // Extract ward number from ward string (e.g., "Ward 1" -> 1)
    const wardNumber = parseInt(ward.replace('Ward ', '')) || 1;
    
    // Find the ward tax PDA
    const wardTaxPDA = PublicKey.findProgramAddressSync(
      [Buffer.from('ward_tax'), Buffer.from([wardNumber])],
      program.programId
    )[0];
    
    console.log('Getting tax due for ward:', ward, 'year:', currentYear);
    console.log('Ward tax PDA:', wardTaxPDA.toString());
    
    return from(program.account.wardTax.fetch(wardTaxPDA)).pipe(
      map((wardTaxAccount: any) => {
        return {
          ward,
          year: currentYear,
          amount: wardTaxAccount.taxRate || 100 // Default tax amount
        };
      }),
      catchError((error: any) => {
        console.error('Failed to fetch current tax due:', error);
        // Return default values on error
        return of({
          ward: 'Ward 1',
          year: new Date().getFullYear(),
          amount: 0.5
        });
      })
    );
  }

  payTax(ward: string, year: number, amount: number): Observable<TaxPayment> {
    const program = this.solanaService.getProgram();
    const provider = this.solanaService.getProvider();
    
    if (!program || !provider) {
      return throwError(() => new Error('Anchor program or provider not available'));
    }

    const publicKey = this.solanaService.getPublicKey();
    if (!publicKey) {
      return throwError(() => new Error('Wallet not connected'));
    }

    const userPublicKey = new PublicKey(publicKey);
    const taxPaymentKeypair = Keypair.generate();
    const wardNumber = parseInt(ward.replace('Ward ', '')) || 1;
    
    // Generate PDAs
    const wardTaxPDA = PublicKey.findProgramAddressSync(
      [Buffer.from('ward_tax'), Buffer.from([wardNumber])],
      program.programId
    )[0];
    
    const treasuryPDA = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury')],
      program.programId
    )[0];
    
    const statePDA = PublicKey.findProgramAddressSync(
      [Buffer.from('state')],
      program.programId
    )[0];
    
    console.log('Paying tax:', { ward: wardNumber, year, amount });
    console.log('Tax payment account:', taxPaymentKeypair.publicKey.toString());
    
    return from(program.methods
      .payTax(wardNumber, year)
      .accounts({
        taxPayment: taxPaymentKeypair.publicKey,
        wardTax: wardTaxPDA,
        user: userPublicKey,
        treasury: treasuryPDA,
        state: statePDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([taxPaymentKeypair])
      .rpc() as Promise<string>
    ).pipe(
      map((txSignature: string) => {
        const newPayment: TaxPayment = {
          id: taxPaymentKeypair.publicKey.toString().slice(-8),
          ward,
          year,
          amount,
          status: 'Paid',
          datePaid: new Date(),
          transactionId: txSignature
        };
        
        // Update local state
        const currentPayments = this.taxPaymentsSubject.value;
        this.taxPaymentsSubject.next([newPayment, ...currentPayments]);
        
        console.log('Tax paid successfully. Transaction:', txSignature);
        return newPayment;
      }),
      catchError((error: any) => {
        console.error('Failed to pay tax:', error);
        return throwError(() => error);
      })
    );
  }

  getProjectById(id: string): Observable<Project | undefined> {
    const program = this.solanaService.getProgram();
    if (!program) {
      return throwError(() => new Error('Anchor program not available'));
    }

    return from(program.account.project.all() as Promise<any[]>).pipe(
      map((accounts: any[]) => {
        const project = accounts.find(acc => acc.publicKey.toString().slice(-8) === id);
        if (project) {
          return {
            id: project.publicKey.toString().slice(-8),
            name: project.account.name,
            description: project.account.description,
            status: this.mapProjectStatus(project.account.status),
            startDate: new Date(project.account.timestamp * 1000),
            endDate: project.account.endDate ? new Date(project.account.endDate * 1000) : undefined,
            budget: project.account.budget || 0,
            location: this.extractLocationFromDetails(project.account.description),
            ward: `Ward ${project.account.ward || 'All'}`
          } as Project;
        }
        return undefined;
      }),
      catchError((error: any) => {
        console.error('Failed to fetch project by ID:', error);
        return of(undefined);
      })
    );
  }

  // Tax payment methods
  getTaxPayments(): Observable<TaxPayment[]> {
    // Load from blockchain if user is connected
    if (this.solanaService.isWalletConnected()) {
      const publicKey = this.solanaService.getPublicKey();
      if (publicKey) {
        return this.loadTaxPaymentsFromBlockchain(publicKey).pipe(
          tap((payments: TaxPayment[]) => this.taxPaymentsSubject.next(payments))
        );
      }
    }
    return this.taxPayments$;
  }

  // Project methods
  getProjects(): Observable<Project[]> {
    // Load from blockchain
    return this.loadProjectsFromBlockchain().pipe(
      tap((projects: Project[]) => this.projectsSubject.next(projects))
    );
  }

  getCompletedProjects(): Observable<Project[]> {
    return this.getProjects().pipe(
      map((projects: Project[]) => projects.filter((project: Project) => project.status === 'Done'))
    );
  }

  // Feedback methods
  getFeedback(): Observable<UserFeedback[]> {
    // Load from blockchain if user is connected
    if (this.solanaService.isWalletConnected()) {
      const publicKey = this.solanaService.getPublicKey();
      if (publicKey) {
        return this.loadFeedbackFromBlockchain(publicKey).pipe(
          tap((feedback: UserFeedback[]) => this.feedbackSubject.next(feedback))
        );
      }
    }
    return this.feedback$;
  }

  submitFeedback(projectId: string, projectName: string, comment: string, satisfaction: 1 | 2 | 3 | 4 | 5): Observable<UserFeedback> {
    const program = this.solanaService.getProgram();
    const provider = this.solanaService.getProvider();
    
    if (!program || !provider) {
      return throwError(() => new Error('Anchor program or provider not available'));
    }

    const publicKey = this.solanaService.getPublicKey();
    if (!publicKey) {
      return throwError(() => new Error('Wallet not connected'));
    }

    const userPublicKey = new PublicKey(publicKey);
    const feedbackKeypair = Keypair.generate();
    
    // Find project public key from short ID (simplified approach)
    return from(program.account.project.all() as Promise<any[]>).pipe(
      switchMap((accounts: any[]) => {
        const projectAccount = accounts.find(acc => acc.publicKey.toString().slice(-8) === projectId);
        if (!projectAccount) {
          return throwError(() => new Error('Project not found'));
        }
        
        const projectPublicKey = projectAccount.publicKey;
        const satisfied = satisfaction >= 4; // Convert 1-5 scale to boolean
        
        console.log('Submitting feedback for project:', projectPublicKey.toString());
        console.log('Feedback account:', feedbackKeypair.publicKey.toString());
        
        return from(program.methods
          .giveFeedback(comment, satisfied)
          .accounts({
            feedback: feedbackKeypair.publicKey,
            project: projectPublicKey,
            user: userPublicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([feedbackKeypair])
          .rpc() as Promise<string>
        ).pipe(
          map((txSignature: string) => {
                const newFeedback: UserFeedback = {
                  id: feedbackKeypair.publicKey.toString().slice(-8),
                  projectId,
                  projectName,
                  comment,
                  satisfaction,
                  dateSubmitted: new Date()
                };
                
                // Update local state
                const currentFeedback = this.feedbackSubject.value;
                this.feedbackSubject.next([newFeedback, ...currentFeedback]);
                
                console.log('Feedback submitted successfully. Transaction:', txSignature);
            return newFeedback;
          })
        );
      }),
      catchError((error: any) => {
        console.error('Failed to submit feedback:', error);
        return throwError(() => error);
      })
    );
  }

  // Utility methods
  getWards(): string[] {
    return ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'];
  }

  getGrievanceCategories(): string[] {
    return ['Roads', 'Sanitation', 'Street Lights', 'Water Supply', 'Electricity', 'Parks', 'Public Transport', 'Other'];
  }
}
