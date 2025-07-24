import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { SolanaService, SolanaConnectionState } from '../../shared/services';
import { Subscription, combineLatest, of, Observable, from, throwError } from 'rxjs';
import { switchMap, catchError, tap, map } from 'rxjs/operators';
import { UserRole } from '../../auth/user-role.enum';

export interface RegistrationState {
  walletConnected: boolean;
  anchorReady: boolean;
  publicKey: string | null;
  selectedRole: UserRole;
  loading: boolean;
  error: string | null;
  registrationSuccess: boolean;
  duplicateCheck: boolean;
  isAlreadyRegistered: boolean;
  existingRole?: UserRole;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit, OnDestroy {
  registrationState: RegistrationState = {
    walletConnected: false,
    anchorReady: false,
    publicKey: null,
    selectedRole: UserRole.User,
    loading: false,
    error: null,
    registrationSuccess: false,
    duplicateCheck: false,
    isAlreadyRegistered: false
  };

  // Define roles for dropdown
  roles = [
    { value: UserRole.User, label: 'Citizen', description: 'Access civic services, pay taxes, file grievances' },
    { value: UserRole.AdminHead, label: 'Municipal Head', description: 'Manage grievances, allocate projects, oversee operations' },
    { value: UserRole.AdminGovt, label: 'Government Officer', description: 'System administration, fund management, policy oversight' }
  ];

  // Expose enum to template
  UserRole = UserRole;
  
  private subscriptions: Subscription[] = [];
  private solanaConnectionSubscription?: Subscription;

  // Getter properties for template access
  get selectedRole() { return this.registrationState.selectedRole; }
  set selectedRole(value: UserRole) { this.registrationState.selectedRole = value; }
  get loading() { return this.registrationState.loading; }
  get error() { return this.registrationState.error; }
  get registrationSuccess() { return this.registrationState.registrationSuccess; }
  get isConnected() { return this.registrationState.walletConnected; }
  get publicKey() { return this.registrationState.publicKey; }

  private returnUrl: string = '/';

  constructor(
    private authService: AuthService,
    private solanaService: SolanaService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  get selectedRoleLabel(): string {
    return this.roles.find(r => r.value === this.registrationState.selectedRole)?.label || 'Unknown Role';
  }

  get selectedRoleDescription(): string {
    return this.roles.find(r => r.value === this.registrationState.selectedRole)?.description || '';
  }

  ngOnInit(): void {
    // Get return URL and role from query params
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    const roleParam = this.route.snapshot.queryParams['role'];
    if (roleParam && Object.values(UserRole).includes(roleParam)) {
      this.registrationState.selectedRole = roleParam;
    }
    
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
        this.authService.publicKey$
      ]).subscribe(([connected, publicKey]) => {
        // Only use auth service if Solana service is not connected
        if (!this.solanaService.isWalletConnected()) {
          this.registrationState.walletConnected = connected;
          this.registrationState.publicKey = publicKey;
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
    this.registrationState.walletConnected = state.walletConnected;
    this.registrationState.anchorReady = state.anchorReady;
    this.registrationState.publicKey = state.publicKey;
    this.registrationState.loading = state.loading;
    this.registrationState.error = state.error;

    if (state.walletConnected && state.anchorReady && state.publicKey) {
      this.checkExistingRegistration(state.publicKey);
    } else if (state.walletConnected && state.publicKey) {
      // Wallet connected but Anchor not ready
      this.registrationState.duplicateCheck = true;
      this.registrationState.isAlreadyRegistered = false;
    }
  }

  /**
   * Check if user is already registered to prevent duplicates
   */
  private checkExistingRegistration(publicKey: string): void {
    if (!this.solanaService.isReady()) {
      console.warn('Solana service not ready for duplicate check');
      this.registrationState.error = 'Blockchain connection not ready';
      return;
    }

    const program = this.solanaService.getProgram();
    if (!program) {
      console.warn('Anchor program not available');
      this.registrationState.error = 'Blockchain program not available';
      return;
    }

    this.registrationState.loading = true;
    this.registrationState.error = null;

    // Check for existing registration
    this.performDuplicateCheck(publicKey)
      .subscribe({
        next: (existingData: any) => {
          this.registrationState.loading = false;
          this.registrationState.duplicateCheck = true;
          
          if (existingData) {
            this.registrationState.isAlreadyRegistered = true;
            this.registrationState.existingRole = existingData.role;
            this.registrationState.error = `This wallet is already registered as ${existingData.role}. Please use the login page instead.`;
          } else {
            this.registrationState.isAlreadyRegistered = false;
          }
        },
        error: (error: any) => {
          console.error('Duplicate check failed:', error);
          this.registrationState.loading = false;
          this.registrationState.error = 'Failed to check existing registration';
        }
      });
  }

  /**
   * Perform duplicate registration check using real Anchor PDA fetch
   */
  private performDuplicateCheck(publicKey: string): Observable<{role: UserRole, pdaAddress: string, data: any} | null> {
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
        
        // Fetch all account types to check for existing registration
        return from(Promise.all([
          program.account.citizen.fetchNullable(citizenPDA).catch(() => null),
          program.account.head.fetchNullable(headPDA).catch(() => null),
          program.account.government.fetchNullable(govtPDA).catch(() => null)
        ])).pipe(
          map(([citizen, head, govt]) => {
            if (citizen) {
              console.log('Found existing citizen account:', citizen);
              return { role: UserRole.User, pdaAddress: citizenPDA.toString(), data: citizen };
            }
            if (head) {
              console.log('Found existing head account:', head);
              return { role: UserRole.AdminHead, pdaAddress: headPDA.toString(), data: head };
            }
            if (govt) {
              console.log('Found existing government account:', govt);
              return { role: UserRole.AdminGovt, pdaAddress: govtPDA.toString(), data: govt };
            }
            console.log('No existing registration found for wallet:', publicKey);
            return null;
          })
        );
      }),
      catchError(error => {
        console.error('Duplicate check failed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Connect wallet - triggered by user action
   */
  connectWallet(): void {
    this.registrationState.error = null;
    this.registrationState.loading = true;
    
    this.solanaService.connect().subscribe({
      next: (state) => {
        console.log('Wallet connected successfully:', state);
        // Duplicate check will be triggered by state change
      },
      error: (error: any) => {
        console.error('Wallet connection failed:', error);
        this.registrationState.error = error.message || 'Failed to connect wallet';
        this.registrationState.loading = false;
      }
    });
  }

  /**
   * Register wallet with selected role using Anchor program
   */
  registerWallet(): void {
    if (!this.registrationState.walletConnected) {
      this.registrationState.error = 'Please connect your wallet first';
      return;
    }

    if (this.registrationState.isAlreadyRegistered) {
      this.registrationState.error = 'This wallet is already registered. Please use the login page.';
      return;
    }

    if (!this.solanaService.isReady()) {
      this.registrationState.error = 'Blockchain connection not ready. Please try again.';
      return;
    }

    this.registrationState.error = null;
    this.registrationState.loading = true;

    // Perform Anchor-based registration
    this.performAnchorRegistration(this.registrationState.publicKey!, this.registrationState.selectedRole)
      .subscribe({
        next: (success: boolean) => {
          this.registrationState.loading = false;
          
          if (success) {
            this.registrationState.registrationSuccess = true;
            
            // Update auth service with role information for compatibility
            this.updateAuthServiceState(this.registrationState.publicKey!, this.registrationState.selectedRole);
            
            // Navigate to dashboard after success message
            setTimeout(() => {
              this.navigateToRoleDashboard();
            }, 2000);
          } else {
            this.registrationState.error = 'Registration failed. Please try again.';
          }
        },
        error: (error: any) => {
          console.error('Registration error:', error);
          this.registrationState.loading = false;
          this.registrationState.error = error.message || 'Registration failed';
        }
      });
  }

  /**
   * Perform real Anchor-based registration using appropriate instruction
   */
  private performAnchorRegistration(publicKey: string, role: UserRole): Observable<boolean> {
    const program = this.solanaService.getProgram();
    const provider = this.solanaService.getProvider();
    
    if (!program || !provider) {
      return throwError(() => new Error('Anchor program or provider not available'));
    }

    return from(import('@solana/web3.js')).pipe(
      switchMap(({ PublicKey, SystemProgram }) => {
        const userPublicKey = new PublicKey(publicKey);
        
        // Perform registration based on selected role
        switch (role) {
          case UserRole.User:
            return this.registerCitizen(program, userPublicKey, SystemProgram);
          case UserRole.AdminHead:
            return this.registerHead(program, userPublicKey, SystemProgram);
          case UserRole.AdminGovt:
            return this.registerGovernment(program, userPublicKey, SystemProgram);
          default:
            return throwError(() => new Error('Invalid role for registration'));
        }
      }),
      map(() => {
        console.log(`Successfully registered wallet ${publicKey} as ${role}`);
        return true;
      }),
      catchError(error => {
        console.error('Anchor registration failed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Register as Citizen using Anchor program
   */
  private registerCitizen(program: any, userPublicKey: any, SystemProgram: any): Observable<string> {
    return from(import('@solana/web3.js') as Promise<any>).pipe(
      switchMap(({ PublicKey }) => {
        const citizenPDA = PublicKey.findProgramAddressSync(
          [Buffer.from('citizen'), userPublicKey.toBuffer()],
          program.programId
        )[0];
        
        console.log('Registering citizen with PDA:', citizenPDA.toString());
        
        return from(program.methods
          .initializeCitizen()
          .accounts({
            citizen: citizenPDA,
            user: userPublicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc() as Promise<string>
        );
      })
    );
  }

  /**
   * Register as Head using Anchor program
   */
  private registerHead(program: any, userPublicKey: any, SystemProgram: any): Observable<string> {
    return from(import('@solana/web3.js') as Promise<any>).pipe(
      switchMap(({ PublicKey }) => {
        const headPDA = PublicKey.findProgramAddressSync(
          [Buffer.from('head'), userPublicKey.toBuffer()],
          program.programId
        )[0];
        
        console.log('Registering head with PDA:', headPDA.toString());
        
        return from(program.methods
          .initializeHead()
          .accounts({
            head: headPDA,
            user: userPublicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc() as Promise<string>
        );
      })
    );
  }

  /**
   * Register as Government using Anchor program
   */
  private registerGovernment(program: any, userPublicKey: any, SystemProgram: any): Observable<string> {
    return from(import('@solana/web3.js') as Promise<any>).pipe(
      switchMap(({ PublicKey }) => {
        const govtPDA = PublicKey.findProgramAddressSync(
          [Buffer.from('govt'), userPublicKey.toBuffer()],
          program.programId
        )[0];
        
        console.log('Registering government with PDA:', govtPDA.toString());
        
        return from(program.methods
          .initializeGovernment()
          .accounts({
            government: govtPDA,
            user: userPublicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc() as Promise<string>
        );
      })
    );
  }

  /**
   * Update auth service with user state for compatibility
   */
  private updateAuthServiceState(publicKey: string, role: UserRole): void {
    this.authService.registerWallet(role).subscribe({
      next: () => console.log('Auth service state updated after registration'),
      error: (error: any) => console.warn('Failed to update auth service state:', error)
    });
  }

  /**
   * Navigate to role-specific dashboard
   */
  private navigateToRoleDashboard(): void {
    const role = this.registrationState.selectedRole;
    
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
   * Navigate to login page
   */
  goToLogin(): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.returnUrl }
    });
  }

  /**
   * Update selected role
   */
  selectRole(role: UserRole): void {
    this.registrationState.selectedRole = role;
  }

  /**
   * Clear error messages
   */
  clearError(): void {
    this.registrationState.error = null;
    this.solanaService.clearError();
  }

  /**
   * Get shortened public key for display
   */
  getShortPublicKey(): string {
    const pk = this.registrationState.publicKey;
    if (!pk) return '';
    return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
  }

  /**
   * Check if registration is ready
   */
  canRegister(): boolean {
    return this.registrationState.walletConnected && 
           this.registrationState.duplicateCheck && 
           !this.registrationState.isAlreadyRegistered && 
           !this.registrationState.loading;
  }
}
