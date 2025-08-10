import { Injectable } from '@angular/core';
import { Program, AnchorProvider, Idl, setProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { WalletService } from './wallet.service';
import { environment } from '../../../environments/environment';
import urbanDaoIdl from '../../../idl/urban_dao.json';

// Define the type for our program using the specific IDL structure
type UrbanDaoAccounts = {
  citizen: any;
  head: any;
  government: any;
  state: any;
  grievance: any;
  project: any;
  wardTax: any;
  feedback: any;
};

// Define a more flexible program type that works with Anchor's API
type UrbanDaoProgram = Program<Idl> & {
  account: UrbanDaoAccounts;
};

@Injectable({
  providedIn: 'root'
})
export class AnchorService {
  private connection: Connection;
  private provider: AnchorProvider | null = null;
  private program: UrbanDaoProgram | null = null;
  private programId: PublicKey;

  constructor(private walletService: WalletService) {
    this.connection = new Connection(environment.solana.rpcUrl, 'confirmed');
    this.programId = new PublicKey(environment.solana.programId);
    this.initializeProvider();
  }

  private async initializeProvider(): Promise<void> {
    try {
      // Wait for wallet connection
      this.walletService.state$.subscribe(async (walletState) => {
        if (walletState.connected && walletState.publicKey) {
          await this.setupProgram();
        } else {
          this.provider = null;
          this.program = null;
        }
      });
    } catch (error) {
      console.error('Failed to initialize Anchor provider:', error);
    }
  }

  private async setupProgram(): Promise<void> {
    try {
      if (!this.walletService.publicKey) {
        throw new Error('Wallet not connected');
      }

      // Create a wallet adapter compatible interface
      const wallet = {
        publicKey: this.walletService.publicKey,
        signTransaction: async (tx: any) => {
          if (!window.solana || !window.solana.signTransaction) throw new Error('Phantom wallet not found or signTransaction not available');
          return await window.solana.signTransaction(tx);
        },
        signAllTransactions: async (txs: any[]) => {
          if (!window.solana || !window.solana.signAllTransactions) throw new Error('Phantom wallet not found or signAllTransactions not available');
          return await window.solana.signAllTransactions(txs);
        }
      };

      this.provider = new AnchorProvider(this.connection, wallet, {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed'
      });

      setProvider(this.provider);

      // The proper way to create an Anchor program with correct parameter order
      // Per Anchor docs: new Program(idl, provider) - programId is derived from IDL
      this.program = new Program(
        urbanDaoIdl as unknown as Idl,
        this.provider
      ) as unknown as UrbanDaoProgram;
      
      console.log('Anchor program initialized successfully');
    } catch (error) {
      console.error('Failed to setup Anchor program:', error);
      throw error;
    }
  }

  get isInitialized(): boolean {
    return this.program !== null && this.provider !== null;
  }

  getProgram(): UrbanDaoProgram | null {
    return this.program;
  }

  getProvider(): AnchorProvider | null {
    return this.provider;
  }

  getConnection(): Connection {
    return this.connection;
  }

  getProgramId(): PublicKey {
    return this.programId;
  }

  // PDA Generation Methods
  async generateCitizenPDA(walletPublicKey: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddressSync(
      [Buffer.from('citizen'), walletPublicKey.toBuffer()],
      this.programId
    );
  }

  async generateHeadPDA(walletPublicKey: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddressSync(
      [Buffer.from('head'), walletPublicKey.toBuffer()],
      this.programId
    );
  }

  async generateGovernmentPDA(walletPublicKey: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddressSync(
      [Buffer.from('government'), walletPublicKey.toBuffer()],
      this.programId
    );
  }

  async generateStatePDA(): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddressSync(
      [Buffer.from('state')],
      this.programId
    );
  }

  async generateGrievancePDA(grievanceId: string): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddressSync(
      [Buffer.from('grievance'), Buffer.from(grievanceId)],
      this.programId
    );
  }

  async generateProjectPDA(projectId: string): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddressSync(
      [Buffer.from('project'), Buffer.from(projectId)],
      this.programId
    );
  }

  async generateWardTaxPDA(ward: string, year: number): Promise<[PublicKey, number]> {
    const yearBuffer = Buffer.alloc(4);
    yearBuffer.writeUInt32LE(year, 0);
    
    return await PublicKey.findProgramAddressSync(
      [Buffer.from('ward_tax'), Buffer.from(ward), yearBuffer],
      this.programId
    );
  }

  async generateFeedbackPDA(feedbackId: string): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddressSync(
      [Buffer.from('feedback'), Buffer.from(feedbackId)],
      this.programId
    );
  }
}
