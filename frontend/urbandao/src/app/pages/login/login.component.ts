import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Web3Service } from '../../core/services/web3.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <img src="/assets/urbanDOA-trans.png" alt="UrbanDAO Logo" height="60" />
          <h1>Connect Wallet</h1>
          <p>Connect your Ethereum wallet to access the UrbanDAO platform</p>
        </div>
        
        <div class="login-content">
          <ng-container *ngIf="loading; else notLoading">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Connecting to wallet...</p>
            </div>
          </ng-container>
          
          <ng-template #notLoading>
            <ng-container *ngIf="connected && walletAddress; else notConnected">
              <div class="connected-state">
                <div class="success-icon">✓</div>
                <h2>Wallet Connected</h2>
                <div class="wallet-address">{{ truncateAddress(walletAddress) }}</div>
                
                <div class="action-buttons">
                  <button class="btn-secondary" (click)="disconnect()">Disconnect</button>
                  <button class="btn-primary" (click)="proceed()">Continue</button>
                </div>
              </div>
            </ng-container>
            
            <ng-template #notConnected>
              <div class="wallet-options">
                <button class="wallet-btn" (click)="connect()">
                  <span class="wallet-icon metamask"></span>
                  <span class="wallet-text">MetaMask</span>
                </button>
                
                <p class="wallet-note">
                  Don't have a wallet? <a href="https://metamask.io/" target="_blank">Get MetaMask</a>
                </p>
              </div>
              
              <div *ngIf="error" class="error-message">
                <p>{{ error }}</p>
              </div>
            </ng-template>
          </ng-template>
        </div>
        
        <div class="login-footer">
          <p>By connecting, you agree to the <a routerLink="/terms">Terms of Service</a></p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loading = false;
  connected = false;
  walletAddress: string | null = null;
  error: string | null = null;

  constructor(
    private authService: AuthService,
    private web3Service: Web3Service,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if wallet is already connected
    this.web3Service.account$.subscribe(address => {
      this.walletAddress = address;
      this.connected = !!address;
    });
    
    this.web3Service.loading$.subscribe(isLoading => {
      this.loading = isLoading;
    });
    
    // If already connected, check if user has a role
    if (this.connected && this.walletAddress) {
      this.checkUserRole();
    }
  }

  async connect(): Promise<void> {
    this.error = null;
    
    try {
      await this.authService.login();
    } catch (error: any) {
      console.error('Login error:', error);
      this.error = error.message || 'Failed to connect wallet. Please try again.';
    }
  }

  async disconnect(): Promise<void> {
    await this.authService.logout();
  }

  async proceed(): Promise<void> {
    await this.checkUserRole();
  }

  private async checkUserRole(): Promise<void> {
    const user = this.authService.getCurrentUser();
    
    if (user && user.isLoggedIn) {
      // User has a role, redirect to their dashboard
      this.router.navigate(['/']);
    } else {
      // Check registration status
      const status = this.authService.getRegistrationStatus();
      
      if (status === 'pending') {
        // Registration is pending
        this.router.navigate(['/registration-status']);
      } else {
        // User needs to register
        this.router.navigate(['/register']);
      }
    }
  }

  truncateAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
}
