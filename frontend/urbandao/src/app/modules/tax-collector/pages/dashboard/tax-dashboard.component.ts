import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface TaxStats {
  totalAssessments: number;
  pendingPayments: number;
  completedPayments: number;
  collectionRate: number;
  totalCollected: string; // In ETH or tokens
}

interface RecentTaxPayment {
  id: string;
  citizenAddress: string;
  citizenName?: string;
  amount: string; // In ETH or tokens
  paidOn: Date;
  year: number;
  quarter: number;
}

@Component({
  selector: 'app-tax-dashboard',
  templateUrl: './tax-dashboard.component.html',
  styleUrls: ['./tax-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class TaxDashboardComponent implements OnInit {
  userAddress: string | null = null;
  userName: string | null = null;
  
  taxStats: TaxStats = {
    totalAssessments: 0,
    pendingPayments: 0,
    completedPayments: 0,
    collectionRate: 0,
    totalCollected: '0'
  };
  
  recentPayments: RecentTaxPayment[] = [];
  pendingAssessments: any[] = [];
  
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
        this.userName = this.formatAddress(user.address);
        this.loadDashboardData();
      }
    });
  }

  async loadDashboardData(): Promise<void> {
    if (!this.userAddress) return;
    
    try {
      this.loading = true;
      
      // Get tax stats
      const stats = await this.contractService.getTaxCollectionStats();
      if (stats) {
        this.taxStats = {
          totalAssessments: stats.totalAssessments,
          pendingPayments: stats.pendingPayments,
          completedPayments: stats.completedPayments,
          collectionRate: stats.collectionRate,
          totalCollected: stats.totalCollected
        };
      }
      
      // Get recent tax payments
      const recentPayments = await this.contractService.getRecentTaxPayments(5);
      if (recentPayments) {
        this.recentPayments = recentPayments.map((p: any) => ({
          id: p.id,
          citizenAddress: p.citizenAddress,
          citizenName: p.citizenName,
          amount: p.amount,
          paidOn: new Date(p.paidOn * 1000),
          year: p.year,
          quarter: p.quarter
        }));
      }
      
      // Get pending assessments
      const pendingAssessments = await this.contractService.getPendingTaxAssessments(5);
      if (pendingAssessments) {
        this.pendingAssessments = pendingAssessments.map((a: any) => ({
          id: a.id,
          citizenAddress: a.citizenAddress,
          citizenName: a.citizenName,
          amount: a.amount,
          dueDate: new Date(a.dueDate * 1000),
          year: a.year,
          quarter: a.quarter,
          propertyId: a.propertyId
        }));
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading tax collector dashboard data:', error);
      this.error = error.message || 'Failed to load dashboard data. Please try again.';
    } finally {
      this.loading = false;
    }
  }
  
  navigateToAssessment(): void {
    this.router.navigate(['/tax-collector/assessment']);
  }
  
  navigateToPayments(): void {
    this.router.navigate(['/tax-collector/payments']);
  }
  
  navigateToTaxpayerDetails(address: string): void {
    this.router.navigate(['/tax-collector/taxpayer', address]);
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
