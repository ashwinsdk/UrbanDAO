import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../user.service';
import { SolanaService } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-file-grievance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './file-grievance.html',
  styleUrl: './file-grievance.css'
})
export class FileGrievance implements OnInit {
  isLoggedIn = false;
  isSubmitting = false;
  selectedFiles: File[] = [];
  errorMessage = '';
  successMessage = '';
  submitError = '';
  submitSuccess = false;

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

  grievanceForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router,
    private solanaService: SolanaService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.initializeForm();
    this.checkWalletConnection();
    this.authService.connected$.subscribe((connected: boolean) => {
      this.isLoggedIn = connected;

      // If not logged in, redirect to login silently
      if (!connected) {
        // Redirect to login page without showing alert
        this.router.navigate(['/login']);
      }
    });

    // Load categories and wards
    this.categories = this.userService.getGrievanceCategories();
    this.wards = this.userService.getWards();
  }

  private initializeForm(): void {
    this.grievanceForm = this.fb.group({
      category: ['', Validators.required],
      ward: ['', Validators.required],
      location: ['', Validators.required],
      description: ['', Validators.required]
    });
  }

  private checkWalletConnection(): void {
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to file a grievance.';
      this.grievanceForm.disable();
    }
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

  onSubmit(): void {
    if (this.grievanceForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.errorMessage = '';
      this.successMessage = '';
      
      // Check wallet connection before submitting
      if (!this.solanaService.isWalletConnected()) {
        this.errorMessage = 'Please connect your wallet to file a grievance.';
        this.isSubmitting = false;
        return;
      }
      
      const formData = this.grievanceForm.value;
      
      // Submit grievance to blockchain
      this.userService.submitGrievance(
        formData.category,
        formData.description
      ).subscribe({
        next: (grievance) => {
          console.log('Grievance submitted successfully:', grievance);
          this.successMessage = `Grievance filed successfully! Transaction ID: ${grievance.id}`;
          
          // Reset form after successful submission
          this.grievanceForm.reset();
          this.selectedFiles = [];
          
          // Navigate to status page after a short delay
          setTimeout(() => {
            this.router.navigate(['/user/status']);
          }, 3000);
        },
        error: (error) => {
          console.error('Error submitting grievance:', error);
          this.errorMessage = this.getErrorMessage(error);
          this.isSubmitting = false;
        },
        complete: () => {
          this.isSubmitting = false;
        }
      });
    }
  }

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to file a grievance.';
      }
      if (error.message.includes('User rejected')) {
        return 'Transaction was rejected. Please try again.';
      }
      if (error.message.includes('Insufficient funds')) {
        return 'Insufficient funds to complete the transaction.';
      }
      return `Error: ${error.message}`;
    }
    return 'An unexpected error occurred. Please try again.';
  }

  submitGrievance(): void {
    this.onSubmit();
  }

  resetForm(): void {
    this.grievanceData = {
      category: '',
      ward: '',
      location: '',
      description: '',
      attachments: []
    };
    this.grievanceForm.reset();
    this.submitSuccess = false;
    this.submitError = '';
    this.errorMessage = '';
    this.successMessage = '';
  }
}
