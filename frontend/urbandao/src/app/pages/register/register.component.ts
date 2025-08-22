import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Web3Service } from '../../core/services/web3.service';
import { UserRole } from '../../core/models/role.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <div class="register-header">
          <img src="/assets/urbanDOA-trans.png" alt="UrbanDAO Logo" height="50" />
          <h1>Register for UrbanDAO</h1>
          <p>Complete your registration to participate in urban governance</p>
        </div>
        
        <div class="register-content">
          <ng-container *ngIf="!walletAddress">
            <div class="wallet-connect-required">
              <div class="warning-icon">!</div>
              <h3>Wallet Connection Required</h3>
              <p>Please connect your wallet first to continue registration.</p>
              <button class="btn-primary" (click)="connectWallet()">Connect Wallet</button>
            </div>
          </ng-container>
          
          <ng-container *ngIf="walletAddress && !isSubmitting">
            <div class="wallet-info">
              <span class="wallet-label">Connected Wallet:</span>
              <span class="wallet-address">{{ truncateAddress(walletAddress) }}</span>
            </div>
            
            <form [formGroup]="registrationForm" (ngSubmit)="onSubmit()" class="registration-form">
              <div class="form-group">
                <label for="fullName">Full Name</label>
                <input 
                  type="text" 
                  id="fullName" 
                  formControlName="fullName" 
                  placeholder="Enter your full name"
                  [class.is-invalid]="formSubmitted && f['fullName'].errors"
                >
                <div *ngIf="formSubmitted && f['fullName'].errors" class="error-message">
                  <span *ngIf="f['fullName'].errors['required']">Full name is required</span>
                </div>
              </div>
              
              <div class="form-group">
                <label for="email">Email Address</label>
                <input 
                  type="email" 
                  id="email" 
                  formControlName="email" 
                  placeholder="Enter your email address"
                  [class.is-invalid]="formSubmitted && f['email'].errors"
                >
                <div *ngIf="formSubmitted && f['email'].errors" class="error-message">
                  <span *ngIf="f['email'].errors['required']">Email is required</span>
                  <span *ngIf="f['email'].errors['email']">Please enter a valid email address</span>
                </div>
              </div>
              
              <div class="form-group">
                <label for="phone">Phone Number</label>
                <input 
                  type="tel" 
                  id="phone" 
                  formControlName="phone" 
                  placeholder="Enter your phone number"
                  [class.is-invalid]="formSubmitted && f['phone'].errors"
                >
                <div *ngIf="formSubmitted && f['phone'].errors" class="error-message">
                  <span *ngIf="f['phone'].errors['required']">Phone number is required</span>
                </div>
              </div>
              
              <div class="form-group">
                <label for="address">Physical Address</label>
                <textarea 
                  id="address" 
                  formControlName="address" 
                  placeholder="Enter your physical address"
                  rows="2"
                  [class.is-invalid]="formSubmitted && f['address'].errors"
                ></textarea>
                <div *ngIf="formSubmitted && f['address'].errors" class="error-message">
                  <span *ngIf="f['address'].errors['required']">Address is required</span>
                </div>
              </div>
              
              <div class="form-group">
                <label>Preferred Role</label>
                <div class="role-options">
                  <div 
                    *ngFor="let role of availableRoles" 
                    class="role-option" 
                    [class.selected]="registrationForm.get('role')?.value === role.value"
                    (click)="selectRole(role.value)"
                  >
                    <div class="role-info">
                      <h4>{{ role.label }}</h4>
                      <p>{{ role.description }}</p>
                    </div>
                    <div class="role-checkbox">
                      <span class="checkmark" *ngIf="registrationForm.get('role')?.value === role.value">✓</span>
                    </div>
                  </div>
                </div>
                <div *ngIf="formSubmitted && f['role'].errors" class="error-message">
                  <span *ngIf="f['role'].errors['required']">Please select a role</span>
                </div>
              </div>
              
              <div class="form-actions">
                <button type="button" class="btn-secondary" (click)="cancel()">Cancel</button>
                <button type="submit" class="btn-primary" [disabled]="isSubmitting">Register</button>
              </div>
            </form>
            
            <div *ngIf="error" class="form-error">
              <p>{{ error }}</p>
            </div>
          </ng-container>
          
          <ng-container *ngIf="isSubmitting">
            <div class="submitting-state">
              <div class="spinner"></div>
              <p>Submitting your registration...</p>
              <small>Please confirm the transaction in your wallet when prompted</small>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registrationForm!: FormGroup;
  walletAddress: string | null = null;
  isSubmitting = false;
  formSubmitted = false;
  error: string | null = null;
  
  availableRoles = [
    { 
      value: UserRole.CITIZEN_ROLE, 
      label: 'Citizen', 
      description: 'File grievances, make tax payments, and vote on proposals'
    },
    { 
      value: UserRole.VALIDATOR_ROLE, 
      label: 'Validator',
      description: 'Verify citizen identities and validate grievances'
    }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private web3Service: Web3Service,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialize form
    this.registrationForm = this.formBuilder.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      role: [UserRole.CITIZEN_ROLE, Validators.required]
    });
    
    // Check wallet connection
    this.web3Service.account$.subscribe(address => {
      this.walletAddress = address;
      
      // If wallet is connected but user is already registered, redirect
      if (address) {
        this.checkRegistrationStatus();
      }
    });
  }
  
  get f() { return this.registrationForm.controls; }
  
  async connectWallet(): Promise<void> {
    try {
      await this.web3Service.connect();
    } catch (error: any) {
      this.error = error.message || 'Failed to connect wallet';
    }
  }
  
  async checkRegistrationStatus(): Promise<void> {
    try {
      const status = await this.authService.checkRegistrationStatus();
      
      if (status === 'registered' || status === 'pending') {
        this.router.navigate(['/registration-status']);
      }
    } catch (error) {
      console.error('Error checking registration status:', error);
    }
  }
  
  selectRole(role: UserRole): void {
    this.registrationForm.patchValue({ role });
  }
  
  async onSubmit(): Promise<void> {
    this.formSubmitted = true;
    this.error = null;
    
    if (this.registrationForm.invalid) {
      return;
    }
    
    if (!this.walletAddress) {
      this.error = 'Wallet not connected. Please connect your wallet first.';
      return;
    }
    
    this.isSubmitting = true;
    
    try {
      const registrationData = {
        ...this.registrationForm.value,
        walletAddress: this.walletAddress
      };
      
      await this.authService.register(registrationData);
      this.router.navigate(['/registration-status']);
    } catch (error: any) {
      console.error('Registration error:', error);
      this.error = error.message || 'Registration failed. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }
  
  cancel(): void {
    this.router.navigate(['/']);
  }
  
  truncateAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
}
