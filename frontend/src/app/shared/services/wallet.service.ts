import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

// Solana wallet interface for Phantom
// Global window.solana interface is now declared in src/types/global.d.ts

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  connecting: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly _walletState = new BehaviorSubject<WalletState>({
    connected: false,
    publicKey: null,
    connecting: false,
    error: null
  });

  public readonly walletState$ = this._walletState.asObservable();

  constructor() {
    this.initializeWalletListeners();
    this.checkExistingConnection();
  }

  /**
   * Initialize wallet event listeners for account changes and disconnections
   */
  private initializeWalletListeners(): void {
    if (typeof window !== 'undefined' && window.solana) {
      // Listen for account changes
      window.solana.on('accountChanged', (publicKey: any) => {
        if (publicKey) {
          this.updateWalletState({
            connected: true,
            publicKey: publicKey.toString(),
            connecting: false,
            error: null
          });
        } else {
          this.handleDisconnect();
        }
      });

      // Listen for disconnection
      window.solana.on('disconnect', () => {
        this.handleDisconnect();
      });
    }
  }

  /**
   * Check if wallet is already connected on page load
   */
  private checkExistingConnection(): void {
    if (typeof window !== 'undefined' && window.solana?.isConnected && window.solana.publicKey) {
      this.updateWalletState({
        connected: true,
        publicKey: window.solana.publicKey.toString(),
        connecting: false,
        error: null
      });
    }
  }

  /**
   * Connect to Phantom wallet
   */
  public connectWallet(): Observable<string> {
    if (typeof window === 'undefined' || !window.solana) {
      const error = 'Phantom wallet not found. Please install Phantom wallet extension.';
      this.updateWalletState({ ...this._walletState.value, error });
      return throwError(() => new Error(error));
    }

    if (!window.solana.isPhantom) {
      const error = 'Please use Phantom wallet for the best experience.';
      this.updateWalletState({ ...this._walletState.value, error });
      return throwError(() => new Error(error));
    }

    this.updateWalletState({ ...this._walletState.value, connecting: true, error: null });

    return from(window.solana.connect()).pipe(
      map((response) => {
        const publicKey = response.publicKey.toString();
        this.updateWalletState({
          connected: true,
          publicKey,
          connecting: false,
          error: null
        });
        return publicKey;
      }),
      catchError((error) => {
        const errorMsg = error.message || 'Failed to connect wallet';
        this.updateWalletState({
          connected: false,
          publicKey: null,
          connecting: false,
          error: errorMsg
        });
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  /**
   * Disconnect wallet
   */
  public disconnectWallet(): Observable<void> {
    if (typeof window !== 'undefined' && window.solana) {
      return from(window.solana.disconnect()).pipe(
        tap(() => this.handleDisconnect()),
        catchError((error) => {
          console.error('Error disconnecting wallet:', error);
          this.handleDisconnect(); // Force disconnect on error
          return throwError(() => error);
        })
      );
    }
    
    this.handleDisconnect();
    return from(Promise.resolve());
  }

  /**
   * Handle wallet disconnection
   */
  private handleDisconnect(): void {
    this.updateWalletState({
      connected: false,
      publicKey: null,
      connecting: false,
      error: null
    });
  }

  /**
   * Update wallet state
   */
  private updateWalletState(newState: WalletState): void {
    this._walletState.next(newState);
  }

  /**
   * Get current wallet state
   */
  public getCurrentWalletState(): WalletState {
    return this._walletState.value;
  }

  /**
   * Check if wallet is connected
   */
  public isConnected(): boolean {
    return this._walletState.value.connected;
  }

  /**
   * Get current public key
   */
  public getPublicKey(): string | null {
    return this._walletState.value.publicKey;
  }

  /**
   * Clear wallet error
   */
  public clearError(): void {
    this.updateWalletState({ ...this._walletState.value, error: null });
  }
}
