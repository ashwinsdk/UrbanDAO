import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, TaxPayment } from '../user.service';
import { SolanaService } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';

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
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private solanaService: SolanaService
  ) { }

  ngOnInit(): void {
    // Check wallet connection first
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to pay taxes.';
      this.isLoading = false;
      return;
    }

    // Get user's public key from SolanaService
    this.publicKey = this.solanaService.getPublicKey();
    this.isLoggedIn = true;

    // Load tax information
    this.loadTaxInformation();

    // Also check AuthService for backward compatibility
    this.authService.connected$.subscribe((connected: boolean) => {
      if (!connected && !this.solanaService.isWalletConnected()) {
        this.router.navigate(['/login']);
      }
    });
  }

  loadTaxInformation(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Get current tax due from blockchain
    this.userService.getCurrentTaxDue().subscribe({
      next: (taxDue) => {
        this.taxDue = taxDue;

        // Get recent payments from blockchain
        this.userService.getTaxPayments().subscribe({
          next: (payments) => {
            this.recentPayments = payments.slice(0, 5); // Show only 5 most recent payments
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error loading tax payments:', error);
            this.errorMessage = 'Failed to load payment history.';
            this.isLoading = false;
          }
        });
      },
      error: (error) => {
        console.error('Error loading tax due:', error);
        this.errorMessage = 'Failed to load tax information.';
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

    // Check wallet connection before payment
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to pay taxes.';
      this.showConfirmation = false;
      return;
    }

    this.isSubmitting = true;
    this.submitError = false;
    this.submitSuccess = false;
    this.errorMessage = '';

    // Submit tax payment to blockchain
    this.userService.payTax(
      this.taxDue.ward,
      this.taxDue.year,
      this.taxDue.amount
    ).subscribe({
      next: (payment) => {
        console.log('Tax payment successful:', payment);
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.showConfirmation = false;

        // Add the new payment to recent payments
        this.recentPayments = [payment, ...this.recentPayments].slice(0, 5);

        // Clear tax due after successful payment
        this.taxDue = null;

        // Show success message with transaction details
        this.errorMessage = '';
      },
      error: (error) => {
        console.error('Tax payment failed:', error);
        this.isSubmitting = false;
        this.submitError = true;
        this.showConfirmation = false;
        this.errorMessage = this.getErrorMessage(error);
      }
    });
  }

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to pay taxes.';
      }
      if (error.message.includes('User rejected')) {
        return 'Transaction was rejected. Please try again.';
      }
      if (error.message.includes('Insufficient funds')) {
        return 'Insufficient funds to complete the tax payment.';
      }
      if (error.message.includes('Invalid ward')) {
        return 'Invalid ward information. Please contact support.';
      }
      return `Payment failed: ${error.message}`;
    }
    return 'An unexpected error occurred during payment. Please try again.';
  }

  // Format the wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return '';
    if (address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
