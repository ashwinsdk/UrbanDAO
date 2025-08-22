import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface Grievance {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'validated' | 'assigned' | 'resolved' | 'rejected';
  createdAt: Date;
  lastUpdated: Date;
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  images?: string[];
}

@Component({
  selector: 'app-grievances',
  templateUrl: './grievances.component.html',
  styleUrls: ['./grievances.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class GrievancesComponent implements OnInit {
  grievances: Grievance[] = [];
  loading = true;
  error: string | null = null;
  userAddress: string | null = null;
  
  // Filters
  statusFilter: string = 'all';
  sortBy: string = 'date-desc';
  
  constructor(
    private contractService: ContractService,
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.fetchGrievances();
      }
    });
  }
  
  async fetchGrievances(): Promise<void> {
    if (!this.userAddress) return;
    
    this.loading = true;
    this.error = null;
    
    try {
      // Call contract to get user grievances
      const grievances = await this.contractService.getUserGrievances(this.userAddress);
      
      if (grievances) {
        this.grievances = grievances.map((g: any) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          status: this.mapContractStatusToUI(g.status),
          createdAt: new Date(g.timestamp * 1000),
          lastUpdated: new Date(g.lastUpdated * 1000),
          assignedTo: g.assignedTo,
          resolvedBy: g.resolvedBy,
          resolvedAt: g.resolvedAt ? new Date(g.resolvedAt * 1000) : undefined,
          images: g.images
        }));
      }
    } catch (error: any) {
      console.error('Error fetching grievances:', error);
      this.error = error.message || 'Failed to fetch grievances. Please try again later.';
    } finally {
      this.loading = false;
    }
  }
  
  // Helper method to map contract status values to UI-friendly status
  private mapContractStatusToUI(status: number): 'pending' | 'validated' | 'assigned' | 'resolved' | 'rejected' {
    const statusMap: {[key: number]: 'pending' | 'validated' | 'assigned' | 'resolved' | 'rejected'} = {
      0: 'pending',
      1: 'validated',
      2: 'assigned',
      3: 'resolved',
      4: 'rejected'
    };
    return statusMap[status] || 'pending';
  }
  
  // Filter methods
  applyFilters(): void {
    this.fetchGrievances().then(() => {
      // Apply status filter
      if (this.statusFilter !== 'all') {
        this.grievances = this.grievances.filter(g => g.status === this.statusFilter);
      }
      
      // Apply sort
      this.applySorting();
    });
  }
  
  applySorting(): void {
    switch (this.sortBy) {
      case 'date-desc':
        this.grievances.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'date-asc':
        this.grievances.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'status':
        this.grievances.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case 'updated':
        this.grievances.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
        break;
    }
  }
  
  // Navigation methods
  viewGrievance(id: string): void {
    this.router.navigate([`/citizen/grievances/${id}`]);
  }
  
  createNewGrievance(): void {
    this.router.navigate(['/citizen/grievances/new']);
  }
  
  // Status helpers
  getStatusClass(status: string): string {
    const statusClasses: {[key: string]: string} = {
      'pending': 'status-pending',
      'validated': 'status-validated',
      'assigned': 'status-assigned',
      'resolved': 'status-resolved',
      'rejected': 'status-rejected'
    };
    return statusClasses[status] || '';
  }
  
  getStatusLabel(status: string): string {
    const statusLabels: {[key: string]: string} = {
      'pending': 'Pending',
      'validated': 'Validated',
      'assigned': 'In Progress',
      'resolved': 'Resolved',
      'rejected': 'Rejected'
    };
    return statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }
  
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  refreshGrievances(): void {
    this.fetchGrievances();
  }
}
