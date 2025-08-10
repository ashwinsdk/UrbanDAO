import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { UserRole } from './user-role.enum';
import { BlockchainService, UrbanDAOState } from '../shared/services/blockchain.service';

// Interface for registered wallet data
interface RegisteredWallet {
  publicKey: string;
  role: UserRole;
  registeredAt: number;
}

// Storage key for registered wallets
const STORAGE_KEY = 'urbandao_registered_wallets_v2';

// Real Solana Wallet API integration required
// Using Phantom wallet interface from wallet.service.ts to avoid conflicts

// Default admin addresses for initialization
const DEFAULT_ADMIN_GOVT = 'FVTUBAwwMY3mpzNmR8QEncdi5HCR3fawxL38svymmnps';
const DEFAULT_ADMIN_HEAD = 'C4ZsZRzr6kCqVXPzGhDXsUaoFuBR1cnFXkwSksCH5xSk';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
  private readonly _connected = new BehaviorSubject<boolean>(false);
  private readonly _userRole = new BehaviorSubject<UserRole | null>(null);
  private readonly _publicKey = new BehaviorSubject<string | null>(null);
  private readonly _walletError = new BehaviorSubject<string | null>(null);
  private readonly _loading = new BehaviorSubject<boolean>(false);

  // Public observables
  public readonly connected$ = this._connected.asObservable();
  public readonly userRole$ = this._userRole.asObservable();
  public readonly publicKey$ = this._publicKey.asObservable();
  public readonly walletError$ = this._walletError.asObservable();
  public readonly loading$ = this._loading.asObservable();

  // Current state getters
  get isConnected(): boolean {
    return this._connected.value;
  }

  get currentUserRole(): UserRole | null {
    return this._userRole.value;
  }

  get currentPublicKey(): string | null {
    return this._publicKey.value;
  }

  constructor(
    private router: Router,
    private blockchainService: BlockchainService
  ) {
    this.checkWalletConnection();
    this.setupWalletListeners();
    this.setupBlockchainServiceListeners();
  }

  private async checkWalletConnection(): Promise<void> {
    if (typeof window !== 'undefined' && window.solana?.isConnected) {
      await this.handleWalletConnection();
    }
  }

  private setupWalletListeners(): void {
    if (typeof window !== 'undefined' && window.solana) {
      console.log('Phantom wallet event handling delegated to WalletService');
    }
  }

  private setupBlockchainServiceListeners(): void {
    // Listen to blockchain service errors
    this.blockchainService.error$.subscribe(error => {
      if (error) {
        this._walletError.next(error);
      }
    });
  }

  private async handleWalletConnection(): Promise<void> {
    try {
      if (!window.solana?.publicKey) {
        return;
      }

      const publicKey = window.solana.publicKey.toString();
      this._publicKey.next(publicKey);
      this._connected.next(true);
      this._walletError.next(null);

      // Determine user role from blockchain state
      const role = await this.determineUserRole(publicKey);
      this._userRole.next(role);

    } catch (error) {
      console.error('Error handling wallet connection:', error);
      this._walletError.next('Failed to connect wallet');
    }
  }

  private handleWalletDisconnection(): void {
    this._connected.next(false);
    this._publicKey.next(null);
    this._userRole.next(null);
    this._walletError.next(null);
    this.router.navigate(['/']);
  }

  private async determineUserRole(publicKeyString: string): Promise<UserRole> {
    try {
      // Get the program state to check admin roles
      const state = await this.blockchainService.getState().toPromise();
      
      if (state) {
        // Check if this wallet is the admin govt
        if (state.adminGovt === publicKeyString) {
          return UserRole.AdminGovt;
        }
        
        // Check if this wallet is the admin head
        if (state.adminHead === publicKeyString) {
          return UserRole.AdminHead;
        }
      }

      // Check stored registrations for fallback
      const registeredWallets = this.getRegisteredWallets();
      const existingWallet = registeredWallets.find(w => w.publicKey === publicKeyString);

      if (existingWallet) {
        return existingWallet.role;
      }

      // Check hardcoded defaults for development
      if (publicKeyString === DEFAULT_ADMIN_GOVT) {
        return UserRole.AdminGovt;
      }
      if (publicKeyString === DEFAULT_ADMIN_HEAD) {
        return UserRole.AdminHead;
      }

      // Default to regular user
      return UserRole.User;

    } catch (error) {
      console.error('Error determining user role:', error);
      return UserRole.User;
    }
  }
    
    /**
     * Logs the user out by disconnecting the wallet
     */
    public logout(): void {
        this._connected.next(false);
        this._userRole.next(null);
        this._publicKey.next(null);
        localStorage.removeItem('urbandao_session');
        this.router.navigate(['/']);
    }
    
    /**
     * Navigate to the appropriate homepage based on user role
     */
    public navigateToRoleDashboard(): void {
        const role = this._userRole.getValue();
        if (!role) return;
        
        switch (role) {
            case UserRole.AdminGovt:
                this.router.navigate(['/admin-govt/govt-home']);
                break;
            case UserRole.AdminHead:
                this.router.navigate(['/admin-head/admin-home']);
                break;
            case UserRole.User:
                this.router.navigate(['/user/user-home']);
                break;
            default:
                this.router.navigate(['/']);
        }
    }
    
    /**
     * Helper method to get registered wallets from localStorage
     */
    private getRegisteredWallets(): RegisteredWallet[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to parse registered wallets', e);
            return [];
        }
    }

    private saveRegisteredWallets(wallets: RegisteredWallet[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
    }

    // Utility method to get current blockchain state
    getBlockchainState(): Observable<UrbanDAOState> {
        return this.blockchainService.getState();
    }

    // Clear all errors
    clearError(): void {
        this._walletError.next(null);
    }

    // Additional methods for component compatibility
    getCurrentRole(): UserRole | null {
        return this.currentUserRole;
    }

    getPublicKey(): string | null {
        return this.currentPublicKey;
    }

    // Wallet connection method for components
    connectWallet(): Observable<UserRole | null> {
        return from(this.handleWalletConnection()).pipe(
            map(() => this.currentUserRole),
            catchError(error => {
                console.error('Wallet connection failed:', error);
                this._walletError.next(error.message || 'Wallet connection failed');
                return of(null);
            })
        );
    }

    // Wallet registration method
    registerWallet(role: UserRole): Observable<boolean> {
        if (!this.currentPublicKey) {
            return throwError(() => new Error('No wallet connected'));
        }

        const wallets = this.getRegisteredWallets();
        const existingWallet = wallets.find(w => w.publicKey === this.currentPublicKey);
        
        if (existingWallet) {
            return throwError(() => new Error('Wallet already registered'));
        }

        const newWallet: RegisteredWallet = {
            publicKey: this.currentPublicKey,
            role,
            registeredAt: Date.now()
        };

        wallets.push(newWallet);
        this.saveRegisteredWallets(wallets);
        this._userRole.next(role);

        return of(true);
    }
}