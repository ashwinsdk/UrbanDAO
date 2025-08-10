import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SolanaService } from '../../services/solana/solana.service';
import { Grievance, GrievanceStatus } from '../../shared/services/blockchain.service';

// Extended Grievance interface for our component needs
interface ExtendedGrievance extends Grievance {
  ward?: string;
  submitterName?: string;
  title?: string;
  priority?: string;
}

@Component({
  selector: 'app-view-grievance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-grievance.html',
  styleUrl: './view-grievance.css'
})
export class ViewGrievance implements OnInit {
  // Grievances list
  grievances: ExtendedGrievance[] = [];
  filteredGrievances: ExtendedGrievance[] = [];
  
  // UI states
  isLoading: boolean = true;
  expandedGrievanceId: string | null = null;
  selectedStatusFilter: string = 'all';
  selectedWardFilter: string = 'all';
  searchQuery: string = '';
  
  // Available wards
  wards: string[] = [];
  
  // Connected wallet
  walletAddress: string | null = null;
  isConnected = false;
  
  constructor(
    private solanaService: SolanaService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.loadWards();
    this.loadGrievances();
  }
  
  loadWards(): void {
    // this.wards = this.userService.getWards();
  }
  
  loadGrievances(): void {
    this.isLoading = true;
    // Load grievances from blockchain
    this.solanaService.getGrievances().subscribe({
      next: (grievances: any) => {
        this.grievances = grievances;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading grievances:', error);
        this.grievances = [];
        this.filteredGrievances = [];
        this.isLoading = false;
      }
    });
  }
  
  // Temporary helper methods for demo data
  private getRandomWard(): string {
    const wardIndex = Math.floor(Math.random() * this.wards.length);
    return this.wards[wardIndex] || 'Ward 1';
  }
  
  private getRandomPriority(): string {
    const priorities = ['high', 'medium', 'low'];
    const index = Math.floor(Math.random() * priorities.length);
    return priorities[index];
  }
  
  toggleExpand(grievanceId: string): void {
    if (this.expandedGrievanceId === grievanceId) {
      this.expandedGrievanceId = null; // Collapse if already expanded
    } else {
      this.expandedGrievanceId = grievanceId; // Expand the clicked grievance
    }
  }
  
  isExpanded(grievanceId: string): boolean {
    return this.expandedGrievanceId === grievanceId;
  }
  
  applyFilters(): void {
    // Start with all grievances
    let filtered = [...this.grievances];
    
    // Apply status filter
    if (this.selectedStatusFilter !== 'all') {
      filtered = filtered.filter(g => g.status.toLowerCase() === this.selectedStatusFilter.toLowerCase());
    }
    
    // Apply ward filter
    if (this.selectedWardFilter !== 'all') {
      filtered = filtered.filter(g => g.ward && g.ward === this.selectedWardFilter);
    }
    
    // Apply search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(g => 
        (g.title && g.title.toLowerCase().includes(query)) ||
        (g.description && g.description.toLowerCase().includes(query)) ||
        (g.submitterName && g.submitterName.toLowerCase().includes(query))
      );
    }
    
    this.filteredGrievances = filtered;
  }
  
  onFilterChange(): void {
    this.applyFilters();
  }
  
  onSearch(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }
  
  clearFilters(): void {
    this.selectedStatusFilter = 'all';
    this.selectedWardFilter = 'all';
    this.searchQuery = '';
    this.applyFilters();
  }
  
  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'in progress': return 'status-in-progress';
      case 'resolved': return 'status-resolved';
      case 'rejected': return 'status-rejected';
      default: return '';
    }
  }
  
  getPriorityClass(priority?: string): string {
    if (!priority) return '';
    switch (priority.toLowerCase()) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  // Format date for display
  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
