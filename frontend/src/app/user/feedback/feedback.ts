import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../user.service';
import { AuthService } from '../../auth/auth.service';

interface FeedbackForm {
  category: string;
  subject: string;
  message: string;
  rating: number;
  attachFile: boolean;
}

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback.html',
  styleUrl: './feedback.css'
})
export class Feedback implements OnInit {
  isConnected = false;
  publicKey: string | null = null;
  
  // Form data
  feedbackForm: FeedbackForm = {
    category: '',
    subject: '',
    message: '',
    rating: 0,
    attachFile: false
  };
  
  // Form state
  isSubmitting = false;
  submitSuccess = false;
  submitError = false;
  errorMessage = '';
  
  // Categories for feedback
  categories = [
    'General Feedback',
    'Project Suggestion',
    'Complaint',
    'Technical Issue',
    'Appreciation'
  ];
  
  constructor(
    private authService: AuthService,
    private userService: UserService
  ) {}
  
  ngOnInit(): void {
    // Check wallet connection status
    this.authService.connected$.subscribe(connected => {
      this.isConnected = connected;
    });
    
    // Get public key if connected
    this.authService.publicKey$.subscribe(publicKey => {
      this.publicKey = publicKey;
    });
  }
  
  // Set rating value
  setRating(rating: number): void {
    this.feedbackForm.rating = rating;
  }
  
  // Check if a specific star should be filled
  isStarFilled(starValue: number): boolean {
    return this.feedbackForm.rating >= starValue;
  }
  
  // Reset form to initial state
  resetForm(): void {
    this.feedbackForm = {
      category: '',
      subject: '',
      message: '',
      rating: 0,
      attachFile: false
    };
    this.submitSuccess = false;
    this.submitError = false;
  }
  
  // Validate form before submission
  validateForm(): boolean {
    if (!this.feedbackForm.category) {
      this.errorMessage = 'Please select a feedback category';
      return false;
    }
    
    if (!this.feedbackForm.subject.trim()) {
      this.errorMessage = 'Please enter a subject';
      return false;
    }
    
    if (!this.feedbackForm.message.trim()) {
      this.errorMessage = 'Please enter your feedback message';
      return false;
    }
    
    if (this.feedbackForm.rating === 0) {
      this.errorMessage = 'Please provide a rating';
      return false;
    }
    
    return true;
  }
  
  // Submit feedback
  submitFeedback(): void {
    // Reset status
    this.submitError = false;
    this.submitSuccess = false;
    
    // Check if wallet is connected
    if (!this.isConnected) {
      this.submitError = true;
      this.errorMessage = 'Please connect your wallet to submit feedback';
      return;
    }
    
    // Validate form
    if (!this.validateForm()) {
      this.submitError = true;
      return;
    }
    
    this.isSubmitting = true;
    
    // Call service to submit feedback
    // Convert rating to valid value (1-5) for the service
    const rating = this.feedbackForm.rating as 1 | 2 | 3 | 4 | 5;
    this.userService.submitFeedback(
      'general', // projectId - since this is general feedback
      `${this.feedbackForm.subject}: ${this.feedbackForm.message}`, // comment
      this.feedbackForm.rating >= 3 // satisfied if rating is 3 or above
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        // Reset form after successful submission
        setTimeout(() => {
          this.resetForm();
        }, 3000);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = true;
        this.errorMessage = err.message || 'Failed to submit feedback. Please try again.';
      }
    });
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  }
}
