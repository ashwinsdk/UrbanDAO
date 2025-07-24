import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserService, Grievance } from '../../user/user.service';
import { AdminService, AdminGrievance, SolanaService } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-edit-grievance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './edit-grievance.html',
  styleUrl: './edit-grievance.css'
})
export class EditGrievance implements OnInit {
  // All grievances
  grievances: AdminGrievance[] = [];
  filteredGrievances: AdminGrievance[] = [];
  
  // Currently selected grievance for editing
  selectedGrievance: AdminGrievance | null = null;
  
  // Filter options
  statusFilter: string = 'all';
  searchTerm: string = '';
  
  // Modal control
  showModal: boolean = false;
  modalAction: string = '';
  modalTitle: string = '';
  modalMessage: string = '';
  
  // Loading state
  isLoading: boolean = true;
  isUpdating: boolean = false;
  errorMessage: string = '';
  
  // Connected wallet
  walletAddress: string | null = null;
  
  // Response for selected grievance
  responseText: string = '';
  
  constructor(
    private userService: UserService,
    private adminService: AdminService,
    private solanaService: SolanaService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Check wallet connection first
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to access admin functions.';
      this.isLoading = false;
      return;
    }

    // Get wallet address from SolanaService (primary) or AuthService (fallback)
    this.walletAddress = this.solanaService.getPublicKey() || this.authService.getPublicKey();
    
    this.loadGrievances();
    
    // Check for grievance ID in route params
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.loadGrievanceDetails(params['id']);
      }
    });
  }
  
  loadGrievances(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Load all grievances from blockchain (Admin view)
    this.adminService.getAllGrievances().subscribe({
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
  
  loadGrievanceDetails(id: string): void {
    // Find grievance from already loaded data or load from blockchain
    const grievance = this.grievances.find(g => g.id === id);
    if (grievance) {
      this.selectedGrievance = { ...grievance };
      this.responseText = grievance.response || '';
    } else if (this.grievances.length === 0) {
      // If grievances not loaded yet, load them first
      this.adminService.getAllGrievances().subscribe({
        next: (grievances) => {
          this.grievances = grievances;
          const foundGrievance = grievances.find(g => g.id === id);
          if (foundGrievance) {
            this.selectedGrievance = { ...foundGrievance };
            this.responseText = foundGrievance.response || '';
          }
        },
        error: (error) => {
          console.error('Error loading grievance details:', error);
          this.errorMessage = 'Failed to load grievance details.';
        }
      });
    }
  }
  
  applyFilters(): void {
    this.filteredGrievances = this.grievances.filter(grievance => {
      // Apply status filter
      if (this.statusFilter !== 'all' && grievance.status !== this.statusFilter) {
        return false;
      }
      
      // Apply search filter
      if (this.searchTerm && this.searchTerm.trim() !== '') {
        const term = this.searchTerm.toLowerCase();
        return (
          grievance.id.toLowerCase().includes(term) ||
          grievance.category.toLowerCase().includes(term) ||
          grievance.description.toLowerCase().includes(term)
        );
      }
      
      return true;
    });
  }
  
  selectGrievance(grievance: AdminGrievance): void {
    this.selectedGrievance = { ...grievance };
    this.responseText = grievance.response || '';
  }
  
  clearSelection(): void {
    this.selectedGrievance = null;
    this.responseText = '';
  }
  
  updateStatus(status: 'Pending' | 'In Progress' | 'Resolved' | 'Rejected'): void {
    if (!this.selectedGrievance) return;
    
    this.modalAction = 'updateStatus';
    this.modalTitle = 'Confirm Status Update';
    this.modalMessage = `Are you sure you want to change the status of grievance ${this.selectedGrievance.id} to ${status}?`;
    this.showModal = true;
  }
  
  confirmStatusUpdate(status: 'Pending' | 'In Progress' | 'Resolved' | 'Rejected'): void {
    if (!this.selectedGrievance) return;
    
    // Check wallet connection before updating
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to update grievance status.';
      this.showModal = false;
      return;
    }
    
    this.isUpdating = true;
    this.errorMessage = '';
    
    // Update grievance status on blockchain
    this.adminService.updateGrievanceStatus(
      this.selectedGrievance.id,
      status,
      this.responseText || undefined
    ).subscribe({
      next: (success) => {
        if (success) {
          // Update local grievance object
          this.selectedGrievance = {
            ...this.selectedGrievance!,
            status: status,
            response: this.responseText || undefined
          };
          
          // Update grievances list
          this.grievances = this.grievances.map(g => 
            g.id === this.selectedGrievance!.id ? this.selectedGrievance! : g
          );
          
          this.applyFilters();
          this.showSuccessModal('Status Updated', `Grievance ${this.selectedGrievance.id} status has been updated to ${status}.`);
        }
        this.isUpdating = false;
      },
      error: (error) => {
        console.error('Error updating grievance status:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isUpdating = false;
        this.showModal = false;
      }
    });
  }
  
  // Simulate a BehaviorSubject for our mock data
  private get grievancesSubject() {
    return {
      next: (grievances: Grievance[]) => {
        // In a real app with a proper service, this would update the BehaviorSubject
        // Convert Grievance[] to AdminGrievance[] by adding required properties
        this.grievances = grievances.map(grievance => ({
          ...grievance,
          user: grievance.id.slice(-8) || 'Unknown User', // Use grievance ID as user identifier
          category: grievance.category || 'General' // Category already exists in Grievance
        } as AdminGrievance));
      }
    };
  }
  
  showSuccessModal(title: string, message: string): void {
    this.modalAction = 'success';
    this.modalTitle = title;
    this.modalMessage = message;
    this.showModal = true;
  }
  
  closeModal(): void {
    this.showModal = false;
    if (this.modalAction === 'success') {
      this.clearSelection();
    }
  }

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to access admin functions.';
      }
      if (error.message.includes('Unauthorized')) {
        return 'You are not authorized to perform this action.';
      }
      if (error.message.includes('User rejected')) {
        return 'Transaction was rejected. Please try again.';
      }
      return `Error: ${error.message}`;
    }
    return 'An unexpected error occurred. Please try again.';
  }
  
  // Format date for display
  formatDate(date: Date | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Get CSS class for status badge
  getStatusClass(status: string): string {
    switch (status) {
      case 'Pending': return 'status-pending';
      case 'In Progress': return 'status-progress';
      case 'Resolved': return 'status-success';
      case 'Rejected': return 'status-error';
      default: return 'status-default';
    }
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
