import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../user.service';
import { AuthService } from '../../auth/auth.service';
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
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Check if user is logged in
    this.authService.connected$.subscribe((connected: boolean) => {
      this.isLoggedIn = connected;
      
      // If not logged in, redirect to login
      if (!connected) {
        // In a real app, we would save the current route and redirect after login
        // For now, just show an alert
        alert('Please connect your wallet to file a grievance');
        this.router.navigate(['/']);
      }
    });
    
    // Load categories and wards
    this.categories = this.userService.getGrievanceCategories();
    this.wards = this.userService.getWards();
  }
  
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      // Convert FileList to array and append to attachments
      const newFiles = Array.from(input.files);
      
      // Limit to 3 files total
      const totalFiles = [...this.grievanceData.attachments, ...newFiles];
      if (totalFiles.length > 3) {
        alert('Maximum 3 files allowed');
        return;
      }
      
      this.grievanceData.attachments = totalFiles;
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
    
    // Submit grievance
    this.userService.submitGrievance(
      this.grievanceData.category,
      this.grievanceData.description
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        
        // Reset form after 3 seconds
        setTimeout(() => {
          this.resetForm();
          this.router.navigate(['/user/status']);
        }, 3000);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = 'Failed to submit grievance. Please try again.';
        console.error('Error submitting grievance:', err);
      }
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
}
