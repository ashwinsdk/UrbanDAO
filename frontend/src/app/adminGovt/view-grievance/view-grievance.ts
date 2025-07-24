import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../user/user.service';
import { AdminGovtService, GovtGrievance, SolanaService } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';



@Component({
  selector: 'app-view-grievance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-grievance.html',
  styleUrl: './view-grievance.css'
})
export class ViewGrievance implements OnInit {
  // Grievances list
  grievances: GovtGrievance[] = [];
  filteredGrievances: GovtGrievance[] = [];
  
  // UI states
  isLoading: boolean = true;
  errorMessage: string = '';
  expandedGrievanceId: string | null = null;
  selectedStatusFilter: string = 'all';
  selectedWardFilter: string = 'all';
  searchQuery: string = '';
  
  // Connected wallet
  walletAddress: string | null = null;
  
  // Available wards
  wards: string[] = [];
  
  constructor(
    private userService: UserService,
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
    this.loadGrievances();
  }
  
  loadWards(): void {
    this.wards = this.userService.getWards();
  }
  
  loadGrievances(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Load all grievances from blockchain (Government view)
    this.adminGovtService.getAllGrievances().subscribe({
      next: (grievances) => {
        this.grievances = grievances;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading grievances:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
    });
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
        g.description.toLowerCase().includes(query) ||
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

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to access government admin functions.';
      }
      if (error.message.includes('Unauthorized')) {
        return 'You are not authorized to view grievances.';
      }
      return `Error: ${error.message}`;
    }
    return 'An unexpected error occurred. Please try again.';
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  // Format date for display
  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
