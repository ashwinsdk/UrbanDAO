import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { SolanaService, SolanaConnectionState } from '../../shared/services';
import { Subscription, combineLatest, from, throwError, Observable } from 'rxjs';
import { switchMap, catchError, tap, map } from 'rxjs/operators';
import { UserRole } from '../../auth/user-role.enum';

export interface LoginState {
  walletConnected: boolean;
  isConnected: boolean;
  publicKey: string | null;
  userRole: UserRole | null;
  loading: boolean;
  error: string | null;
  registrationChecked: boolean;
  isRegistered: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit, OnDestroy {
  loginState: LoginState = {
    walletConnected: false,
    isConnected: false,
    publicKey: null,
    userRole: null,
    loading: false,
    error: null,
    registrationChecked: false,
    isRegistered: false
  };

  // Expose enum to template
  UserRole = UserRole;
  
  private subscriptions: Subscription[] = [];
  private returnUrl: string = '/';

  // Getter properties for template access
  get userRole() { return this.loginState.userRole; }
  get isConnected() { return this.loginState.isConnected; }
  get publicKey() { return this.loginState.publicKey; }
  get loading() { return this.loginState.loading; }
  get error() { return this.loginState.error; }

  constructor(
    private authService: AuthService,
    private solanaService: SolanaService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Get return URL from query params
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    
    // Subscribe to Solana service for primary authentication state
    this.subscriptions.push(
      this.solanaService.connectionState$.subscribe(state => {
        this.handleSolanaStateChange(state);
      })
    );

    // Fallback to auth service for compatibility
    this.subscriptions.push(
      combineLatest([
        this.authService.connected$,
        this.authService.userRole$,
        this.authService.publicKey$
      ]).subscribe(([connected, role, publicKey]) => {
        // Only use auth service if Solana service is not connected
        if (!this.solanaService.isWalletConnected()) {
          this.loginState.walletConnected = connected;
          this.loginState.userRole = role;
          this.loginState.publicKey = publicKey;
          
          if (connected && role) {
            this.navigateToDashboard();
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Handle Solana connection state changes
   */
  private handleSolanaStateChange(state: SolanaConnectionState): void {
    this.loginState.walletConnected = state.walletConnected;
    this.loginState.isConnected = state.anchorReady;
    this.loginState.publicKey = state.publicKey;
    this.loginState.loading = state.loading;
    this.loginState.error = state.error;

    if (state.walletConnected && state.anchorReady && state.publicKey) {
      this.checkUserRegistration(state.publicKey);
    } else if (state.walletConnected && state.publicKey) {
      // Wallet connected but Anchor not ready
      this.loginState.registrationChecked = true;
      this.loginState.isRegistered = false;
    }
  }

  /**
   * Check if user is registered using Anchor PDA fetch
   */
  private checkUserRegistration(publicKey: string): void {
    if (!this.solanaService.isReady()) {
      console.warn('Solana service not ready for registration check');
      this.loginState.error = 'Blockchain connection not ready';
      return;
    }

    const program = this.solanaService.getProgram();
    if (!program) {
      console.warn('Anchor program not available');
      this.loginState.error = 'Blockchain program not available';
      return;
    }

    this.loginState.loading = true;
    this.loginState.error = null;

    // Perform PDA fetch to check user registration
    this.performRegistrationCheck(publicKey)
      .subscribe({
        next: (registrationData: any) => {
          this.loginState.loading = false;
          this.loginState.registrationChecked = true;
          
          if (registrationData) {
            this.loginState.isRegistered = true;
            this.loginState.userRole = registrationData.role;
            
            // Update auth service with role information
            this.updateAuthServiceState(publicKey, registrationData.role);
            
            // Navigate to dashboard
            this.navigateToDashboard();
          } else {
            this.loginState.isRegistered = false;
            this.loginState.error = 'No account found for this wallet. Please register first.';
          }
        },
        error: (error: any) => {
          console.error('Registration check failed:', error);
          this.loginState.loading = false;
          this.loginState.error = 'Failed to check account registration';
        }
      });
  }

  /**
   * Perform real PDA fetch to check user registration and role
   */
  private performRegistrationCheck(publicKey: string): Observable<{role: UserRole, data: any} | null> {
    const program = this.solanaService.getProgram();
    if (!program) {
      return throwError(() => new Error('Anchor program not available'));
    }

    return from(import('@solana/web3.js')).pipe(
      switchMap(({ PublicKey }) => {
        const userPublicKey = new PublicKey(publicKey);
        
        // Generate PDAs for all role types
        const citizenPDA = PublicKey.findProgramAddressSync(
          [Buffer.from('citizen'), userPublicKey.toBuffer()],
          program.programId
        )[0];
        
        const headPDA = PublicKey.findProgramAddressSync(
          [Buffer.from('head'), userPublicKey.toBuffer()],
          program.programId
        )[0];
        
        const govtPDA = PublicKey.findProgramAddressSync(
          [Buffer.from('govt'), userPublicKey.toBuffer()],
          program.programId
        )[0];
        
        console.log('Checking registration for wallet:', publicKey);
        console.log('Citizen PDA:', citizenPDA.toString());
        console.log('Head PDA:', headPDA.toString());
        console.log('Government PDA:', govtPDA.toString());
        
        // Fetch all account types to check for existing registration
        return from(Promise.all([
          program.account.citizen.fetchNullable(citizenPDA).catch(() => null),
          program.account.head.fetchNullable(headPDA).catch(() => null),
          program.account.government.fetchNullable(govtPDA).catch(() => null)
        ])).pipe(
          map(([citizen, head, govt]: [any, any, any]) => {
            if (citizen) {
              console.log('Found citizen account:', citizen);
              return { role: UserRole.User, data: citizen };
            }
            if (head) {
              console.log('Found head account:', head);
              return { role: UserRole.AdminHead, data: head };
            }
            if (govt) {
              console.log('Found government account:', govt);
              return { role: UserRole.AdminGovt, data: govt };
            }
            console.log('No registration found for wallet:', publicKey);
            return null;
          })
        );
      }),
      catchError(error => {
        console.error('Registration check failed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update auth service with user state for compatibility
   */
  private updateAuthServiceState(publicKey: string, role: UserRole): void {
    // Update the auth service state to maintain compatibility
    // This ensures other components that rely on AuthService still work
    this.authService.registerWallet(role).subscribe({
      next: () => console.log('Auth service state updated'),
      error: (error) => console.warn('Failed to update auth service state:', error)
    });
  }

  /**
   * Connect wallet - triggered by user action
   */
  connectWallet(): void {
    this.loginState.error = null;
    this.loginState.loading = true;
    
    this.solanaService.connect().subscribe({
      next: (state) => {
        console.log('Wallet connected successfully:', state);
        // Registration check will be triggered by state change
      },
      error: (error) => {
        console.error('Wallet connection failed:', error);
        this.loginState.error = error.message || 'Failed to connect wallet';
        this.loginState.loading = false;
      }
    });
  }

  /**
   * Navigate to role-specific dashboard
   */
  navigateToDashboard(): void {
    const role = this.loginState.userRole;
    if (!role) {
      console.warn('No role available for navigation');
      return;
    }

    // Navigate based on role
    switch (role) {
      case UserRole.User:
        this.router.navigate(['/user/user-home']);
        break;
      case UserRole.AdminHead:
        this.router.navigate(['/admin-head/admin-home']);
        break;
      case UserRole.AdminGovt:
        this.router.navigate(['/admin-govt/govt-home']);
        break;
      default:
        this.router.navigate([this.returnUrl]);
    }
  }

  /**
   * Navigate to register page
   */
  goToRegister(): void {
    this.router.navigate(['/register'], {
      queryParams: { returnUrl: this.returnUrl }
    });
  }

  /**
   * Clear error messages
   */
  clearError(): void {
    this.loginState.error = null;
    this.solanaService.clearError();
  }

  /**
   * Get shortened public key for display
   */
  getShortPublicKey(): string {
    const pk = this.loginState.publicKey;
    if (!pk) return '';
    return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
  }
}
