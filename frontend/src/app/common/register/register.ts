import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Subscription } from 'rxjs';
import { UserRole } from '../../auth/user-role.enum';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit, OnDestroy {
  isConnected = false;
  publicKey: string | null = null;
  selectedRole: UserRole = UserRole.User; // Default role
  loading = false;
  error: string | null = null;
  registrationSuccess = false;

  // Define roles for dropdown
  roles = [
    { value: UserRole.User, label: 'Citizen' },
    { value: UserRole.AdminGovt, label: 'Government Officer' },
    { value: UserRole.AdminHead, label: 'Admin Head' }
  ];

  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  get selectedRoleLabel(): string {
    return this.roles.find(r => r.value === this.selectedRole)?.label || 'Unknown Role';
  }

  ngOnInit(): void {
    // Subscribe to auth service observables
    this.subscriptions.push(
      this.authService.connected$.subscribe(connected => {
        this.isConnected = connected;
      })
    );

    this.subscriptions.push(
      this.authService.publicKey$.subscribe(publicKey => {
        this.publicKey = publicKey;
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
      error: (err) => {
        console.error('Wallet connection error:', err);
      }
    });
  }

  registerWallet(): void {
    if (!this.isConnected) {
      this.error = 'Please connect your wallet first';
      return;
    }

    this.error = null;
    this.loading = true;

    this.authService.registerWallet(this.selectedRole).subscribe({
      next: (success) => {
        if (success) {
          this.registrationSuccess = true;
          setTimeout(() => {
            this.authService.navigateToRoleDashboard();
          }, 2000); // Navigate after 2 seconds
        }
      },
      error: (err) => {
        console.error('Registration error:', err);
        this.error = err.message || 'Registration failed';
        this.loading = false;
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
