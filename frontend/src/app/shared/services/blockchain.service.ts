import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, tap, map, switchMap } from 'rxjs/operators';

// UrbanDAO types for frontend integration
export interface UrbanDAOState {
  adminGovt: string;
  adminHead: string;
  currentTaxYear: number;
  treasuryBump?: number; // PDA bump seed
  stateBump?: number; // PDA bump seed
}

export interface WardTax {
  ward: number;
  amount: number; // in SOL
}

export interface TaxPayment {
  id: string;
  user: string;
  ward: number;
  year: number;
  amount: number;
  timestamp: number;
  datePaid: Date; // Added for frontend template compatibility
  status: 'Paid' | 'Pending' | 'Failed'; // Added for frontend template compatibility
  transactionId?: string;
}

export interface Grievance {
  id: string;
  user: string;
  details: string; // Contract field name
  status: GrievanceStatus;
  timestamp: number;
  // Frontend compatibility fields
  category?: string;
  description?: string; // Alias for details
  dateSubmitted?: Date;
  response?: string;
  transactionId?: string;
}

export interface Project {
  id: string;
  name: string;
  details: string; // Contract field name
  status: ProjectStatus;
  // Frontend compatibility fields
  description?: string; // Alias for details
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  location?: string;
  ward?: number;
  createdBy?: string;
  timestamp?: number;
  transactionId?: string;
}

export interface Feedback {
  id: string;
  user: string;
  projectId: string;
  comment: string;
  satisfied: boolean;
  timestamp: number;
  transactionId?: string;
}

export enum GrievanceStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
  Done = 'Done'
}

export enum ProjectStatus {
  Planning = 'Planning',
  Ongoing = 'Ongoing',
  Done = 'Done'
}

// Mock storage keys
const MOCK_STATE_KEY = 'urbandao_state';
const MOCK_WARD_TAXES_KEY = 'urbandao_ward_taxes';
const MOCK_TAX_PAYMENTS_KEY = 'urbandao_tax_payments';
const MOCK_GRIEVANCES_KEY = 'urbandao_grievances';
const MOCK_PROJECTS_KEY = 'urbandao_projects';
const MOCK_FEEDBACK_KEY = 'urbandao_feedback';

// Default admin addresses
const DEFAULT_ADMIN_GOVT = 'FVTUBAwwMY3mpzNmR8QEncdi5HCR3fawxL38svymmnps';
const DEFAULT_ADMIN_HEAD = 'C4ZsZRzr6kCqVXPzGhDXsUaoFuBR1cnFXkwSksCH5xSk';

@Injectable({
  providedIn: 'root'
})
export class BlockchainService {
  
  // Service state
  private _loading = new BehaviorSubject<boolean>(false);
  private _error = new BehaviorSubject<string | null>(null);

