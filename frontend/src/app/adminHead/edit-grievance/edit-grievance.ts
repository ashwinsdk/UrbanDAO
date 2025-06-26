import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserService, Grievance } from '../../user/user.service';
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
  grievances: Grievance[] = [];
  filteredGrievances: Grievance[] = [];
  
  // Currently selected grievance for editing
  selectedGrievance: Grievance | null = null;
  
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
  
  // Connected wallet
  walletAddress: string | null = null;
  
  // Response for selected grievance
  responseText: string = '';
  
  constructor(
    private userService: UserService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.loadGrievances();
    this.walletAddress = this.authService.getPublicKey();
    
    // Check for grievance ID in route params
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.loadGrievanceDetails(params['id']);
      }
    });
  }
  
  loadGrievances(): void {
    this.isLoading = true;
    this.userService.getGrievances().subscribe(grievances => {
      this.grievances = grievances;
      this.applyFilters();
      this.isLoading = false;
    });
  }
  
  loadGrievanceDetails(id: string): void {
    this.userService.getGrievances().subscribe(grievances => {
      const grievance = grievances.find(g => g.id === id);
      if (grievance) {
        this.selectedGrievance = { ...grievance };
        this.responseText = grievance.response || '';
      }
    });
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
  
  selectGrievance(grievance: Grievance): void {
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
    
    // Create updated grievance object
    const updatedGrievance: Grievance = {
      ...this.selectedGrievance,
      status: status,
      response: this.responseText || undefined
    };
    
    // In a real app, this would call an API to update the grievance
    // For now, we'll simulate by updating our local list
    const updatedGrievances = this.grievances.map(g => 
      g.id === updatedGrievance.id ? updatedGrievance : g
    );
    
    this.grievances = updatedGrievances;
    this.grievancesSubject.next(updatedGrievances);
    this.applyFilters();
    this.showSuccessModal('Status Updated', `Grievance ${updatedGrievance.id} status has been updated to ${status}.`);
  }
  
  // Simulate a BehaviorSubject for our mock data
  private get grievancesSubject() {
    return {
      next: (grievances: Grievance[]) => {
        // In a real app with a proper service, this would update the BehaviorSubject
        this.grievances = grievances;
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
