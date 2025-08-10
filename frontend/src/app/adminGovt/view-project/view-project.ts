import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SolanaService } from '../../services/solana/solana.service';
import { Project as BlockchainProject, ProjectStatus } from '../../shared/services/blockchain.service';

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
  isConnected = false;
  
  constructor(
    private solanaService: SolanaService,
    private router: Router
  ) { }
  
  ngOnInit(): void {
    // Check if wallet is connected
    this.solanaService.walletState$.subscribe((walletState) => {
      this.isConnected = walletState.connected;
      if (!walletState.connected) {
        this.router.navigate(['/login']);
        return;
      }
      
      // Get wallet address
      this.walletAddress = walletState.publicKey;
      
      // Load all projects
      this.loadProjects();
    });
    
    this.loadWards();
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
    // Load projects from blockchain
    this.solanaService.getProjects().subscribe({
      next: (projects: any) => {
        this.projects = projects;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading projects:', error);
        this.projects = [];
        this.filteredProjects = [];
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
