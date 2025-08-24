import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
  remainingFunds: string;
}

interface Milestone {
  projectId: number;
  milestoneNumber: number;
  proofHash: string;
  amount: string;
  completed: boolean;
  completedAt: Date | null;
  submittedBy: string;
  proofContent: string;
}

@Component({
  selector: 'app-project-details',
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class ProjectDetailsComponent implements OnInit {
  projectId: number | null = null;
  project: Project | null = null;
  milestones: Milestone[] = [];
  userAddress: string | null = null;
  
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
    private route: ActivatedRoute,
    private router: Router,
    private contractService: ContractService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.projectId = +params['id'];
      
      this.authService.user$.subscribe(user => {
        if (user) {
          this.userAddress = user.address;
          this.loadProjectDetails();
        }
      });
    });
  }

  async loadProjectDetails(): Promise<void> {
    if (!this.projectId || !this.userAddress) return;

    try {
      this.loading = true;
      
      // Get project details
      const projectData = await this.contractService.getProject(this.projectId);
      
      // Check if this user is the manager of the project
      if (projectData.manager.toLowerCase() !== this.userAddress.toLowerCase()) {
        this.error = "You don't have permission to view this project.";
        this.loading = false;
        return;
      }
      
      // Fetch IPFS content
      const title = await this.contractService.getIPFSContent(projectData.titleHash);
      const description = await this.contractService.getIPFSContent(projectData.descriptionHash);
      
      // Get remaining funds
      const remainingFunds = await this.contractService.getRemainingFunds(this.projectId);
      
      this.project = {
        id: projectData.id,
        areaId: projectData.areaId,
        title: title || 'Unknown Project',
        description: description || 'No description available',
        manager: projectData.manager,
        fundingGoal: this.contractService.fromWei(projectData.fundingGoal),
        escrowed: this.contractService.fromWei(projectData.escrowed),
        released: this.contractService.fromWei(projectData.released),
        status: this.statusMap[projectData.status] || 'UNKNOWN',
        milestoneCount: projectData.milestoneCount,
        currentMilestone: projectData.currentMilestone,
        citizenUpvotes: projectData.citizenUpvotes,
        createdAt: new Date(projectData.createdAt * 1000),
        remainingFunds: this.contractService.fromWei(remainingFunds)
      };
      
      // Load milestone data if any exist
      if (projectData.milestoneCount > 0) {
        await this.loadMilestones();
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading project details:', error);
      this.error = error.message || 'Failed to load project details. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async loadMilestones(): Promise<void> {
    if (!this.projectId || !this.project) return;

    try {
      this.milestones = [];
      
      // Load all milestone data
      for (let i = 1; i < this.project.currentMilestone; i++) {
        try {
          const milestone = await this.contractService.getMilestone(this.projectId, i);
          
          // Skip if milestone doesn't exist or is not completed
          if (!milestone || !milestone.completed) continue;
          
          // Fetch IPFS proof content
          const proofContent = await this.contractService.getIPFSContent(milestone.proofHash);
          
          this.milestones.push({
            projectId: milestone.projectId,
            milestoneNumber: milestone.milestoneNumber,
            proofHash: milestone.proofHash,
            amount: this.contractService.fromWei(milestone.amount),
            completed: milestone.completed,
            completedAt: milestone.completedAt ? new Date(milestone.completedAt * 1000) : null,
            submittedBy: milestone.submittedBy,
            proofContent: proofContent || 'No proof content available'
          });
        } catch (err) {
          console.warn(`Error loading milestone ${i}:`, err);
        }
      }
    } catch (error: any) {
      console.error('Error loading milestones:', error);
    }
  }

  getStatusClass(): string {
    if (!this.project) return '';
    
    switch (this.project.status) {
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
  
  canSubmitMilestone(): boolean {
    if (!this.project) return false;
    return this.project.status === 'FUNDED' || this.project.status === 'IN_PROGRESS';
  }
  
  calculateProgress(): number {
    if (!this.project) return 0;
    if (this.project.milestoneCount === 0) return 0;
    return ((this.project.currentMilestone - 1) / this.project.milestoneCount) * 100;
  }
  
  formatAddress(address: string | undefined): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  formatDate(date: Date | null | undefined): string {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  goToMilestoneForm(): void {
    this.router.navigate(['/project-manager/project', this.projectId, 'milestone']);
  }
  
  goBack(): void {
    this.router.navigate(['/project-manager/projects']);
  }
  
  refreshDetails(): void {
    this.loadProjectDetails();
  }
}
