import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { UserRole } from './user-role.enum';

// Interface for registered wallet data
interface RegisteredWallet {
  publicKey: string;
  role: UserRole;
  registeredAt: number;
}

// Storage key for registered wallets
const STORAGE_KEY = 'urbandao_registered_wallets';

// Mock Solana Wallet API
declare global {
    interface Window {
        solana?: {
            isPhantom?: boolean;
            isConnected: boolean;
            publicKey: {
                toString: () => string;
            };
            connect: () => Promise<void>;
        };
    }
}

// --- PLACEHOLDER ---
// This is a mock database of wallet addresses to roles.
// In a real app, this logic would be on your Anchor program.
const MOCK_WALLET_ROLES: Record<string, UserRole> = {
    'FVTUBAwwMY3mpzNmR8QEncdi5HCR3fawxL38svymmnps': UserRole.AdminGovt, // Admin Govt
    'C4ZsZRzr6kCqVXPzGhDXsUaoFuBR1cnFXkwSksCH5xSk': UserRole.AdminHead, // Admin Head
    'phantom3': UserRole.User,
};

// --- END PLACEHOLDER ---

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly _connected = new BehaviorSubject<boolean>(false);
    private readonly _userRole = new BehaviorSubject<UserRole | null>(null);
    private readonly _publicKey = new BehaviorSubject<string | null>(null);
    private readonly _walletError = new BehaviorSubject<string | null>(null);
    private readonly _loading = new BehaviorSubject<boolean>(false);

    /** Observable for the wallet's connection state. */
    public readonly connected$ = this._connected.asObservable();
    /** Observable for the authenticated user's role. */
    public readonly userRole$ = this._userRole.asObservable();
    /** Observable for the wallet's public key. */
    public readonly publicKey$ = this._publicKey.asObservable();
    /** Observable for any wallet connection errors. */
    public readonly walletError$ = this._walletError.asObservable();
    /** Observable for loading state during wallet operations. */
    public readonly loading$ = this._loading.asObservable();

    constructor(private router: Router) {
        // Check if user was previously connected and restore session
        this.checkStoredSession();
    }
    
    /**
     * Checks for a stored session in localStorage and restores it if found
     */
    private checkStoredSession(): void {
        const storedSession = localStorage.getItem('urbandao_session');
        if (storedSession) {
            try {
                const session = JSON.parse(storedSession);
                if (session.publicKey) {
                    this._publicKey.next(session.publicKey);
                    this._connected.next(true);
                    if (session.role) {
                        this._userRole.next(session.role);
                    } else {
                        // If we have a public key but no role, fetch it
                        this.fetchUserRole().subscribe();
                    }
                }
            } catch (e) {
                // Invalid session data, clear it
                localStorage.removeItem('urbandao_session');
            }
        }
    }

    /** Checks if the wallet is currently connected. */
    public isConnected(): boolean {
        return this._connected.getValue();
    }

    /** Gets the current public key if connected */
    public getPublicKey(): string | null {
        return this._publicKey.getValue();
    }

    /** Gets the current user role if available */
    public getUserRole(): UserRole | null {
        return this._userRole.getValue();
    }

    /** Clears any current wallet error */
    public clearError(): void {
        this._walletError.next(null);
    }

    /**
     * Connects to the Solana wallet (Phantom) and fetches the user's role.
     */
    public connectWallet(): Observable<UserRole | null> {
        this._loading.next(true);
        this._walletError.next(null);

        // 1. Check if `window.solana` exists. If not, prompt user to install Phantom.
        if (!window.solana) {
            const errorMsg = 'Phantom wallet not found. Please install the Phantom browser extension.';
            this._walletError.next(errorMsg);
            this._loading.next(false);
            return throwError(() => new Error(errorMsg));
        }

        // 2. Connect to the wallet.
        return from(window.solana.connect()).pipe(
            tap(() => {
                this._connected.next(true);
                const publicKey = window.solana?.publicKey?.toString() || '';
                this._publicKey.next(publicKey);
                
                // Store session data
                localStorage.setItem('urbandao_session', JSON.stringify({
                    publicKey,
                    timestamp: Date.now()
                }));
            }),
            // 3. Fetch the role based on the public key.
            switchMap(() => this.fetchUserRole()),
            tap(role => {
                if (role) {
                    // Update session with role
                    const session = JSON.parse(localStorage.getItem('urbandao_session') || '{}');
                    session.role = role;
                    localStorage.setItem('urbandao_session', JSON.stringify(session));
                }
            }),
            catchError(error => {
                const errorMsg = `Failed to connect wallet: ${error.message || 'Unknown error'}`;
                this._walletError.next(errorMsg);
                this._connected.next(false);
                this._publicKey.next(null);
                localStorage.removeItem('urbandao_session');
                return throwError(() => new Error(errorMsg));
            }),
            tap(() => this._loading.next(false))
        );
    }

    /**
     * Fetches the user's role from local storage or mock database
     * In a real app, this would query your Anchor program
     */
    public fetchUserRole(): Observable<UserRole | null> {
        if (!this.isConnected() || !this._publicKey.getValue()) {
            return of(null);
        }

        const publicKey = this._publicKey.getValue()!;
        this._loading.next(true);

        // First check if this wallet is in our registered wallets
        const registeredWallets = this.getRegisteredWallets();
        const registeredWallet = registeredWallets.find(w => w.publicKey === publicKey);
        
        if (registeredWallet) {
            // If wallet is registered, use its role
            return of(registeredWallet.role).pipe(
                tap(role => {
                    this._userRole.next(role);
                    console.log(`Role found in registered wallets: ${role}`);
                }),
                tap(() => this._loading.next(false))
            );
        }

        // If not registered, check mock database (simulating on-chain lookup)
        console.log(`Fetching role for wallet: ${publicKey}`);
        return timer(500).pipe(
            map(() => {
                // In a real app, this would be a query to your Anchor program
                const role = MOCK_WALLET_ROLES[publicKey] || null;
                
                if (role) {
                    this._userRole.next(role);
                    console.log(`Role found in mock database: ${role}`);
                } else {
                    console.log('No role found for this wallet');
                }
                
                return role;
            }),
            tap(() => this._loading.next(false))
        );
    }
    
    /**
     * Registers a new wallet with the specified role
     * In a real app, this would call your Anchor program
     */
    public registerWallet(role: UserRole): Observable<boolean> {
        if (!this.isConnected() || !this._publicKey.getValue()) {
            return throwError(() => new Error('Wallet not connected'));
        }
        
        const publicKey = this._publicKey.getValue()!;
        this._loading.next(true);
        
        // Check if wallet is already registered
        const registeredWallets = this.getRegisteredWallets();
        if (registeredWallets.some(w => w.publicKey === publicKey)) {
            this._walletError.next('This wallet is already registered');
            this._loading.next(false);
            return throwError(() => new Error('Wallet already registered'));
        }
        
        // In a real app, this would be a transaction to your Anchor program
        return timer(1000).pipe(
            map(() => {
                // Register the wallet locally
                const newWallet: RegisteredWallet = {
                    publicKey,
                    role,
                    registeredAt: Date.now()
                };
                
                registeredWallets.push(newWallet);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(registeredWallets));
                
                // Update current user role
                this._userRole.next(role);
                
                // Update session
                const session = JSON.parse(localStorage.getItem('urbandao_session') || '{}');
                session.role = role;
                localStorage.setItem('urbandao_session', JSON.stringify(session));
                
                console.log(`Wallet registered with role: ${role}`);
                return true;
            }),
            catchError(error => {
                const errorMsg = `Failed to register wallet: ${error.message || 'Unknown error'}`;
                this._walletError.next(errorMsg);
                return throwError(() => new Error(errorMsg));
            }),
            tap(() => this._loading.next(false))
        );
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
}
// NOTE: You'll need to import `from` from `rxjs` for the real implementation. 