import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface GrievanceDetail {
  id: string;
  title: string;
  description: string;
  location: string;
  type: string;
  citizenAddress: string;
  citizenName?: string;
  createdAt: Date;
  status: string;
  urgent: boolean;
  imageUrls?: string[];
}

@Component({
  selector: 'app-grievance-review',
  templateUrl: './grievance-review.component.html',
  styleUrls: ['./grievance-review.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule]
})
export class GrievanceReviewComponent implements OnInit {
  grievanceId: string = '';
  grievance: GrievanceDetail | null = null;
  
  reviewForm: FormGroup;
  processingAction = false;
  actionSuccess = false;
  actionError: string | null = null;
  
  loading = true;
  error: string | null = null;
  
  // Image carousel state
  currentImageIndex = 0;
  
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private contractService: ContractService,
    private authService: AuthService
  ) {
    this.reviewForm = this.fb.group({
      decision: ['approve', [Validators.required]],
      comments: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]]
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.grievanceId = params['id'];
      if (this.grievanceId) {
        this.loadGrievanceDetails();
      } else {
        this.error = 'Grievance ID not provided';
        this.loading = false;
      }
    });
  }

  async loadGrievanceDetails(): Promise<void> {
    try {
      this.loading = true;
      const grievanceData = await this.contractService.getGrievanceById(this.grievanceId);
      
      if (grievanceData) {
        this.grievance = {
          id: grievanceData.id,
          title: grievanceData.title,
          description: grievanceData.description,
          location: grievanceData.location,
          type: grievanceData.type,
          citizenAddress: grievanceData.citizenAddress,
          citizenName: grievanceData.citizenName,
          createdAt: new Date(grievanceData.timestamp * 1000),
          status: grievanceData.status,
          urgent: grievanceData.urgent,
          imageUrls: grievanceData.imageUrls || []
        };
        
        // Ensure it's a pending grievance
        if (this.grievance.status !== 'PENDING') {
          this.error = 'This grievance has already been processed';
        } else {
          this.error = null;
        }
      } else {
        this.error = 'Grievance not found';
      }
    } catch (error: any) {
      console.error('Error loading grievance details:', error);
      this.error = error.message || 'Failed to load grievance details';
    } finally {
      this.loading = false;
    }
  }

  async processGrievance(): Promise<void> {
    if (this.reviewForm.invalid) {
      return;
    }
    
    this.processingAction = true;
    this.actionError = null;
    
    try {
      const formValue = this.reviewForm.value;
      const isApproved = formValue.decision === 'approve';
      const comments = formValue.comments;
      
      if (!this.grievanceId) {
        throw new Error('Grievance ID not found');
      }
      
      // Call contract service to process grievance
      await this.contractService.processGrievance(
        this.grievanceId,
        isApproved,
        comments
      );
      
      this.actionSuccess = true;
      
      // Navigate back after 2 seconds
      setTimeout(() => {
        this.router.navigate(['/validator/grievances/pending']);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error processing grievance:', error);
      this.actionError = error.message || 'Failed to process grievance';
      this.actionSuccess = false;
    } finally {
      this.processingAction = false;
    }
  }
  
  goBack(): void {
    this.router.navigate(['/validator/grievances/pending']);
  }
  
  prevImage(): void {
    if (!this.grievance?.imageUrls || this.grievance.imageUrls.length === 0) return;
    this.currentImageIndex = (this.currentImageIndex - 1 + this.grievance.imageUrls.length) % this.grievance.imageUrls.length;
  }
  
  nextImage(): void {
    if (!this.grievance?.imageUrls || this.grievance.imageUrls.length === 0) return;
    this.currentImageIndex = (this.currentImageIndex + 1) % this.grievance.imageUrls.length;
  }
  
  formatAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
