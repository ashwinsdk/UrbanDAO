import { Injectable } from '@angular/core';
import { Observable, from, throwError, BehaviorSubject } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { SolanaService } from './solana.service';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';

export interface AdminGrievance {
  id: string;
  user: string;
  category: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Rejected';
  dateSubmitted: Date;
  response?: string;
}

export interface AdminProject {
  id: string;
  name: string;
  description: string;
  status: 'Planning' | 'Ongoing' | 'Done';
  startDate: Date;
  endDate?: Date;
  budget: number;
  location: string;
  ward: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private grievancesSubject = new BehaviorSubject<AdminGrievance[]>([]);
  private projectsSubject = new BehaviorSubject<AdminProject[]>([]);

  public grievances$ = this.grievancesSubject.asObservable();
  public projects$ = this.projectsSubject.asObservable();

  constructor(private solanaService: SolanaService) {
    this.initializeService();
  }

  private initializeService(): void {
    // Initialize with empty arrays - data will be loaded from blockchain when needed
    this.grievancesSubject.next([]);
    this.projectsSubject.next([]);
  }

  /**
   * Load all grievances from blockchain (Admin view)
   */
  getAllGrievances(): Observable<AdminGrievance[]> {
    const program = this.solanaService.getProgram();
    if (!program) {
      return throwError(() => new Error('Anchor program not available'));
    }

    return from(program.account.grievance.all() as Promise<any[]>).pipe(
      map((accounts: any[]) => {
        return accounts.map((account) => ({
          id: account.publicKey.toString().slice(-8),
          user: account.account.user.toString(),
          category: this.extractCategoryFromDetails(account.account.details),
          description: account.account.details,
          status: this.mapGrievanceStatus(account.account.status),
          dateSubmitted: new Date(account.account.timestamp * 1000),
          response: account.account.response || undefined
        } as AdminGrievance));
      }),
      tap(grievances => this.grievancesSubject.next(grievances)),
      catchError(error => {
        console.error('Failed to load grievances from blockchain:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update grievance status (Admin only)
   */
  updateGrievanceStatus(
    grievanceId: string, 
    newStatus: 'Pending' | 'In Progress' | 'Resolved' | 'Rejected',
    response?: string
  ): Observable<boolean> {
    const program = this.solanaService.getProgram();
    const provider = this.solanaService.getProvider();
    
    if (!program || !provider) {
      return throwError(() => new Error('Anchor program or provider not available'));
    }

    const publicKey = this.solanaService.getPublicKey();
    if (!publicKey) {
      return throwError(() => new Error('Wallet not connected'));
    }

    return from(import('@solana/web3.js')).pipe(
      switchMap(({ PublicKey }) => {
        const adminHeadPublicKey = new PublicKey(publicKey);
        
        // Find grievance public key from short ID (simplified approach)
        return from(program.account.grievance.all() as Promise<any[]>).pipe(
          switchMap((accounts: any[]) => {
            const grievanceAccount = accounts.find(acc => acc.publicKey.toString().slice(-8) === grievanceId);
            if (!grievanceAccount) {
              return throwError(() => new Error('Grievance not found'));
            }
            
            const grievancePublicKey = grievanceAccount.publicKey;
            
            // Generate state PDA
            const statePDA = PublicKey.findProgramAddressSync(
              [Buffer.from('state')],
              program.programId
            )[0];
            
            // Map UI status to blockchain status
            const blockchainStatus = this.mapStatusToBlockchain(newStatus);
            
            console.log('Updating grievance status:', { grievanceId, newStatus, blockchainStatus });
            console.log('Grievance account:', grievancePublicKey.toString());
            
            return from(program.methods
              .updateGrievanceStatus(blockchainStatus)
              .accounts({
                grievance: grievancePublicKey,
                adminHead: adminHeadPublicKey,
                state: statePDA,
              })
              .rpc() as Promise<string>
            ).pipe(
              map((txSignature: string) => {
                console.log('Grievance status updated successfully. Transaction:', txSignature);
                
                // Update local state
                const currentGrievances = this.grievancesSubject.value;
                const updatedGrievances = currentGrievances.map(g => 
                  g.id === grievanceId 
                    ? { ...g, status: newStatus, response: response || g.response }
                    : g
                );
                this.grievancesSubject.next(updatedGrievances);
                
                return true;
              })
            );
          })
        );
      }),
      catchError(error => {
        console.error('Failed to update grievance status:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Load all projects from blockchain (Admin view)
   */
  getAllProjects(): Observable<AdminProject[]> {
    const program = this.solanaService.getProgram();
    if (!program) {
      return throwError(() => new Error('Anchor program not available'));
    }

    return from(program.account.project.all() as Promise<any[]>).pipe(
      map((accounts: any[]) => {
        return accounts.map((account) => ({
          id: account.publicKey.toString().slice(-8),
          name: account.account.name,
          description: account.account.details,
          status: this.mapProjectStatus(account.account.status),
          startDate: new Date(account.account.timestamp * 1000),
          endDate: account.account.endTimestamp ? new Date(account.account.endTimestamp * 1000) : undefined,
          budget: account.account.budget || 0,
          location: this.extractLocationFromDetails(account.account.details),
          ward: `Ward ${account.account.ward || 'All'}`,
          timestamp: new Date(account.account.timestamp * 1000)
        } as AdminProject));
      }),
      tap(projects => this.projectsSubject.next(projects)),
      catchError(error => {
        console.error('Failed to load projects from blockchain:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create new project (Admin only)
   */
  createProject(
    name: string,
    description: string,
    budget: number,
    location: string,
    ward: string
  ): Observable<AdminProject> {
    const program = this.solanaService.getProgram();
    const provider = this.solanaService.getProvider();
    
    if (!program || !provider) {
      return throwError(() => new Error('Anchor program or provider not available'));
    }

    const publicKey = this.solanaService.getPublicKey();
    if (!publicKey) {
      return throwError(() => new Error('Wallet not connected'));
    }

    return from(import('@solana/web3.js')).pipe(
      switchMap(({ PublicKey, Keypair, SystemProgram }) => {
        const adminHeadPublicKey = new PublicKey(publicKey);
        const projectKeypair = Keypair.generate();
        const details = `${description} | Location: ${location} | Ward: ${ward}`;
        
        // Generate state PDA
        const statePDA = PublicKey.findProgramAddressSync(
          [Buffer.from('state')],
          program.programId
        )[0];
        
        console.log('Creating project:', { name, details, budget });
        console.log('Project account:', projectKeypair.publicKey.toString());
        
        return from(program.methods
          .createProject(name, details, budget)
          .accounts({
            project: projectKeypair.publicKey,
            adminHead: adminHeadPublicKey,
            state: statePDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([projectKeypair])
          .rpc() as Promise<string>
        ).pipe(
          map((txSignature: string) => {
            const newProject: AdminProject = {
              id: projectKeypair.publicKey.toString().slice(-8),
              name,
              description,
              status: 'Planning',
              startDate: new Date(),
              budget,
              location,
              ward,
              timestamp: new Date()
            };
            
            // Update local state
            const currentProjects = this.projectsSubject.value;
            this.projectsSubject.next([newProject, ...currentProjects]);
            
            console.log('Project created successfully. Transaction:', txSignature);
            return newProject;
          })
        );
      }),
      catchError(error => {
        console.error('Failed to create project:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get dashboard statistics
   */
  getDashboardStats(): Observable<{
    totalGrievances: number;
    pendingGrievances: number;
    totalProjects: number;
    ongoingProjects: number;
  }> {
    return from(Promise.all([
      this.getAllGrievances().toPromise(),
      this.getAllProjects().toPromise()
    ])).pipe(
      map(([grievances, projects]) => ({
        totalGrievances: grievances?.length || 0,
        pendingGrievances: grievances?.filter(g => g.status === 'Pending').length || 0,
        totalProjects: projects?.length || 0,
        ongoingProjects: projects?.filter(p => p.status === 'Ongoing').length || 0
      })),
      catchError(error => {
        console.error('Failed to load dashboard stats:', error);
        return throwError(() => error);
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
    const locationMatch = details.match(/Location:\s*([^|]+)/);
    return locationMatch ? locationMatch[1].trim() : 'Location from details';
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

  private mapStatusToBlockchain(status: 'Pending' | 'In Progress' | 'Resolved' | 'Rejected'): any {
    // Map UI status to blockchain status
    switch (status) {
      case 'Pending': return { pending: {} };
      case 'In Progress': return { inProgress: {} };
      case 'Resolved': return { resolved: {} };
      case 'Rejected': return { rejected: {} };
      default: return { pending: {} };
    }
  }
}
