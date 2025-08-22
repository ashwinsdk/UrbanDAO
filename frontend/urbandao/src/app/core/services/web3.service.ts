import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { ethers } from 'ethers';
import { environment } from '../../../environments/environment';
import { UserRole } from '../models/role.model';

@Injectable({
  providedIn: 'root'
})
export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;

  private accountSubject = new BehaviorSubject<string | null>(null);
  private networkSubject = new BehaviorSubject<number | null>(null);
  private chainIdSubject = new BehaviorSubject<number | null>(null);
  private connectedSubject = new BehaviorSubject<boolean>(false);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public account$ = this.accountSubject.asObservable();
  public network$ = this.networkSubject.asObservable();
  public chainId$ = this.chainIdSubject.asObservable();
  public connected$ = this.connectedSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.checkIfWalletIsConnected();
    this.setupNetworkChangeListeners();
  }

  private setupNetworkChangeListeners(): void {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          this.disconnectWallet();
        } else {
          // User switched accounts
          this.accountSubject.next(accounts[0]);
        }
      });

      window.ethereum.on('chainChanged', (chainIdHex: string) => {
        const chainId = parseInt(chainIdHex, 16);
        this.networkSubject.next(chainId);
        this.chainIdSubject.next(chainId);
      });
    }
  }

  public async checkIfWalletIsConnected(): Promise<void> {
    try {
      this.loadingSubject.next(true);

      if (window.ethereum) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
        
        const accounts = await this.provider.listAccounts();
        
        if (accounts.length > 0) {
          this.signer = await this.provider.getSigner();
          const account = await this.signer.getAddress();
          const network = await this.provider.getNetwork();
          const chainId = network.chainId;
          
          this.accountSubject.next(account);
          this.networkSubject.next(Number(chainId));
          this.chainIdSubject.next(Number(chainId));
          this.connectedSubject.next(true);
        } else {
          this.resetState();
        }
      } else {
        console.log('No Ethereum wallet detected');
        this.resetState();
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      this.resetState();
    } finally {
      this.loadingSubject.next(false);
    }
  }

  public async connectWallet(): Promise<string> {
    try {
      this.loadingSubject.next(true);

      if (!window.ethereum) {
        throw new Error('No Ethereum wallet detected');
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request accounts access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Get the connected signer
      this.signer = await this.provider.getSigner();
      const account = await this.signer.getAddress();
      
      // Get network info
      const network = await this.provider.getNetwork();
      const chainId = network.chainId;
      
      // Switch to the required network if needed
      if (Number(chainId) !== environment.network.chainId) {
        await this.switchToRequiredNetwork();
      }
      
      this.accountSubject.next(account);
      this.networkSubject.next(Number(chainId));
      this.chainIdSubject.next(Number(chainId));
      this.connectedSubject.next(true);
      
      return account;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      this.resetState();
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  public async disconnectWallet(): Promise<void> {
    this.resetState();
  }

  private resetState(): void {
    this.provider = null;
    this.signer = null;
    this.accountSubject.next(null);
    this.networkSubject.next(null);
    this.chainIdSubject.next(null);
    this.connectedSubject.next(false);
  }

  private async switchToRequiredNetwork(): Promise<void> {
    if (!window.ethereum) return;

    const requiredChainId = environment.network.chainId;
    const hexChainId = '0x' + requiredChainId.toString(16);

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }]
      });
    } catch (error: any) {
      // If the chain is not added yet, add it
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hexChainId,
            chainName: environment.network.name,
            nativeCurrency: {
              name: environment.network.currency,
              symbol: environment.network.currency,
              decimals: 18
            },
            rpcUrls: [environment.network.rpcUrl],
            blockExplorerUrls: [environment.network.blockExplorer]
          }]
        });
      } else {
        throw error;
      }
    }
  }

  public getProvider(): ethers.BrowserProvider | null {
    return this.provider;
  }

  public getSigner(): ethers.JsonRpcSigner | null {
    return this.signer;
  }

  public getAccount(): string | null {
    return this.accountSubject.value;
  }

  public isConnected(): boolean {
    return this.connectedSubject.value;
  }

  public getCurrentChainId(): number | null {
    return this.chainIdSubject.value;
  }

  public isCorrectNetwork(): boolean {
    const currentChainId = this.chainIdSubject.value;
    return currentChainId === environment.network.chainId;
  }

  // Alias for connectWallet to maintain compatibility
  public async connect(): Promise<string> {
    return this.connectWallet();
  }

  public async signMessage(message: string): Promise<string | null> {
    try {
      if (!this.signer) {
        await this.connectWallet();
        if (!this.signer) throw new Error('No signer available');
      }
      
      return await this.signer.signMessage(message);
    } catch (error) {
      console.error('Error signing message:', error);
      return null;
    }
  }
}

// Add Ethereum window type
declare global {
  interface Window {
    ethereum: any;
  }
}
