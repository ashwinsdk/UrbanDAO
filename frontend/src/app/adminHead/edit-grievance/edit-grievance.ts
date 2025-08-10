import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SolanaService } from '../../services/solana/solana.service';
import { Grievance, GrievanceStatus } from '../../shared/services/blockchain.service';
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
  // Status enum for template
  GrievanceStatus = GrievanceStatus;
  
  // Loading state
  isLoading: boolean = true;
  
  // Connected wallet
  walletAddress: string | null = null;
  
  // Response for selected grievance
  responseText: string = '';
  
  constructor(
    private solanaService: SolanaService,
    private route: ActivatedRoute,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Check if wallet is connected
    this.solanaService.walletState$.subscribe((walletState) => {
      if (!walletState.connected) {
        this.router.navigate(['/login']);
        return;
      }
      
      // Get wallet address
      this.walletAddress = walletState.publicKey;
      
      // Load grievances
      this.loadGrievances();
    });
    
    // Check if there's a specific grievance ID in the route
    this.route.params.subscribe(params => {
      const grievanceId = params['id'];
      if (grievanceId) {
        this.selectGrievanceById(grievanceId);
      }
    });
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
        this.isLoading = false;
      }
    });
  }
  
  selectGrievanceById(id: string): void {
    const grievance = this.grievances.find(g => g.id === id);
    if (grievance) {
      this.selectedGrievance = { ...grievance };
      this.responseText = grievance.response || '';
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
          (grievance.category && grievance.category.toLowerCase().includes(term)) ||
          (grievance.description && grievance.description.toLowerCase().includes(term)) ||
          (grievance.details && grievance.details.toLowerCase().includes(term))
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
  
  updateStatus(status: GrievanceStatus): void {
    if (!this.selectedGrievance) return;
    
    this.modalAction = 'updateStatus';
    this.modalTitle = 'Confirm Status Update';
    this.modalMessage = `Are you sure you want to change the status of grievance ${this.selectedGrievance.id} to ${status}?`;
    this.showModal = true;
  }
  
  confirmStatusUpdate(status: GrievanceStatus): void {
    if (!this.selectedGrievance) return;
    
    this.updateGrievanceStatus(this.selectedGrievance, status);
  }
  
  private updateGrievanceStatus(grievance: Grievance, newStatus: GrievanceStatus): void {
    // Update grievance status using real Solana blockchain
    this.solanaService.updateGrievanceStatus(grievance.id, newStatus).then((txSignature) => {
      // Update the local grievance object
      grievance.status = newStatus;
      this.showModal = false;
      
      // Show success message
      this.modalTitle = 'Success';
      this.modalMessage = `Grievance status updated to ${newStatus}. Transaction: ${txSignature}`;
      this.modalAction = 'success';
      this.showModal = true;
      
      console.log('Grievance status updated successfully. Transaction:', txSignature);
      
      // Auto-close success modal after 3 seconds
      setTimeout(() => {
        this.showModal = false;
      }, 3000);
    }).catch((error: any) => {
      console.error('Error updating grievance status:', error);
      this.modalTitle = 'Error';
      this.modalMessage = error.message || 'Failed to update grievance status. Please try again.';
      this.modalAction = 'error';
      this.showModal = true;
    });
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
  formatDate(date: Date | null | undefined): string {
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
