import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';

interface AdminHead {
  name: string;
  department: string;
  walletAddress: string;
  dateAssigned: Date;
}

@Component({
  selector: 'app-assign-head',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assign-head.html',
  styleUrl: './assign-head.css'
})
export class AssignHead implements OnInit {
  // Form data
  newHead: AdminHead = {
    name: '',
    department: '',
    walletAddress: '',
    dateAssigned: new Date()
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
  showSuccessAlert: boolean = false;
  showErrorAlert: boolean = false;
  errorMessage: string = '';
  
  // Connected wallet
  walletAddress: string | null = null;
  
  constructor(private authService: AuthService) {}
  
  ngOnInit(): void {
    this.walletAddress = this.authService.getPublicKey();
    this.loadExistingHeads();
  }
  
  loadExistingHeads(): void {
    // Real blockchain integration required - mock implementation removed
    console.error('Real blockchain integration required: loadExistingHeads not implemented');
    this.adminHeads = [];
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
    
    this.isLoading = true;
    
    // Simulate blockchain transaction
    setTimeout(() => {
      // Add to list (in a real app, this would be after blockchain confirmation)
      this.adminHeads.push({
        ...this.newHead,
        dateAssigned: new Date()
      });
      
      // Reset form
      this.newHead = {
        name: '',
        department: '',
        walletAddress: '',
        dateAssigned: new Date()
      };
      
      this.isLoading = false;
      this.showSuccess();
    }, 1500);
  }
  
  removeHead(index: number): void {
    // In a real app, this would require blockchain transaction
    this.adminHeads.splice(index, 1);
  }
  
  connectWallet(): void {
    // Real blockchain integration required - mock implementation removed
    console.error('Real blockchain integration required: wallet connection not implemented');
    alert('Real blockchain integration required: wallet connection not implemented');
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
    // In a real app, this would do proper Solana address validation
    return address.length >= 8;
  }
}
