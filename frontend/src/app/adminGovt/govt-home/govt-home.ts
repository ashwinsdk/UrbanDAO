import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService } from '../../user/user.service';
import { TaxPayment, Project, GrievanceStatus } from '../../shared/services/blockchain.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-govt-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './govt-home.html',
  styleUrl: './govt-home.css'
})
export class GovtHome implements OnInit {
  // Dashboard data
  totalTaxCollected: number = 0;
  configuredWards: string[] = [];
  adminHeadStatus: boolean = true; // Assuming admin head is assigned by default
  
  // Project stats
  totalProjects: number = 0;
  ongoingProjects: number = 0;
  completedProjects: number = 0;
  
  // Grievance stats
  totalGrievances: number = 0;
  pendingGrievances: number = 0;
  resolvedGrievances: number = 0;
  
  // Loading state
  isLoading: boolean = true;
  
  // Connected wallet
  walletAddress: string | null = null;
  
  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    this.loadDashboardData();
    this.walletAddress = this.authService.getPublicKey();
  }
  
  loadDashboardData(): void {
    this.isLoading = true;
    
    // Get configured wards
    this.configuredWards = this.userService.getWards();
    
    // Calculate total tax collected
    this.userService.getTaxPayments().subscribe(payments => {
      this.totalTaxCollected = payments
        .filter(payment => payment.status === 'Paid')
        .reduce((total, payment) => total + payment.amount, 0);
    });
    
    // Get project statistics
    this.userService.getProjects().subscribe(projects => {
      this.totalProjects = projects.length;
      this.ongoingProjects = projects.filter(p => p.status === 'Ongoing').length;
      this.completedProjects = projects.filter(p => p.status === 'Done').length;
    });
    
    // Get grievance statistics
    this.userService.getGrievances().subscribe(grievances => {
      this.totalGrievances = grievances.length;
      this.pendingGrievances = grievances.filter(g => g.status === GrievanceStatus.Pending).length;
      this.resolvedGrievances = grievances.filter(g => g.status === GrievanceStatus.Resolved).length;
      
      this.isLoading = false;
    });
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  // Format currency
  formatCurrency(amount: number): string {
    return amount.toFixed(2) + ' SOL';
  }
}
