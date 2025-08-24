import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface Project {
  id: string;
  title: string;
  description: string;
  budget: number;
  funds: number;
  manager: string;
  status: string;
  startDate?: Date;
  endDate?: Date;
  location: string;
  category: string;
  milestones: Milestone[];
  upvotes: number;
  hasUserUpvoted: boolean;
}

interface Milestone {
  id: number;
  title: string;
  description: string;
  amount: number;
  completed: boolean;
  completedDate?: Date;
  proofDocuments?: string[];
}

@Component({
  selector: 'app-citizen-projects',
  templateUrl: './citizen-projects.component.html',
  styleUrls: ['./citizen-projects.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class CitizenProjectsComponent implements OnInit {
  userAddress: string | null = null;
  
  projects: Project[] = [];
  loading = true;
  error: string | null = null;
  
  // Selected project for detail view
  selectedProject: Project | null = null;
  
  // Filters
  filterStatus: string = 'all';
  filterCategory: string = 'all';
  
  // Upvoting
  isUpvoting = false;
  upvoteError: string | null = null;
  
  constructor(
    private contractService: ContractService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.fetchProjects();
      }
    });
  }
  
  async fetchProjects(): Promise<void> {
    this.loading = true;
    this.error = null;
    
    try {
      // Call contract to get projects in user's area
      const projects = await this.contractService.getLocalProjects(this.userAddress);
      
      if (projects) {
        this.projects = projects.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          budget: p.budget,
          funds: p.funds,
          manager: p.manager,
          status: p.status,
          startDate: p.startDate ? new Date(p.startDate * 1000) : undefined,
          endDate: p.endDate ? new Date(p.endDate * 1000) : undefined,
          location: p.location,
          category: p.category,
          milestones: p.milestones.map((m: any) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            amount: m.amount,
            completed: m.completed,
            completedDate: m.completedDate ? new Date(m.completedDate * 1000) : undefined,
            proofDocuments: m.proofDocuments
          })),
          upvotes: p.upvotes,
          hasUserUpvoted: p.hasUserUpvoted
        }));
        
        // Apply filters initially
        this.applyFilters();
      }
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      this.error = error.message || 'Failed to fetch projects. Please try again later.';
    } finally {
      this.loading = false;
    }
  }
  
  applyFilters(): void {
    let filtered = [...this.projects];
    
    // Apply status filter
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === this.filterStatus);
    }
    
    // Apply category filter
    if (this.filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === this.filterCategory);
    }
    
    // Sort by start date (newest first)
    filtered.sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return b.startDate.getTime() - a.startDate.getTime();
    });
    
    this.projects = filtered;
  }
  
  viewProjectDetails(project: Project): void {
    this.selectedProject = project;
  }
  
  closeProjectDetails(): void {
    this.selectedProject = null;
  }
  
  async upvoteProject(projectId: string): Promise<void> {
    if (!this.userAddress) return;
    
    this.isUpvoting = true;
    this.upvoteError = null;
    
    try {
      // Call contract to upvote project
      await this.contractService.upvoteProject(parseInt(projectId, 10));
      
      // Update the project in the list
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        project.upvotes++;
        project.hasUserUpvoted = true;
      }
      
    } catch (error: any) {
      console.error('Error upvoting project:', error);
      this.upvoteError = error.message || 'Failed to upvote project. Please try again later.';
    } finally {
      this.isUpvoting = false;
    }
  }
  
  // Helper methods
  formatDate(date?: Date): string {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  formatCurrency(amount: number): string {
    return amount.toFixed(4) + ' ETH';
  }
  
  formatAddress(address: string): string {
    if (!address) return 'Unknown';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  getProgressPercentage(project: Project): number {
    if (project.budget <= 0) return 0;
    return Math.min(100, (project.funds / project.budget) * 100);
  }
  
  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'proposed': return 'status-proposed';
      case 'approved': return 'status-approved';
      case 'in_progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-proposed';
    }
  }
  
  getMilestoneCompletionPercentage(project: Project): number {
    if (!project.milestones || project.milestones.length === 0) return 0;
    
    const completedMilestones = this.getCompletedMilestonesCount(project);
    return Math.round((completedMilestones / project.milestones.length) * 100);
  }
  
  getCompletedMilestonesCount(project: Project): number {
    if (!project.milestones || project.milestones.length === 0) return 0;
    return project.milestones.filter(m => m.completed).length;
  }
  
  // Get available categories for filtering
  get availableCategories(): string[] {
    const categories = new Set<string>();
    
    // Add default categories
    categories.add('Infrastructure');
    categories.add('Sanitation');
    categories.add('Education');
    categories.add('Healthcare');
    categories.add('Public Safety');
    categories.add('Environmental');
    
    // Add categories from projects
    this.projects.forEach(p => {
      if (p.category) categories.add(p.category);
    });
    
    return Array.from(categories).sort();
  }
}
