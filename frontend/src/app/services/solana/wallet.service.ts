import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PublicKey } from '@solana/web3.js';

export interface WalletState {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private walletState$ = new BehaviorSubject<WalletState>({
    connected: false,
    connecting: false,
    publicKey: null,
    error: null
  });

  constructor() {
    this.checkWalletConnection();
  }

  get state$(): Observable<WalletState> {
    return this.walletState$.asObservable();
  }

  get isConnected(): boolean {
    return this.walletState$.value.connected;
  }

  get publicKey(): PublicKey | null {
    return this.walletState$.value.publicKey;
  }

  async connect(): Promise<boolean> {
    try {
      this.updateState({ connecting: true, error: null });

      if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Phantom wallet not found. Please install Phantom wallet extension.');
      }

      const response = await window.solana.connect();
      const publicKey = new PublicKey(response.publicKey.toString());

      this.updateState({
        connected: true,
        connecting: false,
        publicKey,
        error: null
      });

      return true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      this.updateState({
        connected: false,
        connecting: false,
        publicKey: null,
        error: error instanceof Error ? error.message : 'Failed to connect wallet'
      });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (window.solana && window.solana.disconnect) {
        await window.solana.disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    } finally {
      this.updateState({
        connected: false,
        connecting: false,
        publicKey: null,
        error: null
      });
    }
  }

  private async checkWalletConnection(): Promise<void> {
    try {
      if (window.solana && window.solana.isConnected && window.solana.publicKey) {
        const publicKey = new PublicKey(window.solana.publicKey.toString());
        this.updateState({
          connected: true,
          connecting: false,
          publicKey,
          error: null
        });
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  }

  private updateState(updates: Partial<WalletState>): void {
    const currentState = this.walletState$.value;
    this.walletState$.next({ ...currentState, ...updates });
  }
}

// Phantom wallet interface
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      isConnected: boolean;
      publicKey?: {
        toString(): string;
      };
      connect(): Promise<{ publicKey: { toString(): string } }>;
      disconnect(): Promise<void>;
      signTransaction?<T>(transaction: T): Promise<T>;
      signAllTransactions?<T>(transactions: T[]): Promise<T[]>;
    };
  }
}
