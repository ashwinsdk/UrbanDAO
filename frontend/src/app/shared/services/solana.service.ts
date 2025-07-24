import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, from, of } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { WalletService } from './wallet.service';
import { AnchorService } from './anchor.service';
import { environment } from '../../../environments/environment';

// Re-export types and constants for easy access
export type { WalletState } from './wallet.service';
// Note: AnchorState is not exported from anchor.service

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
 * Centralized Solana service that orchestrates wallet and Anchor connections
 * This service should be used by all role-specific modules for blockchain interactions
 */
@Injectable({
  providedIn: 'root'
})
export class SolanaService {
  private readonly _connectionState = new BehaviorSubject<SolanaConnectionState>({
    walletConnected: false,
    anchorReady: false,
    publicKey: null,
    programId: environment.solana.programId,
    cluster: environment.solana.cluster,
    error: null,
    loading: false
  });

  public readonly connectionState$ = this._connectionState.asObservable();

  constructor(
    private walletService: WalletService,
    private anchorService: AnchorService
  ) {
    this.initializeConnectionMonitoring();
  }

  /**
   * Monitor wallet and anchor states to provide unified connection status
   */
  private initializeConnectionMonitoring(): void {
    combineLatest([
      this.walletService.walletState$,
      this.anchorService.anchorState$
    ]).subscribe(([walletState, anchorState]) => {
      this._connectionState.next({
        walletConnected: walletState.connected,
        anchorReady: !!anchorState.program, // Simplified check since 'connected' property doesn't exist
        publicKey: walletState.publicKey,
        programId: environment.solana.programId,
        cluster: environment.solana.cluster,
        error: walletState.error || anchorState.error,
        loading: walletState.connecting || anchorState.loading
      });
    });
  }

  /**
   * Connect wallet and initialize Anchor program
   */
  public connect(): Observable<SolanaConnectionState> {
    return this.walletService.connectWallet().pipe(
      switchMap(() => {
        // Get wallet adapter from wallet service
        const walletAdapter = (this.walletService as any).walletAdapter || window.solana;
        return from(this.anchorService.initializeAnchorComponents(walletAdapter));
      }),
      map(() => this._connectionState.value),
      catchError(error => {
        console.error('Failed to connect to Solana:', error);
        return of({
          ...this._connectionState.value,
          error: error.message || 'Failed to connect to Solana'
        });
      })
    );
  }

  /**
   * Disconnect wallet and reset Anchor connection
   */
  public disconnect(): Observable<void> {
    return this.walletService.disconnectWallet().pipe(
      tap(() => {
        // Anchor service will automatically reset when wallet disconnects
        console.log('Disconnected from Solana');
      }),
      catchError(error => {
        console.error('Error during disconnect:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Get the initialized Urban DAO program instance
   * This is the main method that role-specific modules should use
   */
  public getProgram(): any {
    return this.anchorService.getProgram();
  }

  /**
   * Get the Anchor provider for advanced operations
   */
  public getProvider(): any {
    return this.anchorService.getProvider();
  }

  /**
   * Get the Solana connection for direct blockchain queries
   */
  public getConnection(): any {
    return this.anchorService.getConnection();
  }

  /**
   * Get the program IDL for type safety and method discovery
   */
  public getIdl(): any {
    return this.anchorService.getIdl();
  }

  /**
   * Check if everything is ready for blockchain operations
   */
  public isReady(): boolean {
    const state = this._connectionState.value;
    return state.walletConnected && state.anchorReady && !state.error;
  }

  /**
   * Get current connection state
   */
  public getCurrentState(): SolanaConnectionState {
    return this._connectionState.value;
  }

  /**
   * Get current wallet public key
   */
  public getPublicKey(): string | null {
    return this._connectionState.value.publicKey;
  }

  /**
   * Get program ID
   */
  public getProgramId(): string {
    return this._connectionState.value.programId;
  }

  /**
   * Get current cluster
   */
  public getCluster(): string {
    return this._connectionState.value.cluster;
  }

  /**
   * Clear any connection errors
   */
  public clearError(): void {
    this.walletService.clearError();
    this.anchorService.clearError();
  }

  /**
   * Utility method to check if wallet is connected
   */
  public isWalletConnected(): boolean {
    return this._connectionState.value.walletConnected;
  }

  /**
   * Utility method to check if Anchor program is ready
   */
  public isAnchorReady(): boolean {
    return this._connectionState.value.anchorReady;
  }

  /**
   * Get environment configuration
   */
  public getEnvironmentConfig() {
    return environment.solana;
  }
}
