import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface GrievanceStats {
  pending: number;
  validated: number;
  rejected: number;
  totalProcessed: number;
}

@Component({
  selector: 'app-validator-dashboard',
  templateUrl: './validator-dashboard.component.html',
  styleUrls: ['./validator-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class ValidatorDashboardComponent implements OnInit {
  userAddress: string | null = null;
  userName: string | null = null;
  
  grievanceStats: GrievanceStats = {
    pending: 0,
    validated: 0,
    rejected: 0,
    totalProcessed: 0
  };
  
  recentGrievances: any[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private contractService: ContractService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        // User interface doesn't have name property, using just the address
        this.userName = this.formatAddress(user.address);
        this.loadDashboardData();
      }
    });
  }

  async loadDashboardData(): Promise<void> {
    if (!this.userAddress) return;
    
    try {
      this.loading = true;
      
      // Get grievance stats for validator
      const stats = await this.contractService.getValidatorGrievanceStats(this.userAddress);
      if (stats) {
        this.grievanceStats = {
          pending: stats.pending,
          validated: stats.validated,
          rejected: stats.rejected,
          totalProcessed: stats.validated + stats.rejected
        };
      }
      
      // Get recent grievances awaiting validation
      const recentPending = await this.contractService.getPendingGrievances(5);
      if (recentPending) {
        this.recentGrievances = recentPending.map(g => ({
          id: g.id,
          title: g.title,
          location: g.location,
          createdAt: new Date(g.createdAt * 1000),
          type: g.type
        }));
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading validator dashboard data:', error);
      this.error = error.message || 'Failed to load dashboard data. Please try again.';
    } finally {
      this.loading = false;
    }
  }
  
  navigateToGrievanceReview(grievanceId: string): void {
    this.router.navigate(['/validator/grievances/review', grievanceId]);
  }
  
  navigateToPendingGrievances(): void {
    this.router.navigate(['/validator/grievances/pending']);
  }
  
  navigateToProcessedGrievances(): void {
    this.router.navigate(['/validator/grievances/processed']);
  }
  
  navigateToCitizenVerification(): void {
    this.router.navigate(['/validator/citizen-verification']);
  }
  
  refreshDashboard(): void {
    this.loadDashboardData();
  }
  
  formatAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
