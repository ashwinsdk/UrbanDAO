import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-citizen-dashboard',
  templateUrl: './citizen-dashboard.component.html',
  styleUrls: ['./citizen-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class CitizenDashboardComponent implements OnInit {
  userAddress: string | null = null;
  userName: string = 'Citizen';
  
  // Dashboard statistics
  grievanceStats = {
    total: 0,
    pending: 0,
    resolved: 0
  };
  
  taxStats = {
    due: 0,
    paid: 0,
    nextDueDate: ''
  };
  
  localProjects = {
    total: 0,
    ongoing: 0,
    completed: 0
  };
  
  loading = {
    grievances: true,
    taxes: true,
    projects: true
  };
  
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
        // In a real app, we would fetch the user's name from a profile service
        // For now, we'll just use "Citizen"
      }
    });
    
    this.fetchGrievanceStats();
    this.fetchTaxStats();
    this.fetchProjectStats();
  }
  
  async fetchGrievanceStats(): Promise<void> {
    try {
      if (this.userAddress) {
        // Call contract to get grievance stats
        const grievances = await this.contractService.getUserGrievances(this.userAddress);
        
        if (grievances) {
          this.grievanceStats.total = grievances.length;
          this.grievanceStats.pending = grievances.filter((g: any) => !g.isResolved).length;
          this.grievanceStats.resolved = grievances.filter((g: any) => g.isResolved).length;
        }
      }
    } catch (error) {
      console.error('Error fetching grievance stats:', error);
    } finally {
      this.loading.grievances = false;
    }
  }
  
  async fetchTaxStats(): Promise<void> {
    try {
      if (this.userAddress) {
        // Call contract to get tax stats
        const assessments = await this.contractService.getUserTaxAssessments(this.userAddress);
        
        if (assessments) {
          this.taxStats.due = assessments.filter((a: any) => !a.isPaid).reduce((acc: number, curr: any) => acc + curr.amount, 0);
          this.taxStats.paid = assessments.filter((a: any) => a.isPaid).reduce((acc: number, curr: any) => acc + curr.amount, 0);
          
          // Find next due date
          const unpaidAssessments = assessments.filter((a: any) => !a.isPaid);
          if (unpaidAssessments.length > 0) {
            const nextDueDate = new Date(Math.min(...unpaidAssessments.map((a: any) => a.dueDate.getTime())));
            this.taxStats.nextDueDate = nextDueDate.toLocaleDateString();
          }
        }
      }
    } catch (error) {
      console.error('Error fetching tax stats:', error);
    } finally {
      this.loading.taxes = false;
    }
  }
  
  async fetchProjectStats(): Promise<void> {
    try {
      if (this.userAddress) {
        // Call contract to get project stats for user's area
        const projects = await this.contractService.getLocalProjects(this.userAddress);
        
        if (projects) {
          this.localProjects.total = projects.length;
          this.localProjects.ongoing = projects.filter((p: any) => !p.isCompleted).length;
          this.localProjects.completed = projects.filter((p: any) => p.isCompleted).length;
        }
      }
    } catch (error) {
      console.error('Error fetching project stats:', error);
    } finally {
      this.loading.projects = false;
    }
  }
  
  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
