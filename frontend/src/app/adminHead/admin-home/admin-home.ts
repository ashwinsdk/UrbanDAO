import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService, Grievance, Project } from '../../user/user.service';
import { AdminService, AdminGrievance, AdminProject } from '../../shared/services';
import { SolanaService } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-home.html',
  styleUrl: './admin-home.css'
})
export class AdminHome implements OnInit {
  // Dashboard data
  pendingGrievances: AdminGrievance[] = [];
  ongoingProjects: AdminProject[] = [];
  plannedProjects: AdminProject[] = [];
  completedProjects: AdminProject[] = [];
  
  // Stats
  totalGrievances = 0;
  totalProjects = 0;
  pendingGrievancesCount = 0;
  ongoingProjectsCount = 0;
  
  // Loading state
  isLoading = true;
  errorMessage = '';
  
  // Connected wallet
  walletAddress: string | null = null;
  
  constructor(
    private userService: UserService,
    private adminService: AdminService,
    private solanaService: SolanaService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Check wallet connection first
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to access admin dashboard.';
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
    
    // Load dashboard statistics and data from blockchain
    this.adminService.getDashboardStats().subscribe({
      next: (stats) => {
        this.totalGrievances = stats.totalGrievances;
        this.totalProjects = stats.totalProjects;
        this.pendingGrievancesCount = stats.pendingGrievances;
        this.ongoingProjectsCount = stats.ongoingProjects;
        
        // Load detailed data
        this.loadDetailedData();
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
    });
  }

  private loadDetailedData(): void {
    // Load recent grievances from blockchain
    this.adminService.getAllGrievances().subscribe({
      next: (grievances) => {
        this.pendingGrievances = grievances
          .filter(g => g.status === 'Pending')
          .sort((a, b) => b.dateSubmitted.getTime() - a.dateSubmitted.getTime())
          .slice(0, 5);
        
        // Load projects after grievances
        this.loadProjects();
      },
      error: (error) => {
        console.error('Error loading grievances:', error);
        this.errorMessage = 'Failed to load grievances data.';
        this.isLoading = false;
      }
    });
  }

  private loadProjects(): void {
    // Load projects from blockchain
    this.adminService.getAllProjects().subscribe({
      next: (projects) => {
        // Sort projects by timestamp (newest first)
        const sortedProjects = projects.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        this.ongoingProjects = sortedProjects.filter(p => p.status === 'Ongoing').slice(0, 3);
        this.plannedProjects = sortedProjects.filter(p => p.status === 'Planning').slice(0, 3);
        this.completedProjects = sortedProjects.filter(p => p.status === 'Done').slice(0, 3);
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading projects:', error);
        this.errorMessage = 'Failed to load projects data.';
        this.isLoading = false;
      }
    });
  }

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to access admin dashboard.';
      }
      if (error.message.includes('Unauthorized')) {
        return 'You are not authorized to access admin functions.';
      }
      return `Error: ${error.message}`;
    }
    return 'An unexpected error occurred while loading dashboard data.';
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  // Format date for display
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Get CSS class for status badge
  getStatusClass(status: string): string {
    switch (status) {
      case 'Pending': return 'status-pending';
      case 'In Progress': return 'status-progress';
      case 'Resolved': return 'status-success';
      case 'Rejected': return 'status-error';
      case 'Planning': return 'status-planning';
      case 'Ongoing': return 'status-ongoing';
      case 'Done': return 'status-done';
      default: return 'status-default';
    }
  }
}
