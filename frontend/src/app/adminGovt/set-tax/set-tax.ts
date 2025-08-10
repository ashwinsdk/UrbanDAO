import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../user/user.service';
import { AuthService } from '../../auth/auth.service';

interface TaxRate {
  ward: string;
  year: number;
  amount: number;
  lastUpdated: Date;
}

@Component({
  selector: 'app-set-tax',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './set-tax.html',
  styleUrl: './set-tax.css'
})
export class SetTax implements OnInit {
  // Form data
  newTaxRate: TaxRate = {
    ward: '',
    year: new Date().getFullYear() + 1, // Next year by default
    amount: 0.5, // Default amount in SOL
    lastUpdated: new Date()
  };
  
  // Available wards
  wards: string[] = [];
  
  // Tax rates list
  taxRates: TaxRate[] = [];
  
  // UI states
  isLoading: boolean = false;
  showSuccessAlert: boolean = false;
  showErrorAlert: boolean = false;
  errorMessage: string = '';
  showConfirmModal: boolean = false;
  
  // Connected wallet
  walletAddress: string | null = null;
  
  // Years for selection
  availableYears: number[] = [];
  
  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    this.walletAddress = this.authService.getPublicKey();
    this.loadWards();
    this.loadExistingTaxRates();
    this.generateYearOptions();
  }
  
  loadWards(): void {
    this.wards = this.userService.getWards();
    if (this.wards.length > 0) {
      this.newTaxRate.ward = this.wards[0]; // Select first ward by default
    }
  }
  
  generateYearOptions(): void {
    const currentYear = new Date().getFullYear();
    this.availableYears = [currentYear, currentYear + 1, currentYear + 2];
  }
  
  loadExistingTaxRates(): void {
    // Real blockchain integration required - mock implementation removed
    console.error('Real blockchain integration required: loadExistingTaxRates not implemented');
    this.taxRates = [];
  }
  
  openConfirmModal(): void {
    // Validate form
    if (!this.newTaxRate.ward || !this.newTaxRate.year || this.newTaxRate.amount <= 0) {
      this.showError('Please fill in all required fields with valid values');
      return;
    }
    
    this.showConfirmModal = true;
  }
  
  closeConfirmModal(): void {
    this.showConfirmModal = false;
  }
  
  setTaxRate(): void {
    this.isLoading = true;
    this.showConfirmModal = false;
    
    // Simulate blockchain transaction
    setTimeout(() => {
      // Check if tax rate already exists for this ward and year
      const existingIndex = this.taxRates.findIndex(
        rate => rate.ward === this.newTaxRate.ward && rate.year === this.newTaxRate.year
      );
      
      if (existingIndex >= 0) {
        // Update existing rate
        this.taxRates[existingIndex] = {
          ...this.newTaxRate,
          lastUpdated: new Date()
        };
      } else {
        // Add new rate
        this.taxRates.push({
          ...this.newTaxRate,
          lastUpdated: new Date()
        });
      }
      
      // Reset form
      this.newTaxRate = {
        ward: this.wards.length > 0 ? this.wards[0] : '',
        year: new Date().getFullYear() + 1,
        amount: 0.5,
        lastUpdated: new Date()
      };
      
      this.isLoading = false;
      this.showSuccess();
    }, 1500);
  }
  
  deleteTaxRate(index: number): void {
    // In a real app, this would require blockchain transaction
    this.taxRates.splice(index, 1);
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
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  // Format date for display
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Format currency
  formatCurrency(amount: number): string {
    return amount.toFixed(2) + ' SOL';
  }
}
