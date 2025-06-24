import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, of, timer } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { UserRole } from './user-role.enum';

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
    'GovtAddress...': UserRole.AdminGovt,
    'HeadAddress...': UserRole.AdminHead,
    'UserAddress...': UserRole.User,
};
// --- END PLACEHOLDER ---

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly _connected = new BehaviorSubject<boolean>(false);
    private readonly _userRole = new BehaviorSubject<UserRole | null>(null);

    /** Observable for the wallet's connection state. */
    public readonly connected$ = this._connected.asObservable();
    /** Observable for the authenticated user's role. */
    public readonly userRole$ = this._userRole.asObservable();

    constructor() {
        // On instantiation, check the wallet's initial state.
        this._connected.next(window.solana?.isConnected ?? false);
        if (this.isConnected()) {
            this.fetchUserRole().subscribe();
        }
    }

    /** Checks if the wallet is currently connected. */
    public isConnected(): boolean {
        return this._connected.getValue();
    }

    /**
     * --- PLACEHOLDER ---
     * Simulates connecting to the wallet and fetching the user role.
     * Replace this with your actual Solana wallet connection logic.
     */
    public connectWallet(): Observable<UserRole | null> {
        // --- REPLACE WITH REAL SOLANA LOGIC ---
        // 1. Check if `window.solana` exists. If not, prompt user to install Phantom.
        if (!window.solana) {
            alert('Solana wallet (Phantom) not found!');
            return of(null);
        }

        // 2. Connect to the wallet.
        return from(window.solana.connect()).pipe(
            tap(() => this._connected.next(true)),
            // 3. Fetch the role based on the public key.
            switchMap(() => this.fetchUserRole())
        );
        // --- END REPLACE ---
    }

    /**
     * --- PLACEHOLDER ---
     * Fetches the user's role from the (mock) on-chain program.
     * Replace this with a call to your Anchor program.
     */
    public fetchUserRole(): Observable<UserRole | null> {
        if (!this.isConnected() || !window.solana?.publicKey) {
            return of(null);
        }

        const publicKey = window.solana.publicKey.toString();

        // --- REPLACE WITH REAL ANCHOR LOGIC ---
        // This simulates an async call to your program to get the role for a public key.
        console.log(`Fetching role for wallet: ${publicKey}`);
        return timer(500).pipe(
            map(() => {
                const role = MOCK_WALLET_ROLES[publicKey] || UserRole.User; // Default to 'User'
                this._userRole.next(role);
                console.log(`Role found: ${role}`);
                return role;
            })
        );
        // --- END REPLACE ---
    }
}
// NOTE: You'll need to import `from` from `rxjs` for the real implementation. 