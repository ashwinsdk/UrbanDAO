import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../user/user.service';
import { AdminGovtService, TaxRate, SolanaService } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';



@Component({
  selector: 'app-set-tax',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './set-tax.html',
  styleUrl: './set-tax.css'
})
export class SetTax implements OnInit {
  // Form data
  newTaxRate: Partial<TaxRate> = {
    ward: '',
    year: new Date().getFullYear() + 1, // Next year by default
    amount: 0.5 // Default amount in SOL
  };
  
  // Available wards
  wards: string[] = [];
  
  // Tax rates list
  taxRates: TaxRate[] = [];
  
  // UI states
  isLoading: boolean = false;
  isSubmitting: boolean = false;
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
    this.isLoading = true;
    this.errorMessage = '';
    
    // Load existing tax rates from blockchain
    this.adminGovtService.getAllTaxRates().subscribe({
      next: (rates) => {
        this.taxRates = rates;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading tax rates:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
    });
  }
  
  openConfirmModal(): void {
    // Validate form
    if (!this.newTaxRate.ward || !this.newTaxRate.year || !this.newTaxRate.amount || this.newTaxRate.amount <= 0) {
      this.showError('Please fill in all required fields with valid values');
      return;
    }
    
    this.showConfirmModal = true;
  }
  
  closeConfirmModal(): void {
    this.showConfirmModal = false;
  }
  
  setTaxRate(): void {
    // Check wallet connection before setting tax rate
    if (!this.solanaService.isWalletConnected()) {
      this.showError('Please connect your wallet to set tax rates.');
      this.showConfirmModal = false;
      return;
    }
    
    this.isSubmitting = true;
    this.showConfirmModal = false;
    this.errorMessage = '';
    
    // Set tax rate on blockchain
    this.adminGovtService.setTaxRate(
      this.newTaxRate.ward!,
      this.newTaxRate.year!,
      this.newTaxRate.amount!
    ).subscribe({
      next: (setRate) => {
        console.log('Tax rate set successfully:', setRate);
        
        // Update local tax rates list
        const existingIndex = this.taxRates.findIndex(
          rate => rate.ward === setRate.ward && rate.year === setRate.year
        );
        
        if (existingIndex >= 0) {
          this.taxRates[existingIndex] = setRate;
        } else {
          this.taxRates.push(setRate);
        }
        
        // Reset form
        this.newTaxRate = {
          ward: this.wards.length > 0 ? this.wards[0] : '',
          year: new Date().getFullYear() + 1,
          amount: 0.5
        };
        
        this.isSubmitting = false;
        this.showSuccess();
      },
      error: (error) => {
        console.error('Error setting tax rate:', error);
        this.showError(this.getErrorMessage(error));
        this.isSubmitting = false;
      }
    });
  }
  
  deleteTaxRate(index: number): void {
    // TODO: Implement deleteTaxRate blockchain transaction
    // For now, just remove from local list
    this.taxRates.splice(index, 1);
    console.log('Delete tax rate functionality to be implemented with blockchain transaction');
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
  // Getter for safe template access
  get newTaxRateAmount(): number {
    return this.newTaxRate.amount || 0;
  }

  formatCurrency(amount: number): string {
    return amount.toFixed(2) + ' SOL';
  }

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to set tax rates.';
      }
      if (error.message.includes('Unauthorized')) {
        return 'You are not authorized to set tax rates.';
      }
      if (error.message.includes('User rejected')) {
        return 'Transaction was rejected. Please try again.';
      }
      return `Error: ${error.message}`;
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
