import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

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

  constructor(private authService: AuthService) {
    // Load mock data
    this.loadMockData();
  }

  private loadMockData(): void {
    // Mock grievances
    const mockGrievances: Grievance[] = [
      {
        id: 'G001',
        category: 'Roads',
        description: 'Large pothole on Main Street near the library',
        status: 'In Progress',
        dateSubmitted: new Date(2025, 5, 15)
      },
      {
        id: 'G002',
        category: 'Sanitation',
        description: 'Overflowing garbage bins in Central Park',
        status: 'Resolved',
        dateSubmitted: new Date(2025, 5, 10),
        response: 'Bins have been emptied and schedule increased to twice weekly.'
      },
      {
        id: 'G003',
        category: 'Street Lights',
        description: 'Street light not working on Oak Avenue',
        status: 'Pending',
        dateSubmitted: new Date(2025, 6, 22)
      }
    ];

    // Mock tax payments
    const mockTaxPayments: TaxPayment[] = [
      {
        id: 'T001',
        ward: 'Ward 1',
        year: 2024,
        amount: 0.5,
        status: 'Paid',
        datePaid: new Date(2025, 2, 15),
        transactionId: '0x1234567890abcdef'
      },
      {
        id: 'T002',
        ward: 'Ward 1',
        year: 2023,
        amount: 0.45,
        status: 'Paid',
        datePaid: new Date(2024, 3, 10),
        transactionId: '0xabcdef1234567890'
      }
    ];

    // Mock projects
    const mockProjects: Project[] = [
      {
        id: 'P001',
        name: 'Central Park Renovation',
        description: 'Renovation of Central Park including new playground equipment and improved pathways',
        status: 'Ongoing',
        startDate: new Date(2025, 4, 1),
        budget: 50000,
        location: 'Central Park',
        ward: 'Ward 1'
      },
      {
        id: 'P002',
        name: 'Main Street Repaving',
        description: 'Repaving of Main Street from 1st Avenue to 10th Avenue',
        status: 'Planning',
        startDate: new Date(2025, 7, 1),
        budget: 75000,
        location: 'Main Street',
        ward: 'Ward 2'
      },
      {
        id: 'P003',
        name: 'LED Street Light Installation',
        description: 'Replacement of old street lights with energy-efficient LED lights',
        status: 'Done',
        startDate: new Date(2025, 1, 15),
        endDate: new Date(2025, 3, 30),
        budget: 30000,
        location: 'Citywide',
        ward: 'All'
      }
    ];

    // Mock feedback
    const mockFeedback: UserFeedback[] = [
      {
        id: 'F001',
        projectId: 'P003',
        projectName: 'LED Street Light Installation',
        comment: 'The new lights are much brighter and make the streets feel safer at night.',
        satisfaction: 5,
        dateSubmitted: new Date(2025, 4, 5)
      }
    ];

    this.grievancesSubject.next(mockGrievances);
    this.taxPaymentsSubject.next(mockTaxPayments);
    this.projectsSubject.next(mockProjects);
    this.feedbackSubject.next(mockFeedback);
  }

  // Grievance methods
  getGrievances(): Observable<Grievance[]> {
    return this.grievances$;
  }

  submitGrievance(category: string, description: string): Observable<Grievance> {
    const newGrievance: Grievance = {
      id: `G${Math.floor(Math.random() * 10000).toString().padStart(3, '0')}`,
      category,
      description,
      status: 'Pending',
      dateSubmitted: new Date()
    };

    const currentGrievances = this.grievancesSubject.value;
    this.grievancesSubject.next([newGrievance, ...currentGrievances]);

    return of(newGrievance);
  }

  // Tax payment methods
  getTaxPayments(): Observable<TaxPayment[]> {
    return this.taxPayments$;
  }

  getCurrentTaxDue(): Observable<{ ward: string; year: number; amount: number }> {
    // In a real app, this would fetch from blockchain
    return of({
      ward: 'Ward 1',
      year: 2025,
      amount: 0.55
    });
  }

  payTax(ward: string, year: number, amount: number): Observable<TaxPayment> {
    const newPayment: TaxPayment = {
      id: `T${Math.floor(Math.random() * 10000).toString().padStart(3, '0')}`,
      ward,
      year,
      amount,
      status: 'Paid',
      datePaid: new Date(),
      transactionId: `0x${Math.random().toString(16).substring(2, 34)}`
    };

    const currentPayments = this.taxPaymentsSubject.value;
    this.taxPaymentsSubject.next([newPayment, ...currentPayments]);

    return of(newPayment);
  }

  // Project methods
  getProjects(): Observable<Project[]> {
    return this.projects$;
  }

  getProjectById(id: string): Observable<Project | undefined> {
    return of(this.projectsSubject.value.find(project => project.id === id));
  }

  getCompletedProjects(): Observable<Project[]> {
    return of(this.projectsSubject.value.filter(project => project.status === 'Done'));
  }

  // Feedback methods
  getFeedback(): Observable<UserFeedback[]> {
    return this.feedback$;
  }

  submitFeedback(projectId: string, projectName: string, comment: string, satisfaction: 1 | 2 | 3 | 4 | 5): Observable<UserFeedback> {
    const newFeedback: UserFeedback = {
      id: `F${Math.floor(Math.random() * 10000).toString().padStart(3, '0')}`,
      projectId,
      projectName,
      comment,
      satisfaction,
      dateSubmitted: new Date()
    };

    const currentFeedback = this.feedbackSubject.value;
    this.feedbackSubject.next([newFeedback, ...currentFeedback]);

    return of(newFeedback);
  }

  // Utility methods
  getWards(): string[] {
    return ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'];
  }

  getGrievanceCategories(): string[] {
    return ['Roads', 'Sanitation', 'Street Lights', 'Water Supply', 'Electricity', 'Parks', 'Public Transport', 'Other'];
  }
}
