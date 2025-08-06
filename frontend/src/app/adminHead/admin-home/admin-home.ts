import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService, Grievance, Project } from '../../user/user.service';
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
  pendingGrievances: Grievance[] = [];
  ongoingProjects: Project[] = [];
  plannedProjects: Project[] = [];
  completedProjects: Project[] = [];
  
  // Stats
  totalGrievances = 0;
  totalProjects = 0;
  
  // Loading state
  isLoading = true;
  
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
    
    // Load grievances
    this.userService.getGrievances().subscribe(grievances => {
      this.totalGrievances = grievances.length;
      this.pendingGrievances = grievances.filter(g => g.status === 'Pending').slice(0, 5);
    });
    
    // Load projects
    this.userService.getProjects().subscribe(projects => {
      this.totalProjects = projects.length;
      this.ongoingProjects = projects.filter(p => p.status === 'Ongoing').slice(0, 3);
      this.plannedProjects = projects.filter(p => p.status === 'Planning').slice(0, 3);
      this.completedProjects = projects.filter(p => p.status === 'Done').slice(0, 3);
      this.isLoading = false;
    });
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  // Format date for display
  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
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
