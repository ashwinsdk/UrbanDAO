import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-new-grievance',
  templateUrl: './new-grievance.component.html',
  styleUrls: ['./new-grievance.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class NewGrievanceComponent implements OnInit {
  grievanceForm!: FormGroup;
  userAddress: string | null = null;
  
  isSubmitting = false;
  error: string | null = null;
  success = false;
  
  // For file uploads
  selectedFiles: File[] = [];
  maxFiles = 3;
  maxFileSize = 5 * 1024 * 1024; // 5MB
  
  constructor(
    private fb: FormBuilder,
    private contractService: ContractService,
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
      }
    });
    
    this.initializeForm();
  }
  
  initializeForm(): void {
    this.grievanceForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(1000)]],
      location: ['', [Validators.required, Validators.minLength(5)]],
      grievanceType: ['', Validators.required],
      contactPhone: ['', [Validators.pattern(/^\+?[0-9]{10,15}$/)]], // Optional phone
      contactEmail: ['', [Validators.email]], // Optional email
      termsAccepted: [false, Validators.requiredTrue]
    });
  }
  
  // File handling methods
  onFileSelected(event: any): void {
    const files = event.target.files;
    
    if (files) {
      // Check if adding these files would exceed the max
      if (this.selectedFiles.length + files.length > this.maxFiles) {
        this.error = `You can upload a maximum of ${this.maxFiles} files.`;
        return;
      }
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file size
        if (file.size > this.maxFileSize) {
          this.error = `File ${file.name} is too large. Maximum size is 5MB.`;
          continue;
        }
        
        // Check file type (only images)
        if (!file.type.startsWith('image/')) {
          this.error = `File ${file.name} is not an image. Only images are allowed.`;
          continue;
        }
        
        this.selectedFiles.push(file);
      }
    }
  }
  
  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    // Clear any errors that might have been related to file uploads
    this.error = null;
  }
  
  async uploadFilesToIPFS(): Promise<string[]> {
    if (this.selectedFiles.length === 0) {
      return [];
    }
    
    try {
      // In a real app, this would upload files to IPFS and return CIDs
      // For now, we'll just simulate it with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return mock IPFS CIDs
      return this.selectedFiles.map((_, index) => `ipfs://Qm...${index}`);
    } catch (error: any) {
      console.error('Error uploading files to IPFS:', error);
      throw new Error('Failed to upload images. Please try again.');
    }
  }
  
  async submitGrievance(): Promise<void> {
    if (this.grievanceForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.grievanceForm.controls).forEach(key => {
        const control = this.grievanceForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    if (!this.userAddress) {
      this.error = 'Wallet not connected. Please connect your wallet to submit a grievance.';
      return;
    }
    
    this.isSubmitting = true;
    this.error = null;
    
    try {
      // Upload files to IPFS first if any
      const imageCIDs = await this.uploadFilesToIPFS();
      
      // Prepare grievance data
      const grievanceData = {
        ...this.grievanceForm.value,
        images: imageCIDs
      };
      
      // Call contract to submit grievance
      const txResult = await this.contractService.submitGrievance(grievanceData);
      
      console.log('Grievance submitted:', txResult);
      this.success = true;
      
      // Redirect after a short delay
      setTimeout(() => {
        this.router.navigate(['/citizen/grievances']);
      }, 3000);
      
    } catch (error: any) {
      console.error('Error submitting grievance:', error);
      this.error = error.message || 'Failed to submit grievance. Please try again later.';
      this.isSubmitting = false;
    }
  }
  
  cancel(): void {
    this.router.navigate(['/citizen/grievances']);
  }
}
