import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

export interface SolanaConnectionState {
  walletConnected: boolean;
  anchorReady: boolean;
  publicKey: string | null;
  programId: string;
  cluster: string;
  error: string | null;
  loading: boolean;
}

/**
 * MOCK Solana service for testing lazy loading issues
 * This replaces the real SolanaService to isolate routing problems
 */
@Injectable({
  providedIn: 'root'
})
export class SolanaServiceMock {
  private readonly _connectionState = new BehaviorSubject<SolanaConnectionState>({
    walletConnected: false,
    anchorReady: false,
    publicKey: null,
    programId: 'HLnt2dR9sUSYsogSPp7BA3ca4E6JfqgT8YLA77uTwNVt',
    cluster: 'devnet',
    error: null,
    loading: false
  });

  public readonly connectionState$ = this._connectionState.asObservable();

  // Mock methods that return safe defaults
  connectWallet(): Observable<string> {
    console.log('🧪 Mock SolanaService: connectWallet called');
    return of('mock-public-key');
  }

  disconnectWallet(): Observable<void> {
    console.log('🧪 Mock SolanaService: disconnectWallet called');
    return of(undefined);
  }

  getPublicKey(): string | null {
    console.log('🧪 Mock SolanaService: getPublicKey called');
    return 'mock-public-key';
  }

  isConnected(): boolean {
    console.log('🧪 Mock SolanaService: isConnected called');
    return false;
  }

  // Add other methods as needed with mock implementations
  getCurrentState(): SolanaConnectionState {
    return this._connectionState.value;
  }
}
