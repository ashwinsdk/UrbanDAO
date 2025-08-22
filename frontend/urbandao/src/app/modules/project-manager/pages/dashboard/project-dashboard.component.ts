import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CommonModule } from '@angular/common';

interface Project {
  id: number;
  areaId: number;
  title: string;
  description: string;
  manager: string;
  fundingGoal: string;
  escrowed: string;
  released: string;
  status: string;
  milestoneCount: number;
  currentMilestone: number;
  citizenUpvotes: number;
  createdAt: Date;
}

interface ProjectSummary {
  total: number;
  proposed: number;
  funded: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  totalFunding: string;
  totalReleased: string;
  totalEscrowed: string;
}

@Component({
  selector: 'app-project-dashboard',
  templateUrl: './project-dashboard.component.html',
  styleUrls: ['./project-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class ProjectDashboardComponent implements OnInit {
  userAddress: string | null = null;
  projects: Project[] = [];
  recentProjects: Project[] = [];
  parseFloat = parseFloat; // Add parseFloat for use in template
  projectSummary: ProjectSummary = {
    total: 0,
    proposed: 0,
    funded: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    totalFunding: '0',
    totalReleased: '0',
    totalEscrowed: '0'
  };

  loading = true;
  error: string | null = null;

  // Status mapping
  statusMap: { [key: number]: string } = {
    0: 'PROPOSED',
    1: 'FUNDED',
    2: 'IN_PROGRESS',
    3: 'COMPLETED',
    4: 'CANCELLED'
  };

  constructor(
    private contractService: ContractService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.loadProjects();
      }
    });
  }

  async loadProjects(): Promise<void> {
    if (!this.userAddress) return;

    try {
      this.loading = true;
      
      // Get all projects managed by the current user
      const projectIds = await this.contractService.getManagerProjects(this.userAddress);
      
      if (projectIds && projectIds.length > 0) {
        this.projects = await Promise.all(
          projectIds.map(async (id: number) => {
            const project = await this.contractService.getProject(id);
            
            // Assuming the IPFS hashes are stored in hex format
            const title = await this.contractService.getIPFSContent(project.titleHash);
            const description = await this.contractService.getIPFSContent(project.descriptionHash);
            
            return {
              id: project.id,
              areaId: project.areaId,
              title: title || 'Unknown Project',
              description: description || 'No description available',
              manager: project.manager,
              fundingGoal: this.contractService.fromWei(project.fundingGoal),
              escrowed: this.contractService.fromWei(project.escrowed),
              released: this.contractService.fromWei(project.released),
              status: this.statusMap[project.status] || 'UNKNOWN',
              milestoneCount: project.milestoneCount,
              currentMilestone: project.currentMilestone,
              citizenUpvotes: project.citizenUpvotes,
              createdAt: new Date(project.createdAt * 1000)
            };
          })
        );
        
        // Sort by creation date (newest first) for recent projects
        this.recentProjects = [...this.projects]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 5);
        
        // Calculate project summary
        this.calculateProjectSummary();
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading projects:', error);
      this.error = error.message || 'Failed to load projects. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  calculateProjectSummary(): void {
    let proposed = 0;
    let funded = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;
    let totalFunding = 0;
    let totalReleased = 0;
    let totalEscrowed = 0;
    
    this.projects.forEach(project => {
      switch (project.status) {
        case 'PROPOSED':
          proposed++;
          break;
        case 'FUNDED':
          funded++;
          break;
        case 'IN_PROGRESS':
          inProgress++;
          break;
        case 'COMPLETED':
          completed++;
          break;
        case 'CANCELLED':
          cancelled++;
          break;
      }
      
      totalFunding += parseFloat(project.fundingGoal);
      totalReleased += parseFloat(project.released);
      totalEscrowed += parseFloat(project.escrowed);
    });
    
    this.projectSummary = {
      total: this.projects.length,
      proposed,
      funded,
      inProgress,
      completed,
      cancelled,
      totalFunding: totalFunding.toFixed(4),
      totalReleased: totalReleased.toFixed(4),
      totalEscrowed: totalEscrowed.toFixed(4)
    };
  }

  navigateToProjectDetails(projectId: number): void {
    this.router.navigate(['/project-manager/project', projectId]);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PROPOSED':
        return 'proposed';
      case 'FUNDED':
        return 'funded';
      case 'IN_PROGRESS':
        return 'in-progress';
      case 'COMPLETED':
        return 'completed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return '';
    }
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
  
  refreshDashboard(): void {
    this.loadProjects();
  }
}
