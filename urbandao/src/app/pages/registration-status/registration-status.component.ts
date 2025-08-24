import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Web3Service } from '../../core/services/web3.service';

@Component({
  selector: 'app-registration-status',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="status-container">
      <div class="status-card">
        <div class="status-header">
          <img src="assets/urbanDOA.png" alt="UrbanDAO Logo" height="50" />
          <h1>Registration Status</h1>
        </div>
        
        <div class="status-content">
          <ng-container *ngIf="!walletAddress">
            <div class="wallet-connect-required">
              <div class="warning-icon">!</div>
              <h3>Wallet Connection Required</h3>
              <p>Please connect your wallet to check your registration status.</p>
              <button class="btn-primary" (click)="connectWallet()">Connect Wallet</button>
            </div>
          </ng-container>
          
          <ng-container *ngIf="walletAddress && loading">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Checking registration status...</p>
            </div>
          </ng-container>
          
          <ng-container *ngIf="walletAddress && !loading && status">
            <div class="status-info">
              <div class="wallet-info">
                <span class="wallet-label">Connected Wallet:</span>
                <span class="wallet-address">{{ truncateAddress(walletAddress) }}</span>
              </div>
              
              <!-- Registered Status -->
              <ng-container *ngIf="status === 'registered'">
                <div class="status-card success">
                  <div class="status-icon">✓</div>
                  <div class="status-details">
                    <h3>Registration Complete</h3>
                    <p>Your account is registered and active.</p>
                    
                    <div class="role-info" *ngIf="userRole">
                      <span class="role-label">Your Role:</span>
                      <span class="role-value">{{ formatRole(userRole) }}</span>
                    </div>
                  </div>
                </div>
                
                <div class="status-actions">
                  <button class="btn-primary" (click)="goDashboard()">Go to Dashboard</button>
                </div>
              </ng-container>
              
              <!-- Pending Status -->
              <ng-container *ngIf="status === 'pending'">
                <div class="status-card pending">
                  <div class="status-icon">⌛</div>
                  <div class="status-details">
                    <h3>Registration Pending</h3>
                    <p>Your registration has been submitted and is awaiting validation.</p>
                    <p class="hint">A validator will review your information shortly.</p>
                  </div>
                </div>
                
                <div class="status-actions">
                  <button class="btn-secondary" (click)="refreshStatus()">Refresh Status</button>
                </div>
              </ng-container>
              
              <!-- Not Registered Status -->
              <ng-container *ngIf="status === 'not_registered'">
                <div class="status-card warning">
                  <div class="status-icon">!</div>
                  <div class="status-details">
                    <h3>Not Registered</h3>
                    <p>You haven't registered with UrbanDAO yet.</p>
                  </div>
                </div>
                
                <div class="status-actions">
                  <button class="btn-primary" routerLink="/register">Register Now</button>
                </div>
              </ng-container>
              
              <!-- Rejected Status -->
              <ng-container *ngIf="status === 'rejected'">
                <div class="status-card error">
                  <div class="status-icon">✕</div>
                  <div class="status-details">
                    <h3>Registration Rejected</h3>
                    <p>Your registration has been rejected by validators.</p>
                    <p class="hint">You can submit a new registration with corrected information.</p>
                  </div>
                </div>
                
                <div class="status-actions">
                  <button class="btn-primary" routerLink="/register">Register Again</button>
                </div>
              </ng-container>
            </div>
          </ng-container>
          
          <ng-container *ngIf="walletAddress && !loading && error">
            <div class="error-state">
              <div class="error-icon">✕</div>
              <h3>Error Checking Status</h3>
              <p>{{ error }}</p>
              <button class="btn-secondary" (click)="refreshStatus()">Try Again</button>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./registration-status.component.scss']
})
export class RegistrationStatusComponent implements OnInit {
  walletAddress: string | null = null;
  loading = false;
  status: 'registered' | 'pending' | 'not_registered' | 'rejected' | null = null;
  error: string | null = null;
  userRole: string | null = null;

  constructor(
    private authService: AuthService,
    private web3Service: Web3Service,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check wallet connection
    this.web3Service.account$.subscribe(address => {
      this.walletAddress = address;
      
      if (address) {
        this.checkStatus();
      }
    });
    
    // Check if user has a role
    this.authService.user$.subscribe(user => {
      if (user && user.role) {
        this.userRole = user.role;
      }
    });
  }
  
  async connectWallet(): Promise<void> {
    try {
      await this.web3Service.connect();
    } catch (error: any) {
      this.error = error.message || 'Failed to connect wallet';
    }
  }
  
  async checkStatus(): Promise<void> {
    if (!this.walletAddress) {
      return;
    }
    
    this.loading = true;
    this.error = null;
    
    try {
      this.status = await this.authService.checkRegistrationStatus();
      
      // If user is registered but we don't have their role yet, fetch it
      if (this.status === 'registered' && !this.userRole) {
        await this.authService.checkUserRole();
      }
    } catch (error: any) {
      console.error('Error checking registration status:', error);
      this.error = error.message || 'Failed to check registration status';
      this.status = null;
    } finally {
      this.loading = false;
    }
  }
  
  refreshStatus(): void {
    this.checkStatus();
  }
  
  goDashboard(): void {
    this.router.navigate(['/']);
  }
  
  truncateAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  formatRole(role: string): string {
    // Convert enum-style role to readable format
    const formatted = role.replace('_ROLE', '').toLowerCase().replace(/_/g, ' ');
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
}
