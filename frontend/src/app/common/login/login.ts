import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Subscription } from 'rxjs';
import { UserRole } from '../../auth/user-role.enum';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit, OnDestroy {
  isConnected = false;
  publicKey: string | null = null;
  userRole: UserRole | null = null;
  loading = false;
  error: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Subscribe to auth service observables
    this.subscriptions.push(
      this.authService.connected$.subscribe(connected => {
        this.isConnected = connected;

        // If connected and has role, navigate to dashboard
        if (connected && this.userRole) {
          this.navigateToDashboard();
        }
      })
    );

    this.subscriptions.push(
      this.authService.publicKey$.subscribe(publicKey => {
        this.publicKey = publicKey;
      })
    );

    this.subscriptions.push(
      this.authService.userRole$.subscribe(role => {
        this.userRole = role;

        // If connected and has role, navigate to dashboard
        if (this.isConnected && role) {
          this.navigateToDashboard();
        }
      })
    );

    this.subscriptions.push(
      this.authService.loading$.subscribe(loading => {
        this.loading = loading;
      })
    );

    this.subscriptions.push(
      this.authService.walletError$.subscribe(error => {
        this.error = error;
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  connectWallet(): void {
    this.error = null;

    this.authService.connectWallet().subscribe({
      next: (role) => {
        if (role) {
          this.navigateToDashboard();
        } else {
          this.error = 'No role found for this wallet. Please register first.';
        }
      },
      error: (err) => {
        console.error('Wallet connection error:', err);
      }
    });
  }

  navigateToDashboard(): void {
    this.authService.navigateToRoleDashboard();
  }
}
