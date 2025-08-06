import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../user.service';
import { TaxPayment } from '../../shared/services/blockchain.service';
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
    private router: Router
  ) { }

  ngOnInit(): void {
    // Check if user is logged in
    this.authService.connected$.subscribe((connected: boolean) => {
      this.isLoggedIn = connected;

      // If not logged in, redirect to login silently
      if (!connected) {
        this.router.navigate(['/login']);
        return;
      }

      // Get user's public key
      this.publicKey = this.authService.getPublicKey();

      // Load tax information
      this.loadTaxInformation();
    });
  }

  loadTaxInformation(): void {
    // Get current tax due
    this.userService.getCurrentTaxDue().subscribe((taxDue: {ward: string, year: number, amount: number, dueDate: Date}) => {
      this.taxDue = taxDue;

      // Get recent payments
      this.userService.getTaxPayments().subscribe((payments: TaxPayment[]) => {
        this.recentPayments = payments.slice(0, 5); // Show only 5 most recent payments
        this.isLoading = false;
      });
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

    // Submit tax payment
    this.userService.payTax(
      parseInt(this.taxDue.ward),
      this.taxDue.year
    ).subscribe({
      next: (payment: string) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.showConfirmation = false;

        // Add the new payment to recent payments (payment is actually a transaction ID)
        // For now, just reload the payments list
        this.loadTaxInformation();

        // In a real app, we would update the tax due information
        // For now, just set it to null to simulate payment
        this.taxDue = null;
      },
      error: (error: any) => {
        this.isSubmitting = false;
        this.submitError = true;
        this.errorMessage = error.message || 'Failed to process payment';
      }
    });
  }

  // Format the wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return '';
    if (address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
