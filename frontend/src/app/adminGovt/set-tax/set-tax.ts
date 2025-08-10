import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SolanaService } from '../../services/solana/solana.service';

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
  isConnected = false;
  
  // Years for selection
  availableYears: number[] = [];
  
  // Current tax rates
  currentTaxRates: any[] = [];
  
  constructor(
    private solanaService: SolanaService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Check if wallet is connected
    this.solanaService.walletState$.subscribe((walletState) => {
      this.isConnected = walletState.connected;
      if (!walletState.connected) {
        this.router.navigate(['/login']);
        return;
      }
      
      // Get wallet address
      this.walletAddress = walletState.publicKey;
      
      // Load current tax rates
      this.loadCurrentTaxRates();
    });
    
    this.loadWards();
    this.generateYearOptions();
  }
  
  loadWards(): void {
    // Load wards (hardcoded for now)
    this.wards = [
      'Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5',
      'Ward 6', 'Ward 7', 'Ward 8', 'Ward 9', 'Ward 10'
    ];
    if (this.wards.length > 0) {
      this.newTaxRate.ward = this.wards[0]; // Select first ward by default
    }
  }
  
  generateYearOptions(): void {
    const currentYear = new Date().getFullYear();
    this.availableYears = [currentYear, currentYear + 1, currentYear + 2];
  }
  
  loadCurrentTaxRates(): void {
    this.isLoading = true;
    // Load current tax rates from blockchain
    this.solanaService.getWardTaxes().subscribe({
      next: (wardTaxes: any) => {
        this.currentTaxRates = wardTaxes.map((wt: any) => ({
          ward: wt.ward,
          currentRate: wt.amount,
          lastUpdated: new Date() // Would come from blockchain
        }));
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading tax rates:', error);
        this.currentTaxRates = [];
        this.isLoading = false;
      }
    });
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
