import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Web3Service } from '../../core/services/web3.service';
import { UserRole } from '../../core/models/role.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <img src="assets/urbanDOA.png" alt="UrbanDAO Logo" height="60" />
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
                
                <div class="registration-section">
                  <p>New to UrbanDAO?</p>
                  <button class="register-btn" (click)="goToRegister()">Register Now</button>
                </div>
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
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 200px);
      padding: 2rem;
    }
    
    .login-card {
      width: 100%;
      max-width: 500px;
      background: #1a1a1a;
      border-radius: 12px;
      box-shadow: 0 8px 16px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    
    .login-header {
      padding: 2rem;
      text-align: center;
      border-bottom: 1px solid #333;
    }
    
    .login-header h1 {
      margin: 1rem 0;
      color: #a259d9;
    }
    
    .login-content {
      padding: 2rem;
    }
    
    .login-footer {
      padding: 1rem 2rem;
      background: #222;
      text-align: center;
      font-size: 0.9rem;
      border-top: 1px solid #333;
    }
    
    .loading-state {
      text-align: center;
      padding: 1rem 0;
    }
    
    .spinner {
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255,255,255,0.1);
      border-left-color: #a259d9;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .connected-state {
      text-align: center;
      padding: 1rem 0;
    }
    
    .success-icon {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      width: 48px;
      height: 48px;
      background: #a259d9;
      color: white;
      border-radius: 50%;
      font-size: 24px;
      margin-bottom: 1rem;
    }
    
    .wallet-address {
      background: #333;
      padding: 0.75rem;
      border-radius: 8px;
      font-family: monospace;
      margin: 1rem 0;
    }
    
    .wallet-options {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;
    }
    
    .wallet-btn {
      width: 100%;
      padding: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: #333;
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .wallet-btn:hover {
      background: #444;
      transform: translateY(-2px);
    }
    
    .wallet-icon {
      width: 24px;
      height: 24px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    }
    
    .metamask {
      background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzOSAzNiIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTM4LjM4NzYgMS4yMDk3N0wyMS40NjM5IDExLjQ5NzVMMjMuNzUxOSA1Ljc5MDcyTDM4LjM4NzYgMS4yMDk3N1oiIGZpbGw9IiNFMjc2MUIiLz48cGF0aCBkPSJNMi43NTczMyAxLjIwOTc3TDE5LjUyMzcgMTEuNjMzOEwxNy4zOTIgNS43OTA3MkwyLjc1NzMzIDEuMjA5NzdaTTMzLjA1MTIgMjUuNDcyM0wyOS4xMzQxIDMxLjAxODdMMzcuNTMgMzMuMTUwN0w0MC4wMDAzIDI1LjYwODdMMzMuMDUxMiAyNS40NzI0TDMzLjA1MTIgMjUuNDcyM1pNMS4xNDUxIDI1LjYwODdMMy42MTQ4MSAzMy4xNTA3TDEyLjAxMDYgMzEuMDE4N0w4LjA5MzYgMjUuNDcyM0wxLjE0NTEgMjUuNjA4N1oiIGZpbGw9IiNFMjc2MUIiLz48cGF0aCBkPSJNMTEuNjAyMSAxNS44Mjg5TDkuNjMzOTcgMTkuMDMxMkwxNy45OTQ0IDIwLjg5MThMMTcuNzIyIDEyLjA0MUwxMS42MDIxIDE1LjgyODlaTTI5LjU0MzEgMTUuODI4OUwyMy4zNTAyIDExLjkwNDhMMjMuMTUwOCAyMC44OTE4TDMxLjUxMSAxOS4wMzEyTDI5LjU0MzEgMTUuODI4OVoiIGZpbGw9IiNFMjc2MUIiLz48cGF0aCBkPSJNMTIuMDEwNiAzMS4wMTg3TDE3LjQ1NiAyOC42OTQzTDEyLjY5MjUgMjUuNjA4N0wxMi4wMTA2IDMxLjAxODdaTTIzLjY4ODQgMjguNjk0M0wyOS4xMzM5IDMxLjAxODdMMjguNDUyIDI1LjYwODdMMjMuNjg4NCAyOC42OTQzWiIgZmlsbD0iI0UyNzYxQiIvPjxwYXRoIGQ9Ik0yOS4xMzM5IDMxLjAxODdMMjMuNjg4NCAyOC42OTQzTDI0LjA5NzMgMzEuNjk5OEwyNC4wNjA3IDMzLjAxNDdMMjkuMTMzOSAzMS4wMTg3Wk0xMi4wMTA2IDMxLjAxODdMMTcuMDgzOCAzMy4wMTQ3TDE3LjA0NzIgMzEuNjk5OEwxNy40NTYgMjguNjk0M0wxMi4wMTA2IDMxLjAxODdaIiBmaWxsPSIjRDdDMUIzIi8+PHBhdGggZD0iTTE3LjE4MzEgMjMuNDc2NEwxMi41NTYzIDIyLjM5NzlMMTUuNzIzMSAyMS4xNTU3TDE3LjE4MzEgMjMuNDc2NFpNMjMuOTYxNiAyMy40NzY0TDI1LjQyMTUgMjEuMTU1N0wyOC41ODg0IDIyLjM5NzhMMjMuOTYxNiAyMy40NzY0WiIgZmlsbD0iIzIzMzQ0NyIvPjxwYXRoIGQ9Ik0xMi4wMTA2IDMxLjAxODdMMTIuNzI4OSAyNS40NzIzTDguMDkzNiAyNS42MDg3TDEyLjAxMDYgMzEuMDE4N1pNMjguNDE1NCAyNS40NzIzTDI5LjEzMzkgMzEuMDE4N0wzMy4wNTEyIDI1LjYwODdMMjguNDE1NCAyNS40NzIzWk0zMS41MTEgMTkuMDMxMkwyMy4xNTA4IDIwLjg5MThMMjMuOTYxOCAyMy40NzY0TDI1LjQyMTcgMjEuMTU1OEwyOC41ODg2IDIyLjM5NzlMMzEuNTExIDE5LjAzMTJaTTEyLjU1NjMgMjIuMzk3OUwxNS43MjMxIDIxLjE1NThMMTcuMTgzMSAyMy40NzY0TDE3Ljk5NDQgMjAuODkxOEw5LjYzMzk3IDE5LjAzMTJMMTIuNTU2MyAyMi4zOTc5WiIgZmlsbD0iIzIzMzQ0NyIvPjxwYXRoIGQ9Ik05LjYzMzk3IDE5LjAzMTJMMTIuNjkyNSAyNS42MDg3TDEyLjU1NjMgMjIuMzk3OUw5LjYzMzk3IDE5LjAzMTJaTTI4LjU4ODQgMjIuMzk3OEwyOC40NTIgMjUuNjA4N0wzMS41MTEgMTkuMDMxMkwyOC41ODg0IDIyLjM5NzhaIiBmaWxsPSIjQ0Q2MTE2Ii8+PHBhdGggZD0iTTMxLjUxMSAxOS4wMzEyTDI4LjQ1MiAyNS42MDg3TDI4LjQxNTQgMjUuNDcyNEwzMS41MTEgMTkuMDMxMlpNMTIuNTU2MyAyMi4zOTc4TDEyLjcyODkgMjUuNDcyNEw5LjYzMzk3IDE5LjAzMTJMMTIuNTU2MyAyMi4zOTc4WiIgZmlsbD0iIzIzMzQ0NyIvPjxwYXRoIGQ9Ik0xNy4xODMxIDIzLjQ3NjRMMTcuOTk0NCAyMC44OTE4TDE3LjIyMiAxMi4wNDFMMTcuMTgzMSAyMy40NzY0Wk0yMy4xNTA4IDIwLjg5MThMMjMuOTYxNiAyMy40NzY0TDIzLjkyMjkgMTIuMDQxTDIzLjE1MDggMjAuODkxOFoiIGZpbGw9IiNFMjc2MUIiLz48cGF0aCBkPSJNMjMuNzUxOSA1Ljc5MDcyTDIzLjM1MDIgMTEuOTA0OEwyOS41NDMxIDE1LjgyODlMMzcuMTI4MyA3LjY0OTMxTDIzLjc1MTkgNS43OTA3MlpNMTcuMzkyIDUuNzkwNzJMNC4wMTU2MiA3LjY0OTMxTDExLjYwMjEgMTUuODI4OUwxNy43OTM4IDExLjkwNDhMMTcuMzkyIDUuNzkwNzJaTTIzLjk2MTYgMjMuNDc2NEwyOC40MTU0IDI1LjQ3MjNMMjMuOTIyOSAxMi4wNDFMMjMuOTYxNiAyMy40NzY0Wk0xNy4xODMxIDIzLjQ3NjRMMTcuMjIyIDEyLjA0MUwxMi43Mjg5IDI1LjQ3MjNMMTcuMTgzMSAyMy40NzY0WiIgZmlsbD0iI0YxOEYxRCIvPjxwYXRoIGQ9Ik0yMy4zNTAyIDExLjkwNDhMMTcuNzkzOCAxMS45MDQ4TDE3LjIyMiAxMi4wNDFMMTcuOTk0NCAyMC44OTE4TDIzLjE1MDggMjAuODkxOEwyMy45MjI5IDEyLjA0MUwyMy4zNTAyIDExLjkwNDhaIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==');
    }
    
    .wallet-note {
      text-align: center;
      font-size: 0.9rem;
      color: #888;
      margin-top: 0.5rem;
    }
    
    .wallet-note a {
      color: #a259d9;
      text-decoration: none;
    }
    
    .action-buttons {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    
    .btn-primary, .btn-secondary {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      border: none;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .btn-primary {
      background: #a259d9;
      color: white;
    }
    
    .btn-secondary {
      background: rgba(162, 89, 217, 0.2);
      color: #a259d9;
      border: 1px solid #a259d9;
    }
    
    .btn-primary:hover, .btn-secondary:hover {
      transform: translateY(-2px);
    }
    
    .error-message {
      background: rgba(255, 59, 48, 0.1);
      border-left: 4px solid #ff3b30;
      padding: 1rem;
      margin-top: 1.5rem;
      border-radius: 4px;
      color: #ff3b30;
    }
    
    .registration-section {
      width: 100%;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #333;
      text-align: center;
    }
    
    .registration-section p {
      color: #888;
      margin-bottom: 1rem;
    }
    
    .register-btn {
      background: linear-gradient(45deg, #a259d9 0%, #7b2cbf 100%);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(162, 89, 217, 0.3);
    }
    
    .register-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 15px rgba(162, 89, 217, 0.4);
    }
  `]
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

  goToRegister(): void {
    this.router.navigate(['/register']);
  }

  private async checkUserRole(): Promise<void> {
    const user = this.authService.getCurrentUser();
    
    if (user && user.isLoggedIn) {
      // User has a role, redirect to specific dashboard based on role
      const userRole = user.role;
      
      switch(userRole) {
        case UserRole.CITIZEN_ROLE:
          this.router.navigate(['/citizen']);
          break;
        case UserRole.VALIDATOR_ROLE:
          this.router.navigate(['/validator']);
          break;
        case UserRole.TAX_COLLECTOR_ROLE:
          this.router.navigate(['/tax-collector']);
          break;
        case UserRole.PROJECT_MANAGER_ROLE:
          this.router.navigate(['/project-manager']);
          break;
        case UserRole.ADMIN_HEAD_ROLE:
          this.router.navigate(['/admin-head']);
          break;
        case UserRole.ADMIN_GOVT_ROLE:
          this.router.navigate(['/admin-govt']);
          break;
        case UserRole.OWNER_ROLE:
          this.router.navigate(['/owner']);
          break;
        default:
          // If role is not recognized, go to home
          this.router.navigate(['/']);
      }
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
