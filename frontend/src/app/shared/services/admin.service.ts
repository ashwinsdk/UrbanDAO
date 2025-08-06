import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { 
  BlockchainService, 
  Grievance, 
  TaxPayment, 
  Project,
  Feedback,
  WardTax,
  UrbanDAOState,
  GrievanceStatus,
  ProjectStatus
} from './blockchain.service';
import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/user-role.enum';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private dataRefreshSubject = new BehaviorSubject<void>(undefined);

  constructor(
    private blockchainService: BlockchainService,
    private authService: AuthService
  ) {}

  // State and initialization (Admin Government only)
  initializeState(adminGovt: string): Observable<string> {
    return this.blockchainService.initializeState(adminGovt).pipe(
      tap(() => this.refreshData()),
      catchError(error => {
        console.error('Error initializing state:', error);
        throw error;
      })
    );
  }

  assignAdminHead(adminHead: string): Observable<string> {
    return this.blockchainService.assignAdminHead(adminHead).pipe(
      tap(() => this.refreshData()),
      catchError(error => {
        console.error('Error assigning admin head:', error);
        throw error;
      })
    );
  }

  getState(): Observable<UrbanDAOState> {
    return this.blockchainService.getState();
  }

  // Ward tax management (Admin Government only)
  setWardTax(ward: number, amount: number): Observable<string> {
    return this.blockchainService.setWardTax(ward, amount).pipe(
      tap(() => this.refreshData()),
      catchError(error => {
        console.error('Error setting ward tax:', error);
        throw error;
      })
    );
  }

  getWardTaxes(): Observable<WardTax[]> {
    return this.blockchainService.getWardTaxes();
  }

  updateWardTax(ward: number, amount: number): Observable<string> {
    return this.setWardTax(ward, amount); // Same operation as setting
  }

  // Project management (Admin Head operations)
  createProject(
    name: string, 
    description: string, 
    budget: number, 
    ward: number
  ): Observable<string> {
    return this.blockchainService.createProject(name, description, budget, ward).pipe(
      tap(() => this.refreshData()),
      catchError(error => {
        console.error('Error creating project:', error);
        throw error;
      })
    );
  }

  updateProjectStatus(projectId: string, status: ProjectStatus): Observable<string> {
    return this.blockchainService.updateProjectStatus(projectId, status).pipe(
      tap(() => this.refreshData()),
      catchError(error => {
        console.error('Error updating project status:', error);
        throw error;
      })
    );
  }

  getAllProjects(): Observable<Project[]> {
    return this.blockchainService.getProjects();
  }

  getProjectsByStatus(status: ProjectStatus): Observable<Project[]> {
    return this.getAllProjects().pipe(
      map(projects => projects.filter(p => p.status === status))
    );
  }

  getProjectsByWard(ward: number): Observable<Project[]> {
    return this.getAllProjects().pipe(
      map(projects => projects.filter(p => p.ward === ward))
    );
  }

  // Grievance management (Admin Head operations)
  getAllGrievances(): Observable<Grievance[]> {
    return this.blockchainService.getGrievances();
  }

  getGrievancesByStatus(status: GrievanceStatus): Observable<Grievance[]> {
    return this.getAllGrievances().pipe(
      map(grievances => grievances.filter(g => g.status === status))
    );
  }

  getPendingGrievances(): Observable<Grievance[]> {
    return this.getGrievancesByStatus(GrievanceStatus.Pending);
  }

  getInProgressGrievances(): Observable<Grievance[]> {
    return this.getGrievancesByStatus(GrievanceStatus.Resolved);
  }

  updateGrievanceStatus(grievanceId: string, status: GrievanceStatus): Observable<string> {
    return this.blockchainService.updateGrievanceStatus(grievanceId, status).pipe(
      tap(() => this.refreshData()),
      catchError(error => {
        console.error('Error updating grievance status:', error);
        throw error;
      })
    );
  }

  // Tax payment monitoring
  getAllTaxPayments(): Observable<TaxPayment[]> {
    return this.blockchainService.getTaxPayments();
  }

  getTaxPaymentsByWard(ward: number): Observable<TaxPayment[]> {
    return this.getAllTaxPayments().pipe(
      map(payments => payments.filter(p => p.ward === ward))
    );
  }

  getTaxPaymentsByYear(year: number): Observable<TaxPayment[]> {
    return this.getAllTaxPayments().pipe(
      map(payments => payments.filter(p => p.year === year))
    );
  }

  // Feedback monitoring
  getAllFeedback(): Observable<Feedback[]> {
    return this.blockchainService.getFeedback();
  }

  getFeedbackByProject(projectId: string): Observable<Feedback[]> {
    return this.getAllFeedback().pipe(
      map(feedback => feedback.filter(f => f.projectId === projectId))
    );
  }

  // Analytics and reporting
  getGrievanceStats(): Observable<{
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    rejected: number;
  }> {
    return this.getAllGrievances().pipe(
      map(grievances => {
        const stats = {
          total: grievances.length,
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
            case GrievanceStatus.InProgress:
              stats.inProgress++;
              break;
            case GrievanceStatus.Resolved:
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

  getProjectStats(): Observable<{
    total: number;
    planning: number;
    ongoing: number;
    completed: number;
  }> {
    return this.getAllProjects().pipe(
      map(projects => {
        const stats = {
          total: projects.length,
          planning: 0,
          ongoing: 0,
          completed: 0
        };

        projects.forEach(p => {
          switch(p.status) {
            case ProjectStatus.Planning:
              stats.planning++;
              break;
            case ProjectStatus.Ongoing:
              stats.ongoing++;
              break;
            case ProjectStatus.Done:
              stats.completed++;
              break;
          }
        });

        return stats;
      })
    );
  }

  getTaxCollectionStats(): Observable<{
    totalCollected: number;
    totalPayments: number;
    wardBreakdown: Array<{ward: number; amount: number; count: number}>;
  }> {
    return this.getAllTaxPayments().pipe(
      map(payments => {
        const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalPayments = payments.length;
        
        const wardMap = new Map<number, {amount: number; count: number}>();
        payments.forEach(p => {
          if (wardMap.has(p.ward)) {
            wardMap.get(p.ward)!.amount += p.amount;
            wardMap.get(p.ward)!.count++;
          } else {
            wardMap.set(p.ward, {amount: p.amount, count: 1});
          }
        });

        const wardBreakdown = Array.from(wardMap.entries()).map(([ward, data]) => ({
          ward,
          amount: data.amount,
          count: data.count
        }));

        return {
          totalCollected,
          totalPayments,
          wardBreakdown
        };
      })
    );
  }

  // Utility methods
  isAdminGovt(): boolean {
    return this.authService.getCurrentRole() === UserRole.AdminGovt;
  }

  isAdminHead(): boolean {
    return this.authService.getCurrentRole() === UserRole.AdminHead;
  }

  hasAdminAccess(): boolean {
    const role = this.authService.getCurrentRole();
    return role === UserRole.AdminGovt || role === UserRole.AdminHead;
  }

  refreshData(): void {
    this.dataRefreshSubject.next();
  }

  getDataRefresh(): Observable<void> {
    return this.dataRefreshSubject.asObservable();
  }
}