  public loading$ = this._loading.asObservable();
  public error$ = this._error.asObservable();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Initialize state if not exists
    if (!localStorage.getItem(MOCK_STATE_KEY)) {
      const initialState: UrbanDAOState = {
        adminGovt: DEFAULT_ADMIN_GOVT,
        adminHead: DEFAULT_ADMIN_HEAD,
        currentTaxYear: 2024
      };
      localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(initialState));
    }

    // Initialize ward taxes if not exists
    if (!localStorage.getItem(MOCK_WARD_TAXES_KEY)) {
      const initialWardTaxes: WardTax[] = [
        { ward: 1, amount: 0.1 },
        { ward: 2, amount: 0.15 },
        { ward: 3, amount: 0.12 },
        { ward: 4, amount: 0.08 },
        { ward: 5, amount: 0.2 }
      ];
      localStorage.setItem(MOCK_WARD_TAXES_KEY, JSON.stringify(initialWardTaxes));
    }

    // Initialize empty arrays for other data if not exists
    if (!localStorage.getItem(MOCK_TAX_PAYMENTS_KEY)) {
      localStorage.setItem(MOCK_TAX_PAYMENTS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(MOCK_GRIEVANCES_KEY)) {
      localStorage.setItem(MOCK_GRIEVANCES_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(MOCK_PROJECTS_KEY)) {
      localStorage.setItem(MOCK_PROJECTS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(MOCK_FEEDBACK_KEY)) {
      localStorage.setItem(MOCK_FEEDBACK_KEY, JSON.stringify([]));
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateTransactionId(): string {
    return 'tx_' + Math.random().toString(36).substr(2, 16);
  }

  private simulateBlockchainDelay(): Observable<any> {
    return of(null).pipe(delay(1000 + Math.random() * 2000)); // 1-3 second delay
  }

  // State operations
  getState(): Observable<UrbanDAOState> {
    return of(JSON.parse(localStorage.getItem(MOCK_STATE_KEY) || '{}'));
  }

  assignAdminHead(newAdminHead: string): Observable<string> {
    this._loading.next(true);
    this._error.next(null);

    return this.simulateBlockchainDelay().pipe(
      tap(() => {
        const state: UrbanDAOState = JSON.parse(localStorage.getItem(MOCK_STATE_KEY) || '{}');
        state.adminHead = newAdminHead;
        localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state));
      }),
      tap(() => this._loading.next(false)),
      map(() => this.generateTransactionId())
    );
  }

  // Ward tax operations
  getWardTaxes(): Observable<WardTax[]> {
    return of(JSON.parse(localStorage.getItem(MOCK_WARD_TAXES_KEY) || '[]'));
  }

  getWardTax(ward: number): Observable<WardTax | null> {
    const wardTaxes: WardTax[] = JSON.parse(localStorage.getItem(MOCK_WARD_TAXES_KEY) || '[]');
    const wardTax = wardTaxes.find(w => w.ward === ward);
    return of(wardTax || null);
  }

  setWardTax(ward: number, amount: number): Observable<string> {
    this._loading.next(true);
    this._error.next(null);

    return this.simulateBlockchainDelay().pipe(
      tap(() => {
        const wardTaxes: WardTax[] = JSON.parse(localStorage.getItem(MOCK_WARD_TAXES_KEY) || '[]');
        const existingIndex = wardTaxes.findIndex(w => w.ward === ward);
        
        if (existingIndex >= 0) {
          wardTaxes[existingIndex].amount = amount;
        } else {
          wardTaxes.push({ ward, amount });
        }
        
        localStorage.setItem(MOCK_WARD_TAXES_KEY, JSON.stringify(wardTaxes));
      }),
      tap(() => this._loading.next(false)),
      map(() => this.generateTransactionId())
    );
  }

  // Tax payment operations
  getTaxPayments(user?: string): Observable<TaxPayment[]> {
    const payments: TaxPayment[] = JSON.parse(localStorage.getItem(MOCK_TAX_PAYMENTS_KEY) || '[]');
    if (user) {
      return of(payments.filter(p => p.user === user));
    }
    return of(payments);
  }

  getTaxPayment(user: string, ward: number, year: number): Observable<TaxPayment | null> {
    const payments: TaxPayment[] = JSON.parse(localStorage.getItem(MOCK_TAX_PAYMENTS_KEY) || '[]');
    const payment = payments.find(p => p.user === user && p.ward === ward && p.year === year);
    return of(payment || null);
  }

  payTax(user: string, ward: number, year: number): Observable<string> {
    this._loading.next(true);
    this._error.next(null);

    return this.getWardTax(ward).pipe(
      switchMap(wardTax => {
        if (!wardTax) {
          this._loading.next(false);
          this._error.next('Ward tax not set');
          return throwError(() => new Error('Ward tax not set'));
        }

        return this.simulateBlockchainDelay().pipe(
          tap(() => {
            const payments: TaxPayment[] = JSON.parse(localStorage.getItem(MOCK_TAX_PAYMENTS_KEY) || '[]');
            
            // Check if already paid
            const existingPayment = payments.find(p => p.user === user && p.ward === ward && p.year === year);
            if (existingPayment) {
              throw new Error('Tax already paid for this ward and year');
            }

            const newPayment: TaxPayment = {
              id: this.generateId(),
              user,
              ward,
              year,
              amount: wardTax.amount,
              timestamp: Date.now(),
              datePaid: new Date(),
              status: 'Paid',
              transactionId: this.generateTransactionId()
            };

            payments.push(newPayment);
            localStorage.setItem(MOCK_TAX_PAYMENTS_KEY, JSON.stringify(payments));
          }),
          tap(() => this._loading.next(false)),
          map(() => this.generateTransactionId())
        );
      })
    );
  }

  // Grievance operations
  getGrievances(user?: string): Observable<Grievance[]> {
    const grievances: Grievance[] = JSON.parse(localStorage.getItem(MOCK_GRIEVANCES_KEY) || '[]');
    if (user) {
      return of(grievances.filter(g => g.user === user));
    }
    return of(grievances.sort((a, b) => b.timestamp - a.timestamp));
  }

  fileGrievance(user: string, description: string): Observable<string> {
    this._loading.next(true);
    this._error.next(null);

    return this.simulateBlockchainDelay().pipe(
      tap(() => {
        const grievances: Grievance[] = JSON.parse(localStorage.getItem(MOCK_GRIEVANCES_KEY) || '[]');
        
        const newGrievance: Grievance = {
          id: this.generateId(),
          user,
          details: description, // Contract field name
          status: GrievanceStatus.Pending,
          timestamp: Date.now(),
          // Frontend compatibility fields
          category: 'General',
          description,
          dateSubmitted: new Date(),
          transactionId: this.generateTransactionId()
        };

        grievances.push(newGrievance);
        localStorage.setItem(MOCK_GRIEVANCES_KEY, JSON.stringify(grievances));
      }),
      tap(() => this._loading.next(false)),
      map(() => this.generateTransactionId())
    );
  }

  updateGrievanceStatus(grievanceId: string, newStatus: GrievanceStatus): Observable<string> {
    this._loading.next(true);
    this._error.next(null);

    return this.simulateBlockchainDelay().pipe(
      tap(() => {
        const grievances: Grievance[] = JSON.parse(localStorage.getItem(MOCK_GRIEVANCES_KEY) || '[]');
        const grievanceIndex = grievances.findIndex(g => g.id === grievanceId);
        
        if (grievanceIndex === -1) {
          throw new Error('Grievance not found');
        }

        grievances[grievanceIndex].status = newStatus;
        localStorage.setItem(MOCK_GRIEVANCES_KEY, JSON.stringify(grievances));
      }),
      tap(() => this._loading.next(false)),
      map(() => this.generateTransactionId())
    );
  }

  // Project operations
  getProjects(): Observable<Project[]> {
    const projects: Project[] = JSON.parse(localStorage.getItem(MOCK_PROJECTS_KEY) || '[]');
    return of(projects.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
  }

  createProject(name: string, description: string, budget: number, ward: number): Observable<string> {
    this._loading.next(true);
    this._error.next(null);

    return this.simulateBlockchainDelay().pipe(
      tap(() => {
        const projects: Project[] = JSON.parse(localStorage.getItem(MOCK_PROJECTS_KEY) || '[]');
        
        const newProject: Project = {
          id: this.generateId(),
          name,
          details: description, // Contract field name
          status: ProjectStatus.Planning,
          // Frontend compatibility fields
          description,
          startDate: new Date(),
          endDate: undefined,
          budget,
          location: 'TBD',
          ward,
          createdBy: 'admin',
          timestamp: Date.now(),
          transactionId: this.generateTransactionId()
        };

        projects.push(newProject);
        localStorage.setItem(MOCK_PROJECTS_KEY, JSON.stringify(projects));
      }),
      tap(() => this._loading.next(false)),
      map(() => this.generateTransactionId())
    );
  }

  updateProjectStatus(projectId: string, newStatus: ProjectStatus): Observable<string> {
    this._loading.next(true);
    this._error.next(null);

    return this.simulateBlockchainDelay().pipe(
      tap(() => {
        const projects: Project[] = JSON.parse(localStorage.getItem(MOCK_PROJECTS_KEY) || '[]');
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
          throw new Error('Project not found');
        }

        projects[projectIndex].status = newStatus;
        localStorage.setItem(MOCK_PROJECTS_KEY, JSON.stringify(projects));
      }),
      tap(() => this._loading.next(false)),
      map(() => this.generateTransactionId())
    );
  }

  // Feedback operations
  getFeedback(projectId?: string): Observable<Feedback[]> {
    const feedback: Feedback[] = JSON.parse(localStorage.getItem(MOCK_FEEDBACK_KEY) || '[]');
    if (projectId) {
      return of(feedback.filter(f => f.projectId === projectId));
    }
    return of(feedback.sort((a, b) => b.timestamp - a.timestamp));
  }

  giveFeedback(user: string, projectId: string, comment: string, satisfied: boolean): Observable<string> {
    this._loading.next(true);
    this._error.next(null);

    return this.simulateBlockchainDelay().pipe(
      tap(() => {
        const feedback: Feedback[] = JSON.parse(localStorage.getItem(MOCK_FEEDBACK_KEY) || '[]');
        
        // Check if user already gave feedback for this project
        const existingFeedback = feedback.find(f => f.user === user && f.projectId === projectId);
        if (existingFeedback) {
          throw new Error('Feedback already provided for this project');
        }

        const newFeedback: Feedback = {
          id: this.generateId(),
          user,
          projectId,
          comment,
          satisfied,
          timestamp: Date.now(),
          transactionId: this.generateTransactionId()
        };

        feedback.push(newFeedback);
        localStorage.setItem(MOCK_FEEDBACK_KEY, JSON.stringify(feedback));
      }),
      tap(() => this._loading.next(false)),
      map(() => this.generateTransactionId())
    );
  }

  // Utility methods
  clearAllData(): void {
    localStorage.removeItem(MOCK_STATE_KEY);
    localStorage.removeItem(MOCK_WARD_TAXES_KEY);
    localStorage.removeItem(MOCK_TAX_PAYMENTS_KEY);
    localStorage.removeItem(MOCK_GRIEVANCES_KEY);
    localStorage.removeItem(MOCK_PROJECTS_KEY);
    localStorage.removeItem(MOCK_FEEDBACK_KEY);
    this.initializeMockData();
  }

  getTransactionFee(): number {
    return 0.001; // 0.001 SOL transaction fee
  }

  // Admin Government methods (from smart contract)
  initializeState(adminGovt: string): Observable<string> {
    this._loading.next(true);
    this._error.next(null);

    return this.simulateBlockchainDelay().pipe(
      tap(() => {
        const state: UrbanDAOState = {
          adminGovt,
          adminHead: '',
          currentTaxYear: new Date().getFullYear(),
          treasuryBump: 254,
          stateBump: 255
        };
        localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state));
        this.initializeMockData(); // Reinitialize with new admin
      }),
      tap(() => this._loading.next(false)),
      map(() => this.generateTransactionId())
    );
  }


}
