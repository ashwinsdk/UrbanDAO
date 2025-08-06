import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { 
  BlockchainService, 
  Grievance, 
  TaxPayment, 
  Project,
  Feedback,
  WardTax,
  GrievanceStatus,
  ProjectStatus
} from '../shared/services/blockchain.service';

// Re-export blockchain types for compatibility
export type { Grievance, TaxPayment, Project, Feedback, WardTax, GrievanceStatus, ProjectStatus };

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private grievancesSubject = new BehaviorSubject<Grievance[]>([]);
  private taxPaymentsSubject = new BehaviorSubject<TaxPayment[]>([]);
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  private feedbackSubject = new BehaviorSubject<Feedback[]>([]);
  private wardTaxesSubject = new BehaviorSubject<WardTax[]>([]);

  grievances$ = this.grievancesSubject.asObservable();
  taxPayments$ = this.taxPaymentsSubject.asObservable();
  projects$ = this.projectsSubject.asObservable();
  feedback$ = this.feedbackSubject.asObservable();
  wardTaxes$ = this.wardTaxesSubject.asObservable();

  constructor(private blockchainService: BlockchainService) {
    this.loadData();
  }

  private loadData(): void {
    // Load all data from blockchain service
    this.blockchainService.getGrievances().subscribe(grievances => {
      this.grievancesSubject.next(grievances);
    });

    this.blockchainService.getTaxPayments().subscribe(taxPayments => {
      this.taxPaymentsSubject.next(taxPayments);
    });

    this.blockchainService.getProjects().subscribe(projects => {
      this.projectsSubject.next(projects);
    });

    this.blockchainService.getFeedback().subscribe(feedback => {
      this.feedbackSubject.next(feedback);
    });

    this.blockchainService.getWardTaxes().subscribe(wardTaxes => {
      this.wardTaxesSubject.next(wardTaxes);
    });
  }

  // Grievance operations
  getGrievances(): Observable<Grievance[]> {
    return this.grievances$;
  }

  fileGrievance(category: string, description: string): Observable<string> {
    return this.blockchainService.fileGrievance('user', description).pipe(
      tap(() => this.loadData()), // Reload data after successful operation
      catchError(error => {
        console.error('Error filing grievance:', error);
        throw error;
      })
    );
  }

  getGrievancesByUser(user: string): Observable<Grievance[]> {
    return this.grievances$.pipe(
      map(grievances => grievances.filter(g => g.user === user))
    );
  }

  // Tax operations
  getTaxPayments(): Observable<TaxPayment[]> {
    return this.taxPayments$;
  }

  getTaxPaymentsByUser(user: string): Observable<TaxPayment[]> {
    return this.taxPayments$.pipe(
      map(payments => payments.filter(p => p.user === user))
    );
  }

  payTax(ward: number, year: number): Observable<string> {
    return this.blockchainService.payTax('user', ward, year).pipe(
      tap(() => this.loadData()),
      catchError(error => {
        console.error('Error paying tax:', error);
        throw error;
      })
    );
  }

  getWardTaxes(): Observable<WardTax[]> {
    return this.wardTaxes$;
  }

  getWardTax(ward: number): Observable<WardTax | null> {
    return this.wardTaxes$.pipe(
      map(wardTaxes => wardTaxes.find(wt => wt.ward === ward) || null)
    );
  }

  // Project operations
  getProjects(): Observable<Project[]> {
    return this.projects$;
  }

  getProjectsByWard(ward: number): Observable<Project[]> {
    return this.projects$.pipe(
      map(projects => projects.filter(p => p.ward === ward))
    );
  }

  getProjectById(id: string): Observable<Project | null> {
    return this.projects$.pipe(
      map(projects => projects.find(p => p.id === id) || null)
    );
  }

  // Feedback operations
  getFeedback(): Observable<Feedback[]> {
    return this.feedback$;
  }

  getFeedbackByProject(projectId: string): Observable<Feedback[]> {
    return this.feedback$.pipe(
      map(feedback => feedback.filter(f => f.projectId === projectId))
    );
  }

  submitFeedback(projectId: string, comment: string, satisfied: boolean): Observable<string> {
    return this.blockchainService.giveFeedback('user', projectId, comment, satisfied).pipe(
      tap(() => this.loadData()),
      catchError(error => {
        console.error('Error submitting feedback:', error);
        throw error;
      })
    );
  }

  // Utility methods
  refreshData(): void {
    this.loadData();
  }

  // Statistics and summary methods
  getUserGrievanceStats(user: string): Observable<{pending: number, inProgress: number, resolved: number, rejected: number}> {
    return this.getGrievancesByUser(user).pipe(
      map(grievances => {
        const stats = {
          pending: 0,
          inProgress: 0,
          resolved: 0,
          rejected: 0
        };
        
        grievances.forEach(g => {
          switch(g.status) {
            case GrievanceStatus.Pending:
              stats.pending++;
              break;
            case GrievanceStatus.Accepted:
              stats.inProgress++;
              break;
            case GrievanceStatus.Done:
              stats.resolved++;
              break;
            case GrievanceStatus.Rejected:
              stats.rejected++;
              break;
          }
        });
        
        return stats;
      })
    );
  }

  getUserTaxSummary(user: string): Observable<{totalPaid: number, paymentCount: number}> {
    return this.getTaxPaymentsByUser(user).pipe(
      map(payments => ({
        totalPaid: payments.reduce((sum, p) => sum + p.amount, 0),
        paymentCount: payments.length
      }))
    );
  }

  // Additional methods for component compatibility
  getGrievanceCategories(): string[] {
    return ['Infrastructure', 'Sanitation', 'Water Supply', 'Electricity', 'Roads', 'Healthcare', 'Education', 'Safety', 'Environment', 'Other'];
  }

  getWards(): string[] {
    return Array.from({length: 20}, (_, i) => (i + 1).toString()); // Wards 1-20 as strings
  }

  submitGrievance(category: string, description: string, contactInfo?: string): Observable<string> {
    return this.fileGrievance(category, description);
  }

  getCurrentTaxDue(): Observable<{ward: string, year: number, amount: number, dueDate: Date}> {
    // Mock tax due information - in real app, this would calculate based on user's ward and payment history
    return of({
      ward: '1', // Default ward as string
      year: new Date().getFullYear(),
      amount: 1000, // 1000 SOL
      dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)) // Next month
    });
  }
}
