import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription, combineLatest, of, Observable } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { SolanaService, SolanaConnectionState } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/user-role.enum';

export interface UserRegistrationStatus {
  isRegistered: boolean;
  role: UserRole | null;
  publicKey: string | null;
  pdaAddress?: string;
  registrationData?: any;
}

export interface DashboardState {
  isAuthenticated: boolean;
  isConnecting: boolean;
  registrationStatus: UserRegistrationStatus;
  error: string | null;
  showRegistrationPrompt: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  // Dashboard state management
  dashboardState: DashboardState = {
    isAuthenticated: false,
    isConnecting: false,
    registrationStatus: {
      isRegistered: false,
      role: null,
      publicKey: null
    },
    error: null,
    showRegistrationPrompt: false
  };

  // Expose enums to template
  UserRole = UserRole;
  
  // Subscription management
  private subscriptions: Subscription[] = [];
  
  // Original features for non-authenticated users
  features = [
    {
      icon: 'receipt',
      title: 'Tax Payment',
      description: 'Securely pay your municipal taxes through our blockchain-powered system, ensuring transparency and immutability of records.',
      link: '/user/pay-tax'
    },
    {
      icon: 'forum',
      title: 'Grievance Filing',
      description: 'Submit and track civic grievances with our transparent system that ensures accountability from municipal authorities.',
      link: '/user/file-grievance'
    },
    {
      icon: 'construction',
      title: 'Project Tracking',
      description: 'Monitor ongoing municipal projects, their budgets, timelines, and progress updates in real-time.',
      link: '/user/view-projects'
    }
  ];

  // Role-specific dashboard features
  roleFeatures = {
    [UserRole.User]: [
      {
        icon: 'receipt',
        title: 'Pay Taxes',
        description: 'Pay municipal taxes securely through blockchain',
        link: '/user/pay-tax'
      },
      {
        icon: 'forum',
        title: 'File Grievance',
        description: 'Submit civic grievances with transparency',
        link: '/user/file-grievance'
      },
      {
        icon: 'visibility',
        title: 'Track Projects',
        description: 'Monitor ongoing municipal projects',
        link: '/user/view-projects'
      },
      {
        icon: 'account_circle',
        title: 'My Profile',
        description: 'Manage your citizen profile and settings',
        link: '/user/profile'
      }
    ],
    [UserRole.AdminHead]: [
      {
        icon: 'dashboard',
        title: 'Admin Dashboard',
        description: 'Overview of municipal operations and metrics',
        link: '/admin-head/admin-home'
      },
      {
        icon: 'assignment',
        title: 'Manage Grievances',
        description: 'Review and process citizen grievances',
        link: '/admin-head/grievances'
      },
      {
        icon: 'engineering',
        title: 'Project Allocation',
        description: 'Allocate and manage municipal projects',
        link: '/admin-head/projects'
      },
      {
        icon: 'people',
        title: 'Citizen Management',
        description: 'Manage citizen registrations and roles',
        link: '/admin-head/citizens'
      }
    ],
    [UserRole.AdminGovt]: [
      {
        icon: 'admin_panel_settings',
        title: 'Government Dashboard',
        description: 'System-wide administration and oversight',
        link: '/admin-govt/govt-home'
      },
      {
        icon: 'account_balance',
        title: 'Fund Management',
        description: 'Allocate and track municipal funds',
        link: '/admin-govt/fund-management'
      },
      {
        icon: 'policy',
        title: 'Policy Management',
        description: 'Create and manage municipal policies',
        link: '/admin-govt/policies'
      },
      {
        icon: 'analytics',
        title: 'System Analytics',
        description: 'View comprehensive system analytics',
        link: '/admin-govt/analytics'
      }
    ]
  };

  constructor(
    private solanaService: SolanaService,
    private authService: AuthService,
    private router: Router
  ) {
    console.log('🏠 Home component constructor called');
    console.log('🏠 Initial dashboardState:', this.dashboardState);
  }

