import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService, Grievance, TaxPayment, Project } from '../user.service';
import { AuthService } from '../../auth/auth.service';

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
  
  // Dashboard data
  recentGrievances: Grievance[] = [];
  taxDue: { ward: string; year: number; amount: number } | null = null;
  ongoingProjects: Project[] = [];
  
  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Get wallet public key
    this.authService.publicKey$.subscribe(key => {
      this.publicKey = key;
      if (key) {
        // In a real app, we would fetch the user's name from the blockchain
        this.userName = `Citizen ${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
      }
    });
    
    // Load dashboard data
    this.loadDashboardData();
  }
  
  loadDashboardData(): void {
    // Get recent grievances
    this.userService.getGrievances().subscribe(grievances => {
      this.recentGrievances = grievances.slice(0, 3);
    });
    
    // Get current tax due
    this.userService.getCurrentTaxDue().subscribe(taxDue => {
      this.taxDue = taxDue;
    });
    
    // Get ongoing projects
    this.userService.getProjects().subscribe(projects => {
      this.ongoingProjects = projects.filter(p => p.status === 'Ongoing').slice(0, 2);
      this.isLoading = false;
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
