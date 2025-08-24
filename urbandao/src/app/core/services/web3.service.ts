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
    // Setup network change listeners first
    this.setupNetworkChangeListeners();
    // Then check if wallet is connected
    this.checkIfWalletIsConnected();
  }

  private setupNetworkChangeListeners(): void {
    if (window.ethereum) {
      // Remove any existing listeners to prevent duplicates
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', this.handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', this.handleChainChanged);
      }
      
      // Add listeners
      window.ethereum.on('accountsChanged', this.handleAccountsChanged);
      window.ethereum.on('chainChanged', this.handleChainChanged);
    }
  }
  
  // Handler for accountsChanged to avoid closure issues and prevent recursion
  private handleAccountsChanged = (accounts: string[]): void => {
    if (accounts.length === 0) {
      // User disconnected their wallet
      // Call resetState directly instead of disconnectWallet to prevent recursion
      this.resetState();
    } else {
      // User switched accounts
      this.accountSubject.next(accounts[0]);
    }
  }
  
  // Handler for chainChanged
  private handleChainChanged = (chainIdHex: string): void => {
    const chainId = parseInt(chainIdHex, 16);
    this.networkSubject.next(chainId);
    this.chainIdSubject.next(chainId);
  }

  public async checkIfWalletIsConnected(): Promise<void> {
    try {
      this.loadingSubject.next(true);

      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        
        try {
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0) {
            try {
              // Attempt to get signer with proper error handling (use local ref to avoid races)
              const signer = await provider.getSigner();
              if (!signer) {
                throw new Error('getSigner returned null');
              }
              
              const account = await signer.getAddress();
              const network = await provider.getNetwork();
              const chainId = Number(network.chainId);
              
              // Commit to instance fields only after successful resolution
              this.provider = provider;
              this.signer = signer;
              
              this.accountSubject.next(account);
              this.networkSubject.next(chainId);
              this.chainIdSubject.next(chainId);
              this.connectedSubject.next(true);
              return;
            } catch (signerError) {
              console.error('Error getting signer:', signerError);
              // Fall through to resetState
            }
          }
        } catch (providerError) {
          console.error('Error with provider:', providerError);
          // Fall through to resetState
        }
      } else {
        console.log('No Ethereum wallet detected');
      }
      
      // Reset state if we reach this point (no ethereum, no accounts, or signer error)
      this.resetState();
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
      console.log('Starting wallet connection process');

      if (!window.ethereum) {
        console.error('No Ethereum wallet detected');
        throw new Error('No Ethereum wallet detected. Please install MetaMask or another Ethereum wallet.');
      }

      // Create a new provider instance (local ref to avoid races)
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request accounts access with better error handling
      try {
        console.log('Requesting account access');
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (requestError: any) {
        // Handle user rejection specifically
        if (requestError.code === 4001) {
          console.error('User rejected wallet connection request');
          throw new Error('You rejected the wallet connection request. Please try again and approve the connection.');
        }
        console.error('Wallet connection error:', requestError);
        throw new Error(`Wallet connection error: ${requestError.message || 'Unknown error'}`);
      }
      
      // Check if accounts exist
      console.log('Checking for connected accounts');
      const accounts = await provider.listAccounts();
      if (accounts.length === 0) {
        console.error('No accounts found after requesting access');
        throw new Error('No accounts found after requesting access. Please make sure your wallet is unlocked.');
      }
      
      // Get the connected signer with retry logic
      let signer = null;
      let signerRetries = 0;
      const maxSignerRetries = 3;
      
      while (!signer && signerRetries < maxSignerRetries) {
        try {
          console.log(`Attempting to get signer (attempt ${signerRetries + 1}/${maxSignerRetries})`);
          signer = await provider.getSigner();
          if (!signer) throw new Error('getSigner returned null');
        } catch (signerError) {
          signerRetries++;
          console.error(`Error getting signer (attempt ${signerRetries}/${maxSignerRetries}):`, signerError);
          
          if (signerRetries >= maxSignerRetries) {
            throw new Error('Failed to get signer after multiple attempts. Please refresh the page and try again.');
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      this.signer = signer;
      
      if (!this.signer) {
        console.error('Signer is null after attempting to connect');
        throw new Error('Failed to connect to your wallet. Please refresh the page and try again.');
      }
      
      const account = await this.signer.getAddress();
      console.log(`Connected to wallet with address: ${account}`);
      
      // Get network info
      let network = await provider.getNetwork();
      let chainId = Number(network.chainId);
      console.log(`Connected to network: ${network.name} (chainId: ${chainId})`);
      
      // Switch to the required network if needed
      if (Number(chainId) !== environment.network.chainId) {
        console.log(`Switching from chainId ${chainId} to required chainId ${environment.network.chainId}`);
        try {
          await this.switchToRequiredNetwork();
          // Refresh network and chainId after switch
          network = await provider.getNetwork();
          chainId = Number(network.chainId);
          console.log(`Network switched successfully to chainId: ${chainId}`);
        } catch (switchError: any) {
          console.error('Error switching network:', switchError);
          throw new Error(`Failed to switch to the required network (${environment.network.name}): ${switchError.message || 'Unknown error'}`);
        }
      }
      
      // Verify network after switching
      if (Number(chainId) !== environment.network.chainId) {
        console.error(`Network verification failed. Current: ${chainId}, Required: ${environment.network.chainId}`);
        throw new Error(`You must be connected to the ${environment.network.name} network to use this application.`);
      }
      
      // Commit provider only after successful setup
      this.provider = provider;
      
      this.accountSubject.next(account);
      this.networkSubject.next(chainId);
      this.chainIdSubject.next(chainId);
      this.connectedSubject.next(true);
      
      console.log('Wallet connection process completed successfully');
      return account;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      // Reset state but don't call disconnectWallet to avoid recursion
      this.resetState();
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  public async disconnectWallet(): Promise<void> {
    // Flag to prevent recursion with the accountsChanged event
    const wasConnected = this.connectedSubject.value;
    
    // Reset the state - make sure this happens first before any wallet operations
    // to prevent event handler recursion
    this.resetState();
    
    // Only attempt to disconnect from provider if we were previously connected
    // This prevents multiple disconnection attempts
    if (wasConnected && window.ethereum) {
      try {
        // Some wallets support this explicit disconnect
        if (typeof window.ethereum.disconnect === 'function') {
          await window.ethereum.disconnect();
        }
      } catch (error) {
        console.warn('Error during explicit wallet disconnect:', error);
        // Continue anyway as we've already reset the state
      }
    }
  }

  private resetState(): void {
    // Clear provider and signer references first
    this.provider = null;
    this.signer = null;
    
    // Only update subjects if they need updating (to prevent unnecessary triggers)
    if (this.accountSubject.value !== null) {
      this.accountSubject.next(null);
    }
    
    if (this.networkSubject.value !== null) {
      this.networkSubject.next(null);
    }
    
    if (this.chainIdSubject.value !== null) {
      this.chainIdSubject.next(null);
    }
    
    if (this.connectedSubject.value !== false) {
      this.connectedSubject.next(false);
    }
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
    // Make sure we return null explicitly if signer is not available
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
