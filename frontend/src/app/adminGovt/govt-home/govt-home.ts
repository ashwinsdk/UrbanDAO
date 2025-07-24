import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService, TaxPayment, Project } from '../../user/user.service';
import { AdminGovtService, GovtDashboardStats, SolanaService } from '../../shared/services';
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
  dashboardStats: GovtDashboardStats | null = null;
  
  // Loading state
  isLoading: boolean = true;
  errorMessage: string = '';
  
  // Connected wallet
  walletAddress: string | null = null;

  // Getter properties for template access
  get pendingGrievances(): number {
    return this.dashboardStats?.pendingGrievances || 0;
  }

  get ongoingProjects(): number {
    return this.dashboardStats?.ongoingProjects || 0;
  }

  get totalTaxCollected(): number {
    return this.dashboardStats?.totalTaxCollected || 0;
  }

  get totalProjects(): number {
    return this.dashboardStats?.totalProjects || 0;
  }

  get completedProjects(): number {
    return this.dashboardStats?.completedProjects || 0;
  }

  get totalGrievances(): number {
    return this.dashboardStats?.totalGrievances || 0;
  }

  get resolvedGrievances(): number {
    return this.dashboardStats?.resolvedGrievances || 0;
  }

  get configuredWards(): string[] {
    return this.dashboardStats?.configuredWards || [];
  }

  get adminHeadStatus(): boolean {
    return this.dashboardStats?.adminHeadStatus || false;
  }
  
  constructor(
    private userService: UserService,
    private adminGovtService: AdminGovtService,
    private solanaService: SolanaService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Check wallet connection first
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to access government admin functions.';
      this.isLoading = false;
      return;
    }

    // Get wallet address from SolanaService (primary) or AuthService (fallback)
    this.walletAddress = this.solanaService.getPublicKey() || this.authService.getPublicKey();
    
    this.loadDashboardData();
  }
  
  loadDashboardData(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Load dashboard statistics from blockchain
    this.adminGovtService.getDashboardStats().subscribe({
      next: (stats) => {
        this.dashboardStats = stats;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
    });
  }

  // Format currency for template display
  formatCurrency(amount: number): string {
    return amount.toFixed(2) + ' SOL';
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to access government admin functions.';
      }
      if (error.message.includes('Unauthorized')) {
        return 'You are not authorized to perform this action.';
      }
      if (error.message.includes('User rejected')) {
        return 'Transaction was rejected. Please try again.';
      }
      return `Error: ${error.message}`;
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
