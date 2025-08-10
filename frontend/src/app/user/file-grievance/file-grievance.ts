import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SolanaService } from '../../services/solana/solana.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-file-grievance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-grievance.html',
  styleUrl: './file-grievance.css'
})
export class FileGrievance implements OnInit {
  isLoggedIn = false;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';

  // Form data
  grievanceData = {
    category: '',
    ward: '',
    location: '',
    description: '',
    attachments: [] as File[]
  };

  // Options for dropdowns
  categories: string[] = [];
  wards: string[] = [];

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
      }
    });

    // Load categories and wards (hardcoded for now, could be from blockchain)
    this.categories = [
      'Road Maintenance',
      'Water Supply',
      'Electricity',
      'Sanitation',
      'Public Safety',
      'Healthcare',
      'Education',
      'Other'
    ];
    this.wards = [
      'Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5',
      'Ward 6', 'Ward 7', 'Ward 8', 'Ward 9', 'Ward 10'
    ];
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      // Convert FileList to array and append to attachments
      const newFiles = Array.from(input.files);

      // Limit to 3 files total
      const totalFiles = [...this.grievanceData.attachments, ...newFiles];
      if (totalFiles.length > 3) {
        this.submitError = 'Maximum 3 files allowed';
        return;
      }

      this.grievanceData.attachments = totalFiles;
      this.submitError = ''; // Clear any previous error
    }
  }

  removeAttachment(index: number): void {
    this.grievanceData.attachments.splice(index, 1);
  }

  validateForm(): boolean {
    if (!this.grievanceData.category) {
      this.submitError = 'Please select a category';
      return false;
    }

    if (!this.grievanceData.ward) {
      this.submitError = 'Please select a ward';
      return false;
    }

    if (!this.grievanceData.location || this.grievanceData.location.trim().length < 5) {
      this.submitError = 'Please provide a valid location (at least 5 characters)';
      return false;
    }

    if (!this.grievanceData.description || this.grievanceData.description.trim().length < 20) {
      this.submitError = 'Please provide a detailed description (at least 20 characters)';
      return false;
    }

    return true;
  }

  submitGrievance(): void {
    this.submitError = '';

    // Validate form
    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting = true;

    // Submit grievance using real Solana blockchain
    const grievanceDetails = `Category: ${this.grievanceData.category}\nLocation: ${this.grievanceData.location}\nWard: ${this.grievanceData.ward}\nDescription: ${this.grievanceData.description}`;
    
    this.solanaService.submitGrievance({ details: grievanceDetails })
      .then((txSignature) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        console.log('Grievance submitted successfully. Transaction:', txSignature);
        
        // Reset form after successful submission
        setTimeout(() => {
          this.resetForm();
          this.router.navigate(['/user/status']);
        }, 2000);
      })
      .catch((err: any) => {
        this.isSubmitting = false;
        this.submitError = err.message || 'Failed to submit grievance. Please try again.';
        console.error('Error submitting grievance:', err);
      });
  }

  resetForm(): void {
    this.grievanceData = {
      category: '',
      ward: '',
      location: '',
      description: '',
      attachments: []
    };
    this.submitSuccess = false;
    this.submitError = '';
  }

  // Connect wallet if not connected
  async connectWallet(): Promise<void> {
    try {
      await this.solanaService.connectWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      this.submitError = 'Failed to connect wallet. Please try again.';
    }
  }
}
