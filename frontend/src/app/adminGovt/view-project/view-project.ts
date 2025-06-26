import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';

// Project interface
interface Project {
  id: string;
  title: string;
  description: string;
  ward: string;
  budget: number;
  status: 'Proposed' | 'Approved' | 'In Progress' | 'Completed' | 'Rejected';
  dateSubmitted: Date;
  dateUpdated?: Date;
  votes?: number;
  submitter?: string;
  documents?: string[];
  images?: string[];
}

@Component({
  selector: 'app-view-project',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-project.html',
  styleUrl: './view-project.css'
})
export class ViewProject implements OnInit {
  // Projects list
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  
  // UI states
  isLoading: boolean = true;
  expandedProjectId: string | null = null;
  showDetailsModal: boolean = false;
  selectedProject: Project | null = null;
  
  // Filter states
  selectedStatusFilter: string = 'all';
  selectedWardFilter: string = 'all';
  searchQuery: string = '';
  
  // Available wards
  wards: string[] = [];
  
  // Wallet connection
  walletAddress: string | null = null;
  
  constructor(private authService: AuthService) {}
  
  ngOnInit(): void {
    this.walletAddress = this.authService.getPublicKey();
    this.loadWards();
    this.loadProjects();
  }
  
  loadWards(): void {
    // In a real app, this would come from a service
    this.wards = [
      'Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5',
      'Ward 6', 'Ward 7', 'Ward 8', 'Ward 9', 'Ward 10'
    ];
  }
  
  loadProjects(): void {
    this.isLoading = true;
    
    // Simulate API call with timeout
    setTimeout(() => {
      // Mock data
      this.projects = this.generateMockProjects(15);
      this.applyFilters();
      this.isLoading = false;
    }, 1000);
  }
  
  generateMockProjects(count: number): Project[] {
    const statuses: ('Proposed' | 'Approved' | 'In Progress' | 'Completed' | 'Rejected')[] = 
      ['Proposed', 'Approved', 'In Progress', 'Completed', 'Rejected'];
    
    return Array(count).fill(0).map((_, i) => {
      const id = `PRJ-${String(i + 1).padStart(3, '0')}`;
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const randomWard = this.wards[Math.floor(Math.random() * this.wards.length)];
      const randomBudget = Math.round(Math.random() * 10000) / 100;
      
      const submissionDate = new Date();
      submissionDate.setDate(submissionDate.getDate() - Math.floor(Math.random() * 60));
      
      const updateDate = new Date(submissionDate);
      updateDate.setDate(updateDate.getDate() + Math.floor(Math.random() * 30));
      
      return {
        id,
        title: `Project ${id}`,
        description: `This is a sample project description for ${id}. It includes details about the project scope, goals, and expected outcomes.`,
        ward: randomWard,
        budget: randomBudget,
        status: randomStatus,
        dateSubmitted: submissionDate,
        dateUpdated: updateDate,
        votes: Math.floor(Math.random() * 100),
        submitter: `Citizen-${Math.floor(Math.random() * 1000)}`,
        documents: Math.random() > 0.5 ? ['proposal.pdf', 'budget.xlsx'] : [],
        images: Math.random() > 0.3 ? ['site-image-1.jpg', 'site-image-2.jpg'] : []
      };
    });
  }
  
  applyFilters(): void {
    // Start with all projects
    let filtered = [...this.projects];
    
    // Apply status filter
    if (this.selectedStatusFilter !== 'all') {
      filtered = filtered.filter(p => p.status.toLowerCase() === this.selectedStatusFilter.toLowerCase());
    }
    
    // Apply ward filter
    if (this.selectedWardFilter !== 'all') {
      filtered = filtered.filter(p => p.ward === this.selectedWardFilter);
    }
    
    // Apply search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
      );
    }
    
    this.filteredProjects = filtered;
  }
  
  onFilterChange(): void {
    this.applyFilters();
  }
  
  onSearch(event: Event): void {
    this.applyFilters();
  }
  
  clearFilters(): void {
    this.selectedStatusFilter = 'all';
    this.selectedWardFilter = 'all';
    this.searchQuery = '';
    this.applyFilters();
  }
  
  toggleExpand(projectId: string): void {
    if (this.expandedProjectId === projectId) {
      this.expandedProjectId = null; // Collapse if already expanded
    } else {
      this.expandedProjectId = projectId; // Expand this one
    }
  }
  
  isExpanded(projectId: string): boolean {
    return this.expandedProjectId === projectId;
  }
  
  openDetailsModal(project: Project): void {
    this.selectedProject = project;
    this.showDetailsModal = true;
  }
  
  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedProject = null;
  }
  
  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'proposed': return 'status-proposed';
      case 'approved': return 'status-approved';
      case 'in progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      case 'rejected': return 'status-rejected';
      default: return '';
    }
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string): string {
    if (!address) return 'Not connected';
    return address.substring(0, 4) + '...' + address.substring(address.length - 4);
  }
  
  // Format date for display
  formatDate(date: Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Format currency for display
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'SOL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}
