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
    // In a real app, this would fetch from blockchain or backend
    // For now, we'll use mock data
    this.adminHeads = [
      {
        name: 'John Smith',
        department: 'Roads and Infrastructure',
        walletAddress: '5Tz4...',
        dateAssigned: new Date(2025, 2, 15)
      },
      {
        name: 'Emily Johnson',
        department: 'Public Health',
        walletAddress: '8xFr...',
        dateAssigned: new Date(2025, 1, 10)
      }
    ];
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
    // In a real app, this would connect to Phantom or other Solana wallets
    alert('This would connect to a Solana wallet in production');
    // For demo, we'll just set a mock address
    this.walletAddress = 'Demo' + Math.random().toString(36).substring(2, 10);
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
