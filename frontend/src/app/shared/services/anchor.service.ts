import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import * as anchor from '@project-serum/anchor';
import { Connection, PublicKey, clusterApiUrl, SystemProgram } from '@solana/web3.js';
import idl from '../../../idl/urban_dao.json';

// Type definitions for our Anchor program accounts
export interface CitizenAccount {
  authority: PublicKey;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
}

export interface HeadAccount {
  authority: PublicKey;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
}

export interface GovernmentAccount {
  authority: PublicKey;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
}

// Define the anchor state interface
interface AnchorState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  connection: Connection | null;
  provider: anchor.AnchorProvider | null;
  program: anchor.Program | null;
}

@Injectable({
  providedIn: 'root'
})
export class AnchorService {
  private readonly stateSubject = new BehaviorSubject<AnchorState>({
    initialized: false,
    loading: false,
    error: null,
    connection: null,
    provider: null,
    program: null
  });

  public readonly anchorState$ = this.stateSubject.asObservable();

  constructor() {}

  /**
   * Initialize Anchor components with wallet provider
   */
  async initializeAnchorComponents(walletAdapter: any): Promise<void> {
    try {
      this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

      // Initialize connection
      const connection = new Connection(environment.solana.rpcUrl, 'confirmed');

      // Create provider with wallet adapter
      const provider = new anchor.AnchorProvider(connection, walletAdapter, {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed'
      });

      // Set the provider globally
      anchor.setProvider(provider);

      // Initialize the program with IDL
      const program = new anchor.Program(idl as any, environment.solana.programId, provider);

      // Store initialized components
      this.stateSubject.next({
        initialized: true,
        loading: false,
        error: null,
        connection,
        provider,
        program
      });

      console.log('Anchor initialization completed successfully');
      console.log('Program ID:', environment.solana.programId);
      console.log('RPC URL:', environment.solana.rpcUrl);
    } catch (error) {
      console.error('Anchor initialization failed:', error);
      this.stateSubject.next({
        ...this.stateSubject.value,
        error: error instanceof Error ? error.message : 'Anchor initialization failed',
        loading: false
      });
      throw error;
    }
  }

  /**
   * Get connection instance
   */
  getConnection(): Connection | null {
    return this.stateSubject.value.connection;
  }

  /**
   * Get the initialized Anchor program
   */
  getProgram(): anchor.Program | null {
    return this.stateSubject.value.program;
  }

  /**
   * Get the Anchor provider
   */
  getProvider(): anchor.AnchorProvider | null {
    return this.stateSubject.value.provider;
  }

  /**
   * Check if Anchor is initialized and ready
   */
  isReady(): boolean {
    const state = this.stateSubject.value;
    return state.initialized && !!state.program && !!state.provider && !!state.connection;
  }

  /**
   * Get current Anchor state
   */
  getCurrentState(): AnchorState {
    return this.stateSubject.value;
  }

  /**
   * Reset Anchor state on wallet disconnect
   */
  resetAnchorState(): void {
    this.stateSubject.next({
      initialized: false,
      loading: false,
      error: null,
      connection: null,
      provider: null,
      program: null
    });
  }

  /**
   * Clear any errors
   */
  clearError(): void {
    this.stateSubject.next({ 
      ...this.stateSubject.value, 
      error: null 
    });
  }

  /**
   * Utility method to get program ID
   */
  getProgramId(): string {
    return environment.solana.programId;
  }

  /**
   * Utility method to get current cluster
   */
  getCluster(): string {
    return environment.solana.cluster;
  }

  /**
   * Get IDL for external use
   */
  getIdl(): any {
    return idl;
  }

  /**
   * Generate PDA for citizen account
   */
  async getCitizenPDA(userPublicKey: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('citizen'), userPublicKey.toBuffer()],
      new PublicKey(environment.solana.programId)
    );
  }

  /**
   * Generate PDA for head account
   */
  async getHeadPDA(userPublicKey: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('head'), userPublicKey.toBuffer()],
      new PublicKey(environment.solana.programId)
    );
  }

  /**
   * Generate PDA for government account
   */
  async getGovernmentPDA(userPublicKey: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('govt'), userPublicKey.toBuffer()],
      new PublicKey(environment.solana.programId)
    );
  }
}
