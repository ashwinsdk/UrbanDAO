import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminGovtService, AdminHead, SolanaService } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';



@Component({
  selector: 'app-assign-head',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assign-head.html',
  styleUrl: './assign-head.css'
})
export class AssignHead implements OnInit {
  // Form data
  newHead: Partial<AdminHead> = {
    name: '',
    department: '',
    walletAddress: ''
  };
  
  // Available departments
  departments: string[] = [
    'Roads and Infrastructure',
    'Sanitation',
    'Public Health',
    'Education',
    'Parks and Recreation',
    'Public Safety'
  ];
  
  // Admin heads list
  adminHeads: AdminHead[] = [];
  
  // UI states
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  showSuccessAlert: boolean = false;
  showErrorAlert: boolean = false;
  errorMessage: string = '';
  
  // Connected wallet
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
      return;
    }

    // Get wallet address from SolanaService (primary) or AuthService (fallback)
    this.walletAddress = this.solanaService.getPublicKey() || this.authService.getPublicKey();
    
    this.loadExistingHeads();
  }
  
  loadExistingHeads(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Load existing admin heads from blockchain
    this.adminGovtService.getAllAdminHeads().subscribe({
      next: (heads) => {
        this.adminHeads = heads;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading admin heads:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
    });
  }
  
  assignHead(): void {
    // Validate form
    if (!this.newHead.name || !this.newHead.department || !this.newHead.walletAddress) {
      this.showError('Please fill in all required fields');
      return;
    }
    
    // Check if wallet address is valid (simplified validation)
    if (!this.isValidWalletAddress(this.newHead.walletAddress)) {
      this.showError('Please enter a valid Solana wallet address');
      return;
    }
    
    // Check wallet connection before assigning
    if (!this.solanaService.isWalletConnected()) {
      this.showError('Please connect your wallet to assign admin heads.');
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    // Assign admin head on blockchain
    this.adminGovtService.assignAdminHead(
      this.newHead.name!,
      this.newHead.department!,
      this.newHead.walletAddress!
    ).subscribe({
      next: (assignedHead) => {
        console.log('Admin head assigned successfully:', assignedHead);
        
        // Add to local list
        this.adminHeads.push(assignedHead);
        
        // Reset form
        this.newHead = {
          name: '',
          department: '',
          walletAddress: ''
        };
        
        this.isSubmitting = false;
        this.showSuccess();
      },
      error: (error) => {
        console.error('Error assigning admin head:', error);
        this.showError(this.getErrorMessage(error));
        this.isSubmitting = false;
      }
    });
  }
  
  removeHead(index: number): void {
    // TODO: Implement removeAdminHead blockchain transaction
    // For now, just remove from local list
    this.adminHeads.splice(index, 1);
    console.log('Remove admin head functionality to be implemented with blockchain transaction');
  }
  
  connectWallet(): void {
    // Trigger wallet connection through SolanaService
    // Note: In a real implementation, this would trigger the wallet connection flow
    if (this.solanaService.isWalletConnected()) {
      this.walletAddress = this.solanaService.getPublicKey();
      this.errorMessage = '';
    } else {
      this.showError('Please connect your wallet using the connect button in the header.');
    }
  }
  
  useConnectedWallet(): void {
    if (this.walletAddress) {
      this.newHead.walletAddress = this.walletAddress;
    }
  }
  
  showSuccess(): void {
    this.showSuccessAlert = true;
    setTimeout(() => this.showSuccessAlert = false, 3000);
  }
  
  showError(message: string): void {
    this.errorMessage = message;
    this.showErrorAlert = true;
    setTimeout(() => this.showErrorAlert = false, 3000);
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string): string {
    if (!address) return '';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  }
  
  // Format date for display
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Simple wallet address validation
  isValidWalletAddress(address: string): boolean {
    // Basic Solana address validation (should be 32-44 characters)
    return address.length >= 32 && address.length <= 44 && /^[A-Za-z0-9]+$/.test(address);
  }

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to assign admin heads.';
      }
      if (error.message.includes('Unauthorized')) {
        return 'You are not authorized to assign admin heads.';
      }
      if (error.message.includes('User rejected')) {
        return 'Transaction was rejected. Please try again.';
      }
      return `Error: ${error.message}`;
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
