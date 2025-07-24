import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminGovtService, GovtProject, SolanaService } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';



@Component({
  selector: 'app-view-project',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-project.html',
  styleUrl: './view-project.css'
})
export class ViewProject implements OnInit {
  // Projects list
  projects: GovtProject[] = [];
  filteredProjects: GovtProject[] = [];
  
  // UI states
  isLoading: boolean = true;
  errorMessage: string = '';
  expandedProjectId: string | null = null;
  showDetailsModal: boolean = false;
  selectedProject: GovtProject | null = null;
  
  // Filter states
  selectedStatusFilter: string = 'all';
  selectedWardFilter: string = 'all';
  searchQuery: string = '';
  
  // Available wards
  wards: string[] = [];
  
  // Wallet connection
  walletAddress: string | null = null;
  
  constructor(
    private adminGovtService: AdminGovtService,
    private solanaService: SolanaService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Check wallet connection first
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to access government admin functions.';
      this.isLoading = false;
      return;
    }

    // Get wallet address from SolanaService (primary) or AuthService (fallback)
    this.walletAddress = this.solanaService.getPublicKey() || this.authService.getPublicKey();
    
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
    this.errorMessage = '';
    
    // Load all projects from blockchain (Government view)
    this.adminGovtService.getAllProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading projects:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
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
  
  openDetailsModal(project: GovtProject): void {
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
    return amount.toFixed(2) + ' SOL';
  }

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to access government admin functions.';
      }
      if (error.message.includes('Unauthorized')) {
        return 'You are not authorized to view projects.';
      }
      return `Error: ${error.message}`;
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