  ngOnInit(): void {
    console.log('🏠 Home component ngOnInit called');
    console.log('🏠 About to initialize authentication...');
    this.initializeAuthentication();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Initialize authentication monitoring and wallet connection
   */
  private initializeAuthentication(): void {
    // Monitor Solana connection state
    this.subscriptions.push(
      this.solanaService.connectionState$.subscribe(state => {
        this.handleConnectionStateChange(state);
      })
    );

    // Monitor auth service state for fallback
    this.subscriptions.push(
      combineLatest([
        this.authService.connected$,
        this.authService.userRole$,
        this.authService.publicKey$
      ]).subscribe(([connected, role, publicKey]) => {
        if (connected && role && publicKey) {
          this.updateRegistrationStatus({
            isRegistered: true,
            role,
            publicKey
          });
        }
      })
    );
  }

  /**
   * Handle Solana connection state changes
   */
  private handleConnectionStateChange(state: SolanaConnectionState): void {
    this.dashboardState.isConnecting = state.loading;
    this.dashboardState.error = state.error;

    if (state.walletConnected && state.anchorReady && state.publicKey) {
      this.dashboardState.isAuthenticated = true;
      this.checkUserRegistration(state.publicKey);
    } else if (state.walletConnected && state.publicKey) {
      // Wallet connected but Anchor not ready
      this.dashboardState.isAuthenticated = true;
      this.updateRegistrationStatus({
        isRegistered: false,
        role: null,
        publicKey: state.publicKey
      });
    } else {
      this.dashboardState.isAuthenticated = false;
      this.resetRegistrationStatus();
    }
  }

  /**
   * Check user registration status using Anchor PDA fetch
   */
  private checkUserRegistration(publicKey: string): void {
    if (!this.solanaService.isReady()) {
      console.warn('Solana service not ready for PDA fetch');
      this.updateRegistrationStatus({
        isRegistered: false,
        role: null,
        publicKey
      });
      return;
    }

    const program = this.solanaService.getProgram();
    if (!program) {
      console.warn('Anchor program not available');
      this.updateRegistrationStatus({
        isRegistered: false,
        role: null,
        publicKey
      });
      return;
    }

    // TODO: Implement actual Anchor PDA fetch calls
    // This is a placeholder that will be replaced with actual Anchor calls
    this.performPDAFetch(publicKey)
      .subscribe({
        next: (registrationData: any) => {
          if (registrationData) {
            this.updateRegistrationStatus({
              isRegistered: true,
              role: registrationData.role,
              publicKey,
              pdaAddress: registrationData.pdaAddress,
              registrationData
            });
            this.redirectToRoleDashboard(registrationData.role);
          } else {
            this.updateRegistrationStatus({
              isRegistered: false,
              role: null,
              publicKey
            });
            this.dashboardState.showRegistrationPrompt = true;
          }
        },
        error: (error: any) => {
          console.error('Failed to fetch user registration:', error);
          this.dashboardState.error = 'Failed to check registration status';
          this.updateRegistrationStatus({
            isRegistered: false,
            role: null,
            publicKey
          });
        }
      });
  }

  /**
   * Perform PDA fetch to check user registration
   * TODO: Replace with actual Anchor program calls
   */
  private performPDAFetch(publicKey: string): Observable<{role: UserRole, pdaAddress: string, data: any} | null> {
    // Placeholder implementation - replace with actual Anchor PDA fetch
    /*
    const program = this.solanaService.getProgram();
    const connection = this.solanaService.getConnection();
    
    // Example PDA derivation for different roles
    const citizenPDA = PublicKey.findProgramAddressSync(
      [Buffer.from('citizen'), new PublicKey(publicKey).toBuffer()],
      program.programId
    )[0];
    
    const headPDA = PublicKey.findProgramAddressSync(
      [Buffer.from('head'), new PublicKey(publicKey).toBuffer()],
      program.programId
    )[0];
    
    const govtPDA = PublicKey.findProgramAddressSync(
      [Buffer.from('govt'), new PublicKey(publicKey).toBuffer()],
      program.programId
    )[0];
    
    // Try to fetch each PDA to determine role
    return from(Promise.all([
      program.account.citizen.fetchNullable(citizenPDA),
      program.account.head.fetchNullable(headPDA),
      program.account.government.fetchNullable(govtPDA)
    ])).pipe(
      map(([citizen, head, govt]) => {
        if (citizen) return { role: UserRole.User, pdaAddress: citizenPDA.toString(), data: citizen };
        if (head) return { role: UserRole.AdminHead, pdaAddress: headPDA.toString(), data: head };
        if (govt) return { role: UserRole.AdminGovt, pdaAddress: govtPDA.toString(), data: govt };
        return null;
      })
    );
    */
    
    // Mock implementation for now
    return of(null).pipe(
      tap(() => console.log('PDA fetch not yet implemented - using mock data')),
      catchError(error => {
        console.error('PDA fetch error:', error);
        return of(null);
      })
    );
  }

  /**
   * Update registration status
   */
  private updateRegistrationStatus(status: UserRegistrationStatus): void {
    this.dashboardState.registrationStatus = status;
  }

  /**
   * Reset registration status
   */
  private resetRegistrationStatus(): void {
    this.dashboardState.registrationStatus = {
      isRegistered: false,
      role: null,
      publicKey: null
    };
    this.dashboardState.showRegistrationPrompt = false;
  }

  /**
   * Redirect to appropriate role-based dashboard
   */
  private redirectToRoleDashboard(role: UserRole): void {
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
        console.warn('Unknown role for redirection:', role);
    }
  }

  /**
   * Connect wallet - triggered by user action
   */
  connectWallet(): void {
    this.dashboardState.isConnecting = true;
    this.dashboardState.error = null;
    
    this.solanaService.connect().subscribe({
      next: (state) => {
        console.log('Wallet connected successfully:', state);
      },
      error: (error) => {
        console.error('Wallet connection failed:', error);
        this.dashboardState.error = error.message || 'Failed to connect wallet';
        this.dashboardState.isConnecting = false;
      }
    });
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet(): void {
    this.solanaService.disconnect().subscribe({
      next: () => {
        console.log('Wallet disconnected successfully');
        this.resetRegistrationStatus();
      },
      error: (error) => {
        console.error('Wallet disconnection failed:', error);
      }
    });
  }

  /**
   * Navigate to registration for specific role
   */
  registerAsRole(role: UserRole): void {
    this.router.navigate(['/register'], { 
      queryParams: { role: role, returnUrl: this.router.url } 
    });
  }

  /**
   * Clear error messages
   */
  clearError(): void {
    this.dashboardState.error = null;
    this.solanaService.clearError();
  }

  /**
   * Get features for current user role
   */
  getCurrentRoleFeatures() {
    const role = this.dashboardState.registrationStatus.role;
    return role ? this.roleFeatures[role] : [];
  }

  /**
   * Check if user is authenticated and registered
   */
  isUserReady(): boolean {
    return this.dashboardState.isAuthenticated && 
           this.dashboardState.registrationStatus.isRegistered;
  }

  /**
   * Get shortened public key for display
   */
  getShortPublicKey(): string {
    const pk = this.dashboardState.registrationStatus.publicKey;
    if (!pk) return '';
    return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
  }
}
