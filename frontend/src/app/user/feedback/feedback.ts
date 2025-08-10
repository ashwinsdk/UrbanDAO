import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SolanaService } from '../../services/solana/solana.service';
import { Router } from '@angular/router';

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
    private solanaService: SolanaService,
    private router: Router
  ) { }
  
  ngOnInit(): void {
    // Check wallet connection
    this.solanaService.walletState$.subscribe((walletState) => {
      this.isConnected = walletState.connected;
      this.publicKey = walletState.publicKey;
      
      if (!walletState.connected) {
        this.router.navigate(['/login']);
      }
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
    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting = true;
    this.submitError = false;
    this.submitSuccess = false;

    // Submit feedback using real Solana blockchain
    const feedbackComment = `Category: ${this.feedbackForm.category}\nSubject: ${this.feedbackForm.subject}\nMessage: ${this.feedbackForm.message}\nRating: ${this.feedbackForm.rating}/5`;
    const isSatisfied = this.feedbackForm.rating >= 3; // 3+ stars = satisfied
    
    this.solanaService.submitFeedback({
      projectId: 'general-feedback', // For general feedback, use a default project ID
      comment: feedbackComment,
      satisfied: isSatisfied
    }).then((txSignature) => {
      this.isSubmitting = false;
      this.submitSuccess = true;
      console.log('Feedback submitted successfully. Transaction:', txSignature);
      
      // Reset form after successful submission
      setTimeout(() => {
        this.resetForm();
      }, 3000);
    }).catch((err: any) => {
      this.isSubmitting = false;
      this.submitError = true;
      this.errorMessage = err.message || 'Failed to submit feedback. Please try again.';
      console.error('Error submitting feedback:', err);
    });
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  }
}
