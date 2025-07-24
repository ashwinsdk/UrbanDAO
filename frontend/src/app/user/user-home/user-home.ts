import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService, Grievance, TaxPayment, Project } from '../user.service';
import { AuthService } from '../../auth/auth.service';
import { SolanaService } from '../../shared/services';

@Component({
  selector: 'app-user-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-home.html',
  styleUrl: './user-home.css'
})
export class UserHome implements OnInit {
  publicKey: string | null = null;
  userName: string = 'Citizen';
  isLoading = true;
  errorMessage = '';
  
  // Dashboard data
  recentGrievances: Grievance[] = [];
  taxDue: { ward: string; year: number; amount: number } | null = null;
  ongoingProjects: Project[] = [];
  
  constructor(
    private userService: UserService,
    private authService: AuthService,
    private solanaService: SolanaService
  ) {}
  
  ngOnInit(): void {
    // Check wallet connection using SolanaService (primary) with AuthService fallback
    const isConnected = this.solanaService.isWalletConnected();
    
    if (isConnected) {
      this.publicKey = this.solanaService.getPublicKey();
      if (this.publicKey) {
        this.userName = `Citizen ${this.publicKey.substring(0, 4)}...${this.publicKey.substring(this.publicKey.length - 4)}`;
      }
      this.loadDashboardData();
    } else {
      // Fallback to AuthService
      this.authService.publicKey$.subscribe(key => {
        this.publicKey = key;
        if (key) {
          this.userName = `Citizen ${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
          this.loadDashboardData();
        } else {
          this.isLoading = false;
          this.errorMessage = 'Please connect your wallet to view dashboard data.';
        }
      });
    }
  }
  
  loadDashboardData(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Get recent grievances
    this.userService.getGrievances().subscribe({
      next: (grievances) => {
        this.recentGrievances = grievances.slice(0, 3);
      },
      error: (error) => {
        console.error('Failed to load grievances:', error);
        this.recentGrievances = [];
      }
    });
    
    // Get current tax due
    this.userService.getCurrentTaxDue().subscribe({
      next: (taxDue) => {
        this.taxDue = taxDue;
      },
      error: (error) => {
        console.error('Failed to load tax due:', error);
        this.taxDue = null;
      }
    });
    
    // Get ongoing projects
    this.userService.getProjects().subscribe({
      next: (projects) => {
        this.ongoingProjects = projects.filter(p => p.status === 'Ongoing').slice(0, 2);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load projects:', error);
        this.ongoingProjects = [];
        this.isLoading = false;
        if (!this.recentGrievances.length && !this.taxDue) {
          this.errorMessage = 'Failed to load dashboard data. Please try again.';
        }
      }
    });
  }
  
  // Helper method to get status class for badges
  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Pending': 'badge-pending',
      'In Progress': 'badge-in-progress',
      'Resolved': 'badge-resolved',
      'Rejected': 'badge-rejected',
      'Ongoing': 'badge-in-progress',
      'Planning': 'badge-pending',
      'Done': 'badge-resolved'
    };
    
    return statusMap[status] || 'badge-pending';
  }
}
