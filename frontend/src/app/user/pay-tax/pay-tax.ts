import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SolanaService } from '../../services/solana/solana.service';
import { TaxPayment } from '../../shared/services/blockchain.service';

@Component({
  selector: 'app-pay-tax',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pay-tax.html',
  styleUrl: './pay-tax.css'
})
export class PayTax implements OnInit {
  isLoggedIn = false;
  isLoading = true;
  isSubmitting = false;
  submitSuccess = false;
  submitError = false;
  errorMessage = '';

  // User's wallet public key
  publicKey: string | null = null;

  // Tax information
  taxDue: { ward: string; year: number; amount: number } | null = null;

  // Payment history
  recentPayments: TaxPayment[] = [];

  // Payment confirmation
  showConfirmation = false;

  constructor(
    private solanaService: SolanaService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Check if wallet is connected
    this.solanaService.walletState$.subscribe((walletState) => {
      this.isLoggedIn = walletState.connected;

      // If not logged in, redirect to login silently
      if (!walletState.connected) {
        this.router.navigate(['/login']);
        return;
      }

      // Get user's public key
      this.publicKey = walletState.publicKey;

      // Load tax information and payment history
      this.loadTaxInformation();
      this.loadPaymentHistory();
    });
  }

  loadTaxInformation(): void {
    // Get current tax due from blockchain
    this.solanaService.getWardTaxes().subscribe({
      next: (wardTaxes) => {
        if (wardTaxes.length > 0) {
          this.taxDue = {
            ward: `Ward ${wardTaxes[0].ward}`,
            year: 2024, // Current tax year
            amount: wardTaxes[0].amount
          };
        }
        this.loadPaymentHistory();
      },
      error: (error) => {
        console.error('Error loading tax information:', error);
        this.isLoading = false;
        this.submitError = true;
        this.errorMessage = 'Failed to load tax information';
      }
    });
  }

  loadPaymentHistory(): void {
    this.solanaService.getTaxPayments().subscribe({
      next: (payments) => {
        this.recentPayments = payments;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading payment history:', error);
        this.isLoading = false;
      }
    });
  }

  confirmPayment(): void {
    this.showConfirmation = true;
  }

  cancelPayment(): void {
    this.showConfirmation = false;
  }

  payTax(): void {
    if (!this.taxDue) return;

    this.isSubmitting = true;
    this.submitError = false;
    this.submitSuccess = false;

    // Submit tax payment using real Solana blockchain
    const wardNumber = parseInt(this.taxDue.ward.replace('Ward ', ''));
    
    this.solanaService.payTax({
      ward: wardNumber,
      year: this.taxDue.year
    }).then((txSignature) => {
      this.isSubmitting = false;
      this.submitSuccess = true;
      this.showConfirmation = false;
      console.log('Tax payment successful. Transaction:', txSignature);

      // Reload tax information and payment history
      this.loadTaxInformation();

      // Clear tax due after successful payment
      this.taxDue = null;
    }).catch((error: any) => {
      this.isSubmitting = false;
      this.submitError = true;
      this.errorMessage = error.message || 'Failed to process payment';
      console.error('Error paying tax:', error);
    });
  }

  // Format the wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return '';
    if (address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
