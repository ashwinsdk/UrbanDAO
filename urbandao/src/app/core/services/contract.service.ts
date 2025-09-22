import { Injectable } from '@angular/core';
import { UserRole } from '../models/role.model';
import { ethers } from 'ethers';
import { Web3Service } from './web3.service';
import { environment } from '../../../environments/environment';
import { BehaviorSubject } from 'rxjs';

// Import ABIs for contracts
import urbanCoreABI from '../abis/UrbanCore.json';
import urbanTokenABI from '../abis/UrbanToken.json';
import grievanceHubABI from '../abis/GrievanceHub.json';
import projectRegistryABI from '../abis/ProjectRegistry.json';
import taxModuleABI from '../abis/TaxModule.json';
import metaForwarderABI from '../abis/MetaForwarder.json';

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  // Contract objects
  private urbanCoreContract: ethers.Contract | null = null;
  private urbanTokenContract: ethers.Contract | null = null;
  private grievanceHubContract: ethers.Contract | null = null;
  private projectRegistryContract: ethers.Contract | null = null;
  private taxModuleContract: ethers.Contract | null = null;
  private metaForwarderContract: ethers.Contract | null = null;
  
  // Contract initialization status
  private contractsInitialized = false;
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Prevent concurrent initializations from racing
  private initPromise: Promise<boolean> | null = null;

  constructor(private web3Service: Web3Service) {
    // Subscribe to connection status changes
    this.web3Service.connected$.subscribe(connected => {
      if (connected) {
        // Avoid unhandled promise rejections
        void this.initContracts().catch(err => console.error('Contract init error:', err));
      } else {
        this.resetContracts();
      }
    });
    
    // Check immediately if already connected - helps with page refresh scenarios
    if (this.web3Service.isConnected()) {
      void this.initContracts().catch(err => console.error('Initial contract init error:', err));
    }
    
    // Re-init contracts on chain changes when connected and on the correct network
    this.web3Service.chainId$.subscribe(chainId => {
      if (this.web3Service.isConnected() && chainId === environment.network.chainId) {
        void this.initContracts().catch(err => console.error('Contract re-init error after network change:', err));
      }
    });
  }

  /**
   * Try to decode a custom error from a revert using known interfaces.
   */
  private decodeCustomError(err: any): string | null {
    try {
      const data: string | undefined = err?.data || err?.error?.data;
      if (!data || typeof data !== 'string' || !data.startsWith('0x')) return null;
      const interfaces: any[] = [];
      if (this.urbanCoreContract?.interface) interfaces.push(this.urbanCoreContract.interface);
      if (this.metaForwarderContract?.interface) interfaces.push(this.metaForwarderContract.interface);
      if (this.projectRegistryContract?.interface) interfaces.push(this.projectRegistryContract.interface);
      if (this.taxModuleContract?.interface) interfaces.push(this.taxModuleContract.interface);
      for (const iface of interfaces) {
        try {
          const parsed = iface.parseError(data);
          if (parsed) {
            const name = parsed.name || 'UnknownError';
            const args = parsed.args ? Array.from(parsed.args).map((a: any) => String(a)) : [];
            // Map known errors to friendly text
            if (name === 'NotAreaValidator') {
              const caller = args[0];
              const areaId = args[1];
              return `NotAreaValidator: ${caller} is not the validator for area ${areaId}.`;
            }
            if (name === 'CitizenRequestNotFound') {
              const citizen = args[0];
              return `CitizenRequestNotFound: No pending request found for ${citizen}.`;
            }
            if (name === 'CitizenAlreadyApproved') {
              const citizen = args[0];
              return `CitizenAlreadyApproved: ${citizen} is already approved.`;
            }
            if (name === 'AddressAlreadyHasRole') {
              const account = args[0];
              return `AddressAlreadyHasRole: ${account} already has this role.`;
            }
            return `${name}(${args.join(', ')})`;
          }
        } catch {}
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a given target contract trusts our configured forwarder.
   * Falls back to false if target does not expose isTrustedForwarder(address).
   */
  public async isTrustedForwarderFor(targetAddress: string): Promise<boolean> {
    try {
      const forwarder = environment.contracts.MetaForwarder;
      if (!forwarder || !targetAddress) return false;
      const provider = this.web3Service.getProvider();
      if (!provider) return false;
      // Minimal ABI for isTrustedForwarder(address)
      const minimalAbi = [
        'function isTrustedForwarder(address) view returns (bool)'
      ];
      const target = new ethers.Contract(targetAddress, minimalAbi, provider);
      const res = await target['isTrustedForwarder'](forwarder).catch(() => false);
      return Boolean(res);
    } catch (e) {
      console.warn('isTrustedForwarderFor check failed:', e);
      return false;
    }
  }

  public async initContracts(): Promise<boolean> {
    // Don't try to initialize contracts if they are already initialized
    if (this.contractsInitialized) {
      // Even if contracts are initialized, check for pending transactions
      void this.checkPendingTransactions();
      return true;
    }
    
    // Initialize contracts first, then check for pending transactions
    const initResult = await this._initContracts();
    if (initResult) {
      this.checkPendingTransactions();
    }
    return initResult;
  }
  
  /**
   * Check for pending meta transactions from previous sessions
   * This helps recover transaction status after page refreshes
   */
  private async checkPendingTransactions(): Promise<void> {
    try {
      // Get stored transaction data
      const pendingTxHash = localStorage.getItem('pendingMetaTxHash');
      const pendingTxTimestamp = localStorage.getItem('pendingMetaTxTimestamp');
      const lastTxHash = localStorage.getItem('lastMetaTxHash');
      
      console.log('Checking for pending transactions on startup');
      
      // Check if we have a pending transaction that might need verification
      if (pendingTxHash && pendingTxTimestamp) {
        console.log('Found pending transaction:', pendingTxHash);
        
        // Check if this pending transaction is recent (less than 10 minutes old)
        const txTime = parseInt(pendingTxTimestamp);
        const currentTime = Date.now();
        const timeDiff = currentTime - txTime;
        
        if (timeDiff < 10 * 60 * 1000) { // 10 minutes in milliseconds
          console.log('Recent pending transaction found, checking status...');
          
          try {
            // Check the transaction status
            const provider = this.web3Service.getProvider();
            if (!provider) throw new Error('No provider available');
            
            const txReceipt = await provider.getTransactionReceipt(pendingTxHash);
            
            if (txReceipt) {
              console.log('Transaction receipt found:', txReceipt);
              
              if (txReceipt.status === 1) {
                console.log('Pending transaction was confirmed successfully!');
                localStorage.setItem('lastMetaTxHash', pendingTxHash);
                localStorage.setItem('lastMetaTxTimestamp', Date.now().toString());
                localStorage.removeItem('pendingMetaTxHash');
                localStorage.removeItem('pendingMetaTxTimestamp');
                
                // Could trigger an event or notification here to inform the user
              } else {
                console.error('Transaction failed on chain:', txReceipt);
                // Clear pending state since we now know it failed
                localStorage.removeItem('pendingMetaTxHash');
                localStorage.removeItem('pendingMetaTxTimestamp');
              }
            } else {
              console.log('Transaction still pending or not found on chain...');
              // Keep the pending state, will check again on next load
            }
          } catch (error) {
            console.error('Error checking pending transaction status:', error);
            // Keep the pending status in localStorage, so we can try again later
          }
        } else {
          console.log('Pending transaction is too old, clearing pending state');
          localStorage.removeItem('pendingMetaTxHash');
          localStorage.removeItem('pendingMetaTxTimestamp');
        }
      } else if (lastTxHash) {
        console.log('Last successful transaction:', lastTxHash);
      } else {
        console.log('No pending transactions found');
      }
    } catch (error) {
      console.error('Error in checkPendingTransactions:', error);
      // Non-critical error, don't throw
    }
  }

  // Submit a project milestone (proof + amount) according to ABI
  public async submitProjectMilestone(projectId: number, proofIpfsUri: string, amountEth: string): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');

      // Convert ipfs URI/CIDv0 to bytes32 digest expected by contract
      const proofDigest = this.cidToBytes32(proofIpfsUri);
      const amountWei = ethers.parseEther(amountEth);

      const useMeta = await this.shouldUseMetaTransaction();
      if (useMeta) {
        const hash = await this.sendMetaTransaction(
          environment.contracts.ProjectRegistry,
          'submitMilestone',
          [projectId, proofDigest, amountWei.toString()]
        );
        return { success: !!hash, hash: hash || undefined };
      } else {
        const tx = await this.projectRegistryContract['submitMilestone'](projectId, proofDigest, amountWei);
        const receipt = await tx.wait();
        return { success: true, hash: receipt.hash };
      }
    } catch (error: any) {
      console.error('Error submitting project milestone:', error);
      return { success: false, error: error?.message || String(error) };
    }
  }
  
  private async _initContracts(): Promise<boolean> {
    // Dedupe concurrent calls
    if (this.initPromise) {
      await this.initPromise;
      return this.contractsInitialized;
    }

    this.initPromise = (async (): Promise<boolean> => {
      try {
        this.loadingSubject.next(true);
        console.log('Initializing contracts...');

        // Get provider and signer with retry logic
        let provider = this.web3Service.getProvider();
        let signer = this.web3Service.getSigner();
        let retryCount = 0;
        const maxRetries = 3;

        while ((!provider || !signer) && retryCount < maxRetries) {
          console.log(`Provider or signer not available, retrying (${retryCount + 1}/${maxRetries})...`);
          // Small delay before retry
          await new Promise(res => setTimeout(res, 500));
          provider = this.web3Service.getProvider();
          signer = this.web3Service.getSigner();
          retryCount++;
        }

        if (!provider || !signer) {
          throw new Error('Provider or signer not available after retries');
        }

        // Guard against wrong chain
        if (!this.web3Service.isCorrectNetwork()) {
          // If chainId is temporarily null, try to read from provider directly before failing
          let currentChainId = this.web3Service.getCurrentChainId();
          if (currentChainId == null && provider) {
            try {
              const net = await provider.getNetwork();
              currentChainId = Number(net.chainId);
            } catch {
              // Small delay and retry once from Web3Service state
              await new Promise(res => setTimeout(res, 250));
              currentChainId = this.web3Service.getCurrentChainId();
            }
          }
          if (currentChainId !== environment.network.chainId) {
            throw new Error(`Wrong network. Expected chainId ${environment.network.chainId}, got ${currentChainId}`);
          }
        }

        // Verify contract addresses are available
        if (!environment.contracts || !environment.contracts.UrbanCore) {
          throw new Error('Contract addresses not configured in environment');
        }

        // Initialize UrbanCore first, as it's the most critical contract
        try {
          console.log('Initializing UrbanCore contract...');
          this.urbanCoreContract = new ethers.Contract(
            environment.contracts.UrbanCore,
            (urbanCoreABI as any).abi ?? urbanCoreABI,
            signer
          );

          // Verify contract is working by making a simple call that definitely exists
          await this.urbanCoreContract['getAddressRole']('0x0000000000000000000000000000000000000000').catch(error => {
            console.error('Error verifying UrbanCore contract:', error);
            throw new Error('UrbanCore contract verification failed');
          });

          console.log('UrbanCore contract initialized successfully');
        } catch (coreError) {
          console.error('Failed to initialize UrbanCore contract:', coreError);
          // Re-throw to stop initialization of other contracts
          throw coreError;
        }

        // Now initialize the rest of the contracts (if addresses configured)
        try {
          if (environment.contracts.UrbanToken) {
            this.urbanTokenContract = new ethers.Contract(
              environment.contracts.UrbanToken,
              (urbanTokenABI as any).abi ?? urbanTokenABI,
              signer
            );
            console.log('UrbanToken contract initialized');
          }

          if (environment.contracts.GrievanceHub) {
            this.grievanceHubContract = new ethers.Contract(
              environment.contracts.GrievanceHub,
              (grievanceHubABI as any).abi ?? grievanceHubABI,
              signer
            );
            console.log('GrievanceHub contract initialized');
          }

          if (environment.contracts.ProjectRegistry) {
            // Rebind only if not initialized or address changed (e.g., after a redeploy)
            const desiredAddress = environment.contracts.ProjectRegistry;
            const currentAddress = this.projectRegistryContract
              ? String((this.projectRegistryContract as any).target || (this.projectRegistryContract as any).address || '').toLowerCase()
              : '';
            const desiredLower = desiredAddress.toLowerCase();
            if (!this.projectRegistryContract || currentAddress !== desiredLower) {
              this.projectRegistryContract = new ethers.Contract(
                desiredAddress,
                (projectRegistryABI as any).abi ?? projectRegistryABI,
                signer
              );
              console.log(`ProjectRegistry contract initialized${currentAddress && currentAddress !== desiredLower ? ' (rebound to new address)' : ''}`);
            }
          }

          if (environment.contracts.TaxModule) {
            this.taxModuleContract = new ethers.Contract(
              environment.contracts.TaxModule,
              (taxModuleABI as any).abi ?? taxModuleABI,
              signer
            );
            console.log('TaxModule contract initialized');
          }

          if (environment.contracts.MetaForwarder) {
            this.metaForwarderContract = new ethers.Contract(
              environment.contracts.MetaForwarder,
              (metaForwarderABI as any).abi ?? metaForwarderABI,
              signer
            );
            console.log('MetaForwarder contract initialized');
          }

          // Optional: verify MetaForwarder is trusted by UrbanCore
          if (environment.contracts.MetaForwarder && this.urbanCoreContract) {
            try {
              const trusted = await this.urbanCoreContract['isTrustedForwarder'](environment.contracts.MetaForwarder);
              if (!trusted) {
                console.warn('MetaForwarder is not trusted by UrbanCore. Meta-transactions may not work as expected.', {
                  forwarder: environment.contracts.MetaForwarder
                });
              } else {
                console.log('MetaForwarder is trusted by UrbanCore');
              }
            } catch (verifyErr) {
              console.warn('Could not verify trusted forwarder on UrbanCore:', verifyErr);
            }
          }

          console.log('All contracts initialized (where addresses configured)');
        } catch (otherError) {
          console.error('Error initializing secondary contracts:', otherError);
          // Don't re-throw here, as we want to continue if at least UrbanCore is available
        }
      } catch (error) {
        console.error('Error initializing contracts:', error);
        this.resetContracts();
        return false;
      } finally {
        this.loadingSubject.next(false);
        this.initPromise = null;
        this.contractsInitialized = true;
        return true;
      }
    })()
    .finally(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  private resetContracts(): void {
    this.urbanCoreContract = null;
    this.urbanTokenContract = null;
    this.grievanceHubContract = null;
    this.projectRegistryContract = null;
    this.taxModuleContract = null;
    this.metaForwarderContract = null;
  }

  /**
   * Get hardcoded bytes32 role constant for a given role name
   * @param roleName The role name as defined in UserRole enum
   * @returns The bytes32 role constant or null if not found
   */
  public getRoleConstant(roleName: UserRole): string | null {
    try {
      // OWNER and ADMIN_GOVT are the same on-chain. Alias OWNER to ADMIN_GOVT here.
      const name = roleName === UserRole.OWNER_ROLE ? UserRole.ADMIN_GOVT_ROLE : roleName;
      const hash = ethers.keccak256(ethers.toUtf8Bytes(String(name)));
      return hash;
    } catch (e) {
      console.warn('Failed to compute role constant for', roleName, e);
      return null;
    }
  }

  // Urban Core contract functions
  public async hasRole(role: UserRole, address: string): Promise<boolean> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleConstant = this.getRoleConstant(role);
      if (!roleConstant) {
        console.error(`No constant found for role ${role}`);
        return false;
      }
      
      return await this.urbanCoreContract['hasRole'](roleConstant, address);
    } catch (error) {
      console.error('Error checking role:', error);
      return false;
    }
  }

  /**
   * Get the role of an address by calling getAddressRole on the UrbanCore contract
   * @param address The address to check the role for
   * @returns The UserRole enum value for the address or null if no role is found
   */
  public async getUserRole(address: string): Promise<UserRole | null> {
    try {
      console.log(`Getting role for address: ${address}`);
      
      // Ensure contracts are initialized
      if (!this.urbanCoreContract) {
        console.log('UrbanCore contract not initialized, initializing contracts...');
        await this.initContracts();
      }
      
      if (!this.urbanCoreContract) {
        console.error('Failed to initialize UrbanCore contract');
        return UserRole.NONE;
      }
      
      // SKIP getAddressRole method as it can return incorrect priority due to area head assignments
      // Always use individual role checks to ensure proper priority
      console.log('Checking roles individually to ensure proper priority');
      
      // Check roles in priority order - ADMIN_GOVT should always take precedence over ADMIN_HEAD
      const rolesToCheck = [
        { role: UserRole.OWNER_ROLE, name: 'OWNER_ROLE' },
        { role: UserRole.ADMIN_GOVT_ROLE, name: 'ADMIN_GOVT_ROLE' },
        { role: UserRole.ADMIN_HEAD_ROLE, name: 'ADMIN_HEAD_ROLE' },
        { role: UserRole.PROJECT_MANAGER_ROLE, name: 'PROJECT_MANAGER_ROLE' },
        { role: UserRole.TAX_COLLECTOR_ROLE, name: 'TAX_COLLECTOR_ROLE' },
        { role: UserRole.VALIDATOR_ROLE, name: 'VALIDATOR_ROLE' },
        { role: UserRole.CITIZEN_ROLE, name: 'CITIZEN_ROLE' },
        { role: UserRole.TX_PAYER_ROLE, name: 'TX_PAYER_ROLE' }
      ];
      
      for (const { role, name } of rolesToCheck) {
        try {
          console.log(`Checking if address has role: ${name}`);
          const hasRole = await this.hasRole(role, address);
          if (hasRole) {
            console.log(`Address has role: ${name} - returning this as primary role`);
            return role;
          }
        } catch (error) {
          console.error(`Error checking ${name}:`, error);
        }
      }
      
      console.log('No role found for address, returning NONE');
      return UserRole.NONE;
    } catch (error) {
      console.error('Error in getUserRole:', error);
      return UserRole.NONE;
    }
  }
  
  // Admin Head module methods
  // Get the area ID for an admin
  public async getAdminAreaId(adminAddress: string | null): Promise<string | null> {
    try {
      if (!adminAddress) return null;
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Check if the address has ADMIN_HEAD_ROLE
      const adminHeadBytes = this.getRoleConstant(UserRole.ADMIN_HEAD_ROLE);
      if (!adminHeadBytes) {
        console.error('ADMIN_HEAD_ROLE constant not found');
        return null;
      }
      const hasAdminRole = await this.urbanCoreContract['hasRole'](adminHeadBytes, adminAddress);
      if (!hasAdminRole) {
        console.log('Address does not have ADMIN_HEAD_ROLE');
        return null;
      }
      
      // Get areas administered by this admin head (array)
      const areas: any[] = await this.urbanCoreContract['getHeadAreas'](adminAddress);
      try { console.debug('[ContractService] getAdminAreaId areas', { adminAddress, raw: areas?.map?.(a => a?.toString?.() ?? String(a)) }); } catch {}
      if (!areas || areas.length === 0) {
        return null;
      }
      // For now, return the first assigned area
      const firstArea = areas[0];
      const selected = firstArea?.toString?.() ?? String(firstArea);
      try { console.debug('[ContractService] getAdminAreaId selected', { adminAddress, selected }); } catch {}
      return selected;
    } catch (error) {
      console.error('Error getting admin area ID:', error);
      return null;
    }
  }
  
  // Get pending role requests for an area
  public async getPendingRoleRequests(areaId: string): Promise<any[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Get all pending citizen requests
      const pendingAddresses = await this.urbanCoreContract['getPendingRequests']();
      const requests = [];
      
      // For each address, get the request details and determine if it's for the specified area
      for (let i = 0; i < pendingAddresses.length; i++) {
        const address = pendingAddresses[i];
        const requestDetails = await this.urbanCoreContract['getCitizenRequest'](address);
        
        // Get the area ID from the request details
        // In the real contract, this should be part of the citizen request
        // For now, we'll extract it from the metadata
        let requestAreaId = null;
        
        // Check if the metadata exists and try to get the area ID from it
        if (requestDetails.docsHash) {
          try {
            // Decode docsHash to potential ipfs:// URI and fetch JSON metadata
            const hex = typeof requestDetails.docsHash === 'string'
              ? requestDetails.docsHash
              : ethers.hexlify(requestDetails.docsHash);
            let ipfsUri: string | null = null;
            try {
              const decoded = ethers.toUtf8String(hex as any);
              if (decoded && decoded.startsWith('ipfs://')) {
                ipfsUri = decoded;
              }
            } catch {}
            if (ipfsUri) {
              const metadata = await this.getIpfsJson(ipfsUri);
              if (metadata && typeof metadata === 'object') {
                const parsedMetadata = metadata as any;
                if (parsedMetadata.areaId !== undefined && parsedMetadata.areaId !== null) {
                  requestAreaId = parsedMetadata.areaId.toString();
                }
              }
            }
          } catch (metadataError) {
            console.warn(`Error getting metadata for request from ${address}:`, metadataError);
          }
        }
        
        // If the area matches or if we couldn't determine the area (null check)
        if (!requestAreaId || requestAreaId === areaId) {
          requests.push({
            id: address, // Using the citizen address as the request ID
            requester: address,
            role: 'citizen', // This is a citizen request
            status: requestDetails.processed ? 'processed' : 'pending',
            timestamp: requestDetails.requestedAt.toString(),
            metadataUri: requestDetails.docsHash ? ethers.hexlify(requestDetails.docsHash) : null,
            validator: requestDetails.validator,
            areaId: requestAreaId // Include the area ID we found
          });
        }
      }
      
      // Filter to only return pending requests for this area
      return requests.filter(request => request.status === 'pending' && 
        (!request.areaId || request.areaId === areaId));
    } catch (error) {
      console.error('Error getting pending role requests:', error);
      return [];
    }
  }
  
  // Get role holders by area (returns array of { address, name? })
  public async getRoleHoldersByArea(areaId: string, role: UserRole): Promise<Array<{ address: string; name?: string }>> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Get all role holders first
      const allHolders = await this.getRoleHolders(role);
      const areaHolders: Array<{ address: string; name?: string }> = [];
      
      // Filter role holders by area
      for (const address of allHolders) {
        let holderAreaId: string | null = null;
        
        switch (role) {
          case UserRole.ADMIN_HEAD_ROLE:
            // For Admin Heads, check if they administer this area
            holderAreaId = await this.getAdminAreaId(address);
            break;
            
          case UserRole.CITIZEN_ROLE:
            // For Citizens, get their area from metadata
            const citizenData = await this.urbanCoreContract['getCitizen'](address);
            if (citizenData && citizenData.areaId) {
              holderAreaId = citizenData.areaId.toString();
            }
            break;
            
          case UserRole.VALIDATOR_ROLE:
            // For Validators, check their assigned area
            const validatorData = await this.urbanCoreContract['getValidator'](address);
            if (validatorData && validatorData.areaId) {
              holderAreaId = validatorData.areaId.toString();
            }
            break;

          case UserRole.PROJECT_MANAGER_ROLE:
            // Use UrbanCore.isAreaProjectManager for explicit area check
            try {
              const isPm = await this.urbanCoreContract['isAreaProjectManager'](Number(areaId), address);
              if (isPm) {
                areaHolders.push({ address });
                continue;
              }
            } catch {}
            break;
            
          default:
            // For other roles, we might need specific contract methods
            // For now, include all role holders if we can't determine their area
            areaHolders.push({ address });
            continue;
        }
        
        // Add to area holders if the area matches
        if (holderAreaId && holderAreaId === areaId) {
          areaHolders.push({ address });
        }
      }
      
      return areaHolders;
    } catch (error) {
      console.error('Error getting role holders by area:', error);
      return [] as Array<{ address: string; name?: string }>;
    }
  }
  
  public async hasAnyOtherRole(address: string): Promise<boolean> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Check if the address has any role other than CITIZEN
      const rolesToCheck: UserRole[] = [
        UserRole.OWNER_ROLE,
        UserRole.ADMIN_GOVT_ROLE,
        UserRole.ADMIN_HEAD_ROLE,
        UserRole.PROJECT_MANAGER_ROLE,
        UserRole.TAX_COLLECTOR_ROLE,
        UserRole.VALIDATOR_ROLE,
        UserRole.TX_PAYER_ROLE
      ];
      for (const role of rolesToCheck) {
        try {
          const has = await this.hasRole(role, address);
          if (has) return true;
        } catch {}
      }
      return false;
    } catch (error) {
      console.error('Error checking for other roles:', error);
      return false;
    }
  }
  
  // Alias for uploadToIpfs
  public async uploadToIPFS(data: any): Promise<string> {
    return this.uploadToIpfs(data);
  }
  
  // Method to assign a role to a user
  public async assignRole(address: string, role: UserRole, areaId: string, metadataHash?: string): Promise<boolean> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleConstant = this.getRoleConstant(role);
      if (!roleConstant) {
        console.error(`No constant found for role ${role}`);
        return false;
      }
      
      console.log(`Assigning role ${role} to ${address} in area ${areaId}`);
      const numericAreaId = parseInt(areaId, 10);
      let tx: any;
      // Route area-scoped roles through their dedicated functions to populate area mappings
      if (role === UserRole.VALIDATOR_ROLE) {
        tx = await this.urbanCoreContract['assignValidatorToArea'](numericAreaId, address);
      } else if (role === UserRole.TAX_COLLECTOR_ROLE) {
        tx = await this.urbanCoreContract['assignTaxCollectorToArea'](numericAreaId, address);
      } else if (role === UserRole.PROJECT_MANAGER_ROLE) {
        tx = await this.urbanCoreContract['assignProjectManagerToArea'](numericAreaId, address);
      } else {
        // Fallback to generic assignRole for roles that are not area-scoped
        tx = await this.urbanCoreContract['assignRole'](roleConstant, address);
      }
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error assigning role:', error);
      return false;
    }
  }
  
  // Get projects by area
  public async getProjectsByArea(areaId: string): Promise<number[]> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      const numericAreaId = parseInt(areaId, 10);
      const ids: any[] = await this.projectRegistryContract['getAreaProjects'](numericAreaId);
      return (ids || []).map((x: any) => Number(x));
    } catch (e) {
      console.error('Error getting projects by area:', e);
      return [];
    }
  }
  
  // Helper methods for currency conversion
  public weiToEth(weiValue: any): string {
    try {
      if (weiValue === null || weiValue === undefined) return '0';
      const asStr = typeof weiValue === 'string' ? weiValue : (weiValue.toString?.() ?? String(weiValue));
      // If the string looks like a decimal (already in ether), just return it
      if (typeof asStr === 'string' && asStr.includes('.')) {
        return asStr;
      }
      // Otherwise treat as a wei BigNumberish and format
      return ethers.formatEther(weiValue);
    } catch (e) {
      // Last resort: return string representation to avoid UI crash
      try { return weiValue?.toString?.() ?? '0'; } catch { return '0'; }
    }
  }
  
  // Convert role enum to bytes32 format for contract calls
  public convertRoleToBytes32(role: UserRole): string {
    // Define role hash mapping
    const roleHashes: { [key in UserRole]: string } = {
      [UserRole.NONE]: '0x0000000000000000000000000000000000000000000000000000000000000000',
      [UserRole.CITIZEN_ROLE]: '0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848',
      [UserRole.VALIDATOR_ROLE]: '0x4837e32cdabbb5070afe5390d3f7f3765683e3389f5fd3f86f137b408eaabd3c',
      [UserRole.TAX_COLLECTOR_ROLE]: '0x5e17fc5225d4a099df75359ce1f405503ca79498a8d05c5dc33c0846fa8d3e2c',
      [UserRole.PROJECT_MANAGER_ROLE]: '0x19daf4d11d1e9557f3eeddcabc25cc0ca8552d2d5e28d48600f394e8b8417cf1',
      [UserRole.ADMIN_HEAD_ROLE]: '0xc68b6f26e4ee5a3a1dd9c5424dd9457432749c8ab9008122d0ca2a361b3083d8',
      [UserRole.ADMIN_GOVT_ROLE]: '0x71f3d55856e4058ed641473bb5c740ca4737b3f65260cc067d12cb7ffee9a2f1',
      [UserRole.TX_PAYER_ROLE]: '0x7d4827b252aa913a0ad2fb2da2cae5dc10f4650ab5225fc9e094390a055a1771',
      [UserRole.OWNER_ROLE]: '0x0000000000000000000000000000000000000000000000000000000000000000' // DEFAULT_ADMIN_ROLE
    };
    
    return roleHashes[role] || roleHashes[UserRole.NONE];
  }
  
  public ethToWei(ethValue: string | number): string {
    return ethers.parseEther(ethValue.toString()).toString();
  }
  
  // Method to reject a grievance
  public async rejectGrievance(grievanceId: string, feedback: string): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Optionally submit feedback along with rejection if provided
      if (feedback && feedback.trim().length > 0) {
        const txFb = await this.submitFeedback(grievanceId, feedback, false);
        // Wait for feedback tx before rejecting so index is recorded on-chain first
        // Ignore errors here; proceed to rejection attempt regardless
        try {
          const provider = this.web3Service.getProvider();
          if (provider) {
            await provider.waitForTransaction(txFb);
          }
        } catch {}
      }

      const tx = await this.approveGrievance(grievanceId, false);
      return tx;
    } catch (error) {
      console.error('Error rejecting grievance:', error);
      return null;
    }
  }

  // Approve or reject a grievance (Validator action)
  public async approveGrievance(grievanceId: string | number, approve: boolean): Promise<string> {
    if (!this.grievanceHubContract) await this.initContracts();
    if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
    const idNum = Number(grievanceId);
    const tx = await this.grievanceHubContract['approveGrievance'](idNum, approve);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  // Approve or reject a feedback entry (Admin Head action)
  public async approveFeedback(grievanceId: string | number, feedbackIndex: string | number, approve: boolean): Promise<string> {
    if (!this.grievanceHubContract) await this.initContracts();
    if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
    const idNum = Number(grievanceId);
    const idxNum = Number(feedbackIndex);
    const tx = await this.grievanceHubContract['approveFeedback'](idNum, idxNum, approve);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  // Admin Head accepts a validated grievance
  public async acceptValidated(grievanceId: string | number): Promise<string> {
    if (!this.grievanceHubContract) await this.initContracts();
    if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
    const idNum = Number(grievanceId);
    const tx = await this.grievanceHubContract['acceptValidated'](idNum);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  // Citizen or Admin submits feedback text or IPFS reference; contract expects bytes32 feedbackHash and resolved flag
  public async submitFeedback(grievanceId: string | number, feedbackTextOrHash: string, resolved: boolean): Promise<string> {
    if (!this.grievanceHubContract) await this.initContracts();
    if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
    const idNum = Number(grievanceId);

    // Determine the bytes32 digest to send:
    // - If already 0x-32byte hex, use as-is
    // - If IPFS URI (ipfs://...) or CIDv0 (Qm...), convert to bytes32 digest via cidToBytes32
    // - Else hash the UTF-8 content text
    let feedbackHash: string = feedbackTextOrHash;
    const isBytes32 = typeof feedbackTextOrHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(feedbackTextOrHash);
    const isIpfsUri = typeof feedbackTextOrHash === 'string' && feedbackTextOrHash.startsWith('ipfs://');
    const isCidV0 = typeof feedbackTextOrHash === 'string' && /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(feedbackTextOrHash);
    if (!isBytes32) {
      if (isIpfsUri || isCidV0) {
        feedbackHash = this.cidToBytes32(feedbackTextOrHash);
      } else {
        feedbackHash = ethers.keccak256(ethers.toUtf8Bytes(String(feedbackTextOrHash)));
      }
    }

    const tx = await this.grievanceHubContract['submitFeedback'](idNum, feedbackHash, !!resolved);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }
  
  // Get grievances for an area
  public async getGrievancesByArea(areaId: string): Promise<string[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Use direct area index from contract
      const ids: any[] = await this.grievanceHubContract['getAreaGrievances'](Number(areaId));
      return (ids || []).map(id => id?.toString?.() ?? String(id));
    } catch (error) {
      console.error('Error getting grievances by area:', error);
      return [];
    }
  }
  
  // Get grievances by status and area
  public async getGrievancesByStatusAndArea(status: string, areaId: string): Promise<string[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Normalize requested status (handle synonyms and casing)
      const normalizeInputStatus = (s: string): string => {
        const v = String(s || '').trim().toLowerCase();
        if (v === 'approved') return 'validated';
        if (v === 'accepted_by_head' || v === 'acceptedbyhead') return 'accepted';
        if (v === 'inproject' || v === 'in-project') return 'in_project';
        return v;
      };
      const wanted = normalizeInputStatus(status);
      
      // Get all grievances for this area via index, with fallback scanning by areaId if empty
      let areaGrievances = await this.getGrievancesByArea(areaId);
      const filteredGrievances: string[] = [];
      let scanned = 0;
      if (!areaGrievances || areaGrievances.length === 0) {
        try {
          const total = Number(await this.grievanceHubContract['getTotalGrievances']());
          const cap = Math.min(total, 300);
          const batch = 30;
          const matchedIds: string[] = [];
          const encountered: Record<string, Set<string>> = {
            areaId: new Set(), area: new Set(), areaCode: new Set(), wardId: new Set(), ward: new Set(), zoneId: new Set(), zone: new Set(), pincode: new Set(), postalCode: new Set(), districtId: new Set()
          };
          const norm = (v: any) => {
            const s = (v ?? '').toString().trim();
            return s;
          };
          for (let i = 1; i <= cap; i += batch) {
            const ps = [] as Promise<any>[];
            for (let j = i; j < i + batch && j <= cap; j++) {
              ps.push(this.grievanceHubContract['getGrievance'](j).then(g => ({ id: j, data: g })).catch(() => null));
            }
            const res = await Promise.all(ps);
            for (const entry of res) {
              if (!entry) continue;
              // Use robust higher-level getter for areaId comparison
              try {
                const full = await this.getGrievanceById(String(entry.id));
                const f: any = full as any;
                const candidates: Array<{key: string, val: string}> = [
                  { key: 'areaId', val: norm(f.areaId) },
                  { key: 'area', val: norm(f.area) },
                  { key: 'areaCode', val: norm(f.areaCode) },
                  { key: 'wardId', val: norm(f.wardId) },
                  { key: 'ward', val: norm(f.ward) },
                  { key: 'zoneId', val: norm(f.zoneId) },
                  { key: 'zone', val: norm(f.zone) },
                  { key: 'pincode', val: norm(f.pincode) },
                  { key: 'postalCode', val: norm(f.postalCode) },
                  { key: 'districtId', val: norm(f.districtId) }
                ];
                for (const c of candidates) {
                  if (c.val) encountered[c.key]?.add(c.val);
                }
                const want = norm(areaId);
                const eqMatch = candidates.some(c => c.val && c.val === want);
                const containsMatch = !eqMatch && candidates.some(c => c.val && c.val.includes(want));
                if (eqMatch || containsMatch) {
                  matchedIds.push(String(entry.id));
                }
              } catch {}
            }
          }
          areaGrievances = matchedIds;
          try {
            const summarize = (s: Set<string>) => Array.from(s).slice(0, 10);
            console.debug('[ContractService] fallback area scan used', {
              areaId,
              count: matchedIds.length,
              samples: {
                areaId: summarize(encountered['areaId']),
                area: summarize(encountered['area']),
                areaCode: summarize(encountered['areaCode']),
                wardId: summarize(encountered['wardId']),
                ward: summarize(encountered['ward']),
                zoneId: summarize(encountered['zoneId']),
                zone: summarize(encountered['zone']),
                pincode: summarize(encountered['pincode']),
                postalCode: summarize(encountered['postalCode']),
                districtId: summarize(encountered['districtId'])
              }
            });
          } catch {}
        } catch (e) {
          console.warn('Fallback area scan failed', e);
        }
      }
      
      // Filter grievances by status
      for (const grievanceId of areaGrievances) {
        try {
          const grievanceNumericId = Number(grievanceId);
          const grievance = await this.grievanceHubContract['getGrievance'](grievanceNumericId);
          // Map the numeric status to string status
          let grievanceStatus: string;
          
          switch (Number(grievance.status)) {
            case 0: grievanceStatus = 'pending'; break;              // Pending
            case 1: grievanceStatus = 'validated'; break;            // Validated
            case 2: grievanceStatus = 'rejected'; break;             // Rejected
            case 3: grievanceStatus = 'accepted'; break;             // AcceptedByHead
            case 4: grievanceStatus = 'in_project'; break;           // InProject
            case 5: grievanceStatus = 'resolved'; break;             // Resolved
            case 6: grievanceStatus = 'reopened'; break;             // Reopened
            default: grievanceStatus = 'unknown';
          }
          
          // Compare with the requested status
          scanned += 1;
          if (grievanceStatus === wanted) {
            filteredGrievances.push(grievanceId);
          }
        } catch (grievanceError) {
          console.warn(`Error fetching grievance ${grievanceId}:`, grievanceError);
        }
      }
      
      try {
        console.debug('[ContractService] getGrievancesByStatusAndArea', { areaId, wanted, scanned, matched: filteredGrievances.length });
      } catch {}
      return filteredGrievances;
    } catch (error) {
      console.error(`Error getting ${status} grievances for area ${areaId}:`, error);
      return [];
    }
  }
  
  // Get citizens by area
  public async getCitizensByArea(areaId: string): Promise<any[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // UrbanCore does not expose getAreaCitizens. Derive by scanning CitizenApproved events
      const provider = this.web3Service.getProvider();
      if (!provider) throw new Error('No provider available');
      const latestBlock = await provider.getBlockNumber();
      const filter = this.urbanCoreContract.filters['CitizenApproved']();
      const logs = await this.urbanCoreContract.queryFilter(filter, 0, latestBlock);
      
      const citizens: any[] = [];
      for (const log of logs) {
        const anyLog = log as any;
        const addr: string = anyLog?.args?.citizen ?? anyLog?.args?.account ?? '';
        if (!addr) continue;
        try {
          const metadata = await this.getAddressMetadata(addr);
          const metaAreaId = metadata?.areaId?.toString?.() ?? metadata?.area?.toString?.() ?? null;
          if (!metaAreaId || String(metaAreaId) !== String(areaId)) continue;
          citizens.push({ address: addr, name: metadata?.name || 'Unknown', registrationDate: null, metadata });
        } catch (e) {
          // If metadata unavailable, skip as we cannot attribute area
          continue;
        }
      }
      return citizens;
    } catch (error) {
      console.error('Error getting citizens by area:', error);
      return [];
    }
  }
  
  // AdminGovt methods
  /**
   * Admin Government Methods
   */

  public async getTotalCitizenCount(): Promise<number> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Check if the contract has a getTotalCitizenCount method
      if (this.urbanCoreContract['getTotalApprovedCitizens']) {
        const count = await this.urbanCoreContract['getTotalApprovedCitizens']();
        return Number(count);
      } else {
        // Fallback: get the count by getting all citizens
        const allCitizens = await this.getRoleHolders(UserRole.CITIZEN_ROLE);
        return allCitizens.length;
      }
    } catch (error) {
      console.error('Error getting total citizen count:', error);
      return 0;
    }
  }

  public async getTotalProjectsCount(): Promise<number> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Get total project count from the contract
      const count = await this.projectRegistryContract['getTotalProjects']();
      return Number(count);
    } catch (error) {
      console.error('Error getting total projects count:', error);
      return 0;
    }
  }

  public async getTotalGrievancesCount(): Promise<number> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Get total grievances count from the contract
      const count = await this.grievanceHubContract['getTotalGrievances']();
      return Number(count);
    } catch (error) {
      console.error('Error getting total grievances count:', error);
      return 0;
    }
  }

  public async getTotalTaxCollected(): Promise<string> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // TaxModule does not expose getTotalTaxCollected(); it has getTotalCollected(uint256 year)
      const currentYear = new Date().getFullYear();
      const totalTax = await this.taxModuleContract['getTotalCollected'](currentYear);
      return ethers.formatEther(totalTax);
    } catch (error) {
      console.error('Error getting total tax collected:', error);
      return '0';
    }
  }

  // Helper method to format addresses for display
  public formatAddress(address: string): string {
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return '';
    }
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  public async getRecentSystemEvents(): Promise<any[]> {
    try {
      await this.initContracts();
      if (!this.urbanCoreContract || !this.grievanceHubContract || !this.projectRegistryContract) {
        throw new Error('Required contracts not initialized');
      }
      
      const events: any[] = [];
      // Use provider from Web3Service (contract.provider may be undefined in ethers v6)
      const provider = this.web3Service.getProvider();
      if (!provider) throw new Error('No provider available');
      
      // Get latest block number
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 5000); // Look back 5000 blocks

      // Function to safely get block timestamp
      const getBlockTimestamp = async (blockNumber: number): Promise<number> => {
        try {
          const block = await provider.getBlock(blockNumber);
          return block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
        } catch (e) {
          console.warn(`Error getting block timestamp for block ${blockNumber}:`, e);
          return Math.floor(Date.now() / 1000);
        }
      };
      
      // UrbanCore events
      try {
        // Area head assignments (UrbanCore doesn't have AreaCreated)
        const headFilter = this.urbanCoreContract.filters['AreaHeadAssigned']();
        const headLogs = await this.urbanCoreContract.queryFilter(headFilter, fromBlock);
        for (const log of headLogs) {
          const logAny = log as any;
          const args = logAny.args || {};
          const timestamp = await getBlockTimestamp(logAny.blockNumber);
          events.push({
            id: `areahead-${logAny.transactionHash}-${logAny.logIndex}`,
            eventType: 'AreaHeadAssigned',
            address: args.head || '',
            timestamp,
            data: {
              areaId: args.areaId?.toString() || '',
              head: args.head || ''
            },
            description: `Area #${args.areaId?.toString() || ''} head set to ${this.formatAddress(args.head || '')}`
          });
        }
        
        // Role events
        const roleFilter = this.urbanCoreContract.filters['RoleGranted']();
        const roleLogs = await this.urbanCoreContract.queryFilter(roleFilter, fromBlock);
        
        for (const log of roleLogs) {
          // Cast to any to access event args
          const logAny = log as any;
          const args = logAny.args || {};
          const timestamp = await getBlockTimestamp(logAny.blockNumber);
          let roleName = 'Unknown';
          
          // Format role from bytes32
          if (args.role) {
            const roleBytes = args.role.toString();
            // Map known role hashes to readable names
            const roleMap: {[key: string]: string} = {
              '0x0000000000000000000000000000000000000000000000000000000000000000': 'DEFAULT_ADMIN_ROLE',
              '0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848': 'CITIZEN_ROLE',
              '0x4837e32cdabbb5070afe5390d3f7f3765683e3389f5fd3f86f137b408eaabd3c': 'VALIDATOR_ROLE',
              '0x5e17fc5225d4a099df75359ce1f405503ca79498a8d05c5dc33c0846fa8d3e2c': 'TAX_COLLECTOR_ROLE',
              '0x19daf4d11d1e9557f3eeddcabc25cc0ca8552d2d5e28d48600f394e8b8417cf1': 'PROJECT_MANAGER_ROLE',
              '0xc68b6f26e4ee5a3a1dd9c5424dd9457432749c8ab9008122d0ca2a361b3083d8': 'ADMIN_HEAD_ROLE',
              '0x71f3d55856e4058ed641473bb5c740ca4737b3f65260cc067d12cb7ffee9a2f1': 'ADMIN_GOVT_ROLE',
              '0x7d4827b252aa913a0ad2fb2da2cae5dc10f4650ab5225fc9e094390a055a1771': 'TX_PAYER_ROLE'
            };
            roleName = roleMap[roleBytes] || 'Custom Role';
          }
          
          events.push({
            id: `role-${logAny.transactionHash}-${logAny.logIndex}`,
            eventType: 'RoleAssigned',
            address: args.account || '',
            timestamp: timestamp,
            data: {
              role: roleName,
              account: args.account || ''
            },
            description: `${roleName} assigned to ${this.formatAddress(args.account || '')}`
          });
        }
      } catch (e) {
        console.warn('Error fetching UrbanCore events:', e);
      }
      
      // Grievance events
      try {
        const grievanceFilter = this.grievanceHubContract.filters['GrievanceFiled']();
        const grievanceLogs = await this.grievanceHubContract.queryFilter(grievanceFilter, fromBlock);
        
        for (const log of grievanceLogs) {
          // Cast to any to access event args
          const logAny = log as any;
          const args = logAny.args || {};
          const timestamp = await getBlockTimestamp(logAny.blockNumber);
          events.push({
            id: `grievance-${logAny.transactionHash}-${logAny.logIndex}`,
            eventType: 'GrievanceFiled',
            address: args.citizen || '',
            timestamp: timestamp,
            data: {
              grievanceId: args.grievanceId?.toString() || '',
              areaId: args.areaId?.toString() || ''
            },
            description: `New grievance (#${args.grievanceId?.toString() || ''}) filed in area #${args.areaId?.toString() || 'unknown'}`
          });
        }
      } catch (e) {
        console.warn('Error fetching GrievanceHub events:', e);
      }
      
      // Project events
      try {
        const projectFilter = this.projectRegistryContract.filters['ProjectCreated']();
        const projectLogs = await this.projectRegistryContract.queryFilter(projectFilter, fromBlock);
        
        for (const log of projectLogs) {
          // Cast to any to access event args
          const logAny = log as any;
          const args = logAny.args || {};
          const timestamp = await getBlockTimestamp(logAny.blockNumber);
          events.push({
            id: `project-${logAny.transactionHash}-${logAny.logIndex}`,
            eventType: 'ProjectCreated',
            address: args.creator || '',
            timestamp: timestamp,
            data: {
              projectId: args.projectId?.toString() || '',
              areaId: args.areaId?.toString() || ''
            },
            description: `New project (#${args.projectId?.toString() || ''}) created in area #${args.areaId?.toString() || 'unknown'}`
          });
        }
      } catch (e) {
        console.warn('Error fetching ProjectRegistry events:', e);
      }
      
      // Sort events by timestamp (most recent first)
      events.sort((a, b) => b.timestamp - a.timestamp);
      
      // Return the most recent events (limit to 20)
      return events.slice(0, 20);
    } catch (error) {
      console.error('Error getting recent system events:', error);
      return [];
    }
  }
  
  public async getAllAreaIds(): Promise<string[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Access provider and scan from genesis to latest for correctness
      const provider = this.web3Service.getProvider();
      if (!provider) throw new Error('No provider available');
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = 0;
      
      // Query AreaHeadAssigned events to infer existing area IDs
      const filter = this.urbanCoreContract.filters['AreaHeadAssigned']();
      const logs = await this.urbanCoreContract.queryFilter(filter, fromBlock);
      
      const uniqueIds = new Set<string>();
      for (const log of logs) {
        const logAny = log as any;
        if (logAny?.args && logAny.args.areaId !== undefined) {
          uniqueIds.add(String(logAny.args.areaId));
        }
      }
      
      return Array.from(uniqueIds);
    } catch (error) {
      console.error('Error getting all area IDs:', error);
      return [];
    }
  }

  public async getCurrentAreaHeads(): Promise<{ areaId: string; head: string }[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');

      const provider = this.web3Service.getProvider();
      if (!provider) throw new Error('No provider available');

      // Query all AreaHeadAssigned logs from genesis to latest for correctness
      const filter = this.urbanCoreContract.filters['AreaHeadAssigned']();
      const logs = await this.urbanCoreContract.queryFilter(filter, 0, await provider.getBlockNumber());

      // Track latest (blockNumber, logIndex) per areaId
      const latestMap = new Map<string, { head: string; blockNumber: number; logIndex: number }>();
      for (const log of logs) {
        const anyLog = log as any;
        const areaId = String(anyLog?.args?.areaId ?? '');
        const head = String(anyLog?.args?.adminHead ?? anyLog?.args?.head ?? '');
        if (!areaId) continue;
        const bn = Number((log as any).blockNumber ?? 0);
        const li = Number((log as any).logIndex ?? 0);
        const prev = latestMap.get(areaId);
        if (!prev || bn > prev.blockNumber || (bn === prev.blockNumber && li > prev.logIndex)) {
          latestMap.set(areaId, { head, blockNumber: bn, logIndex: li });
        }
      }

      return Array.from(latestMap.entries()).map(([areaId, v]) => ({ areaId, head: v.head }));
    } catch (error) {
      console.error('Error getting current area heads:', error);
      return [];
    }
  }

  public async getAreaCitizenCount(areaId: string): Promise<number> {
    try {
      const citizens = await this.getCitizensByArea(areaId);
      return citizens.length;
    } catch (error) {
      console.error('Error getting area citizen count:', error);
      return 0;
    }
  }
  
  // Create a new area by assigning an initial area head (no name stored on-chain)
  // We derive a deterministic areaId from the provided areaName for UX convenience
  // Returns a TransactionResponse-like object supporting wait()
  public async createArea(areaName: string): Promise<{ hash: string; wait: () => Promise<{ hash: string }> } | null> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      if (!areaName || !areaName.trim()) throw new Error('Area name is required');

      // Derive a pseudo areaId from name (keccak256 -> uint -> clamp)
      const nameBytes = ethers.toUtf8Bytes(areaName.trim());
      const nameHash = ethers.keccak256(nameBytes);
      // Take lower 24 bits to keep IDs manageable (0 .. ~16M)
      const areaId = Number(BigInt(nameHash) & BigInt(0xFFFFFFn));
      if (areaId === 0) throw new Error('Invalid derived areaId');

      // Use current account as initial Admin Head for this area
      // NOTE: This will temporarily assign ADMIN_GOVT as area head
      // Use the remove-area-head script to clean this up after creating the area
      const account = this.web3Service.getAccount();
      if (!account) throw new Error('No connected account');

      const useMeta = await this.shouldUseMetaTransaction();
      if (useMeta) {
        const txHash = await this.sendMetaTransaction(
          environment.contracts.UrbanCore,
          'assignAreaHead',
          [areaId, account]
        );
        if (!txHash) throw new Error('Meta-transaction failed to submit');
        const hash: string = txHash!;
        // Return shim with wait() to align with component expectations
        return { hash, wait: async () => ({ hash }) };
      } else {
        const tx = await this.urbanCoreContract['assignAreaHead'](areaId, account);
        // Wrap to a consistent shape
        return { hash: tx.hash, wait: async () => await tx.wait() };
      }
    } catch (error) {
      console.error('Error creating area:', error);
      return null;
    }
  }
  
  // This is just a wrapper around the existing approveRoleRequest implementation
  // that ignores the second parameter for backward compatibility
  public async approveRoleRequestWithArea(requestId: string, areaId: string): Promise<boolean> {
    try {
      const result = await this.approveRoleRequest(requestId);
      return !!result;
    } catch (error) {
      console.error('Error approving role request:', error);
      return false;
    }
  }
  
  // Get a grievance (alias for getGrievanceById)
  public async getGrievance(grievanceId: string): Promise<any> {
    return this.getGrievanceById(grievanceId);
  }
  
  // Escalate grievance to project
  public async escalateGrievanceToProject(
    grievanceId: string,
    projectName: string,
    projectDescription: string,
    budget: string,
    initialFunding: string,
    projectManager: string
  ): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      // Ensure ProjectRegistry is initialized and rebound to current env address if needed
      if (!this.projectRegistryContract) await this.initContracts();
      const desiredPR = environment.contracts.ProjectRegistry?.toLowerCase();
      const currentPR = this.projectRegistryContract
        ? String(((this.projectRegistryContract as any).target || (this.projectRegistryContract as any).address) || '').toLowerCase()
        : '';
      if (desiredPR && currentPR && desiredPR !== currentPR) {
        console.warn('ProjectRegistry address changed in environment; rebinding cached instance');
        this.projectRegistryContract = null;
        await this.initContracts();
      }
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');

      // Determine AdminHead's area
      const caller = this.web3Service.getAccount();
      if (!caller) throw new Error('No connected account');
      const areaIdStr = await this.getAdminAreaId(caller);
      const areaIdNum = parseInt(areaIdStr || '0', 10);
      if (!Number.isFinite(areaIdNum) || areaIdNum <= 0) throw new Error('Unable to determine admin area for escalation');

      // Step 1: Ensure the grievance is marked as accepted by AdminHead on GrievanceHub
      const grievanceIdNum = parseInt(grievanceId || '0', 10);
      if (!Number.isFinite(grievanceIdNum) || grievanceIdNum <= 0) {
        throw new Error('Invalid grievanceId');
      }
      try {
        const hubMetaReady = await this.shouldUseMetaTransaction();
        const hubTrusts = await this.isTrustedForwarderFor(environment.contracts.GrievanceHub).catch(() => false);
        if (hubMetaReady && hubTrusts) {
          await this.sendMetaTransaction(
            environment.contracts.GrievanceHub,
            'acceptValidated',
            [grievanceIdNum]
          );
        } else {
          const tx = await this.grievanceHubContract['acceptValidated'](grievanceIdNum);
          await tx.wait();
        }
      } catch (acceptErr: any) {
        // If already accepted, proceed; otherwise bubble up
        const msg = String(acceptErr?.message || acceptErr);
        if (!/InvalidStatus|already/i.test(msg)) {
          throw new Error(`Failed to accept grievance before project creation: ${msg}`);
        }
      }

      // Upload title/description to IPFS
      const titleIpfsUri = await this.uploadToIpfs({ kind: 'project_title', title: projectName, fromGrievance: grievanceId, createdAt: Date.now() });
      const descIpfsUri = await this.uploadToIpfs({ kind: 'project_description', description: projectDescription, fromGrievance: grievanceId, createdAt: Date.now() });

      // Convert to bytes32 digests
      const titleDigest = this.cidToBytes32(titleIpfsUri);
      const descDigest = this.cidToBytes32(descIpfsUri);
      const fundingGoal = ethers.parseEther(budget || '0');

      // Step 2: Attempt to create the project in ProjectRegistry
      // Prefer meta, but only if ProjectRegistry trusts the forwarder; otherwise fall back to direct.
      const metaReady = await this.shouldUseMetaTransaction();
      const registryTrustsForwarder = await this.isTrustedForwarderFor(environment.contracts.ProjectRegistry).catch(() => false);
      if (metaReady && registryTrustsForwarder) {
        const hash = await this.sendMetaTransaction(
          environment.contracts.ProjectRegistry,
          'createProject',
          [areaIdNum, titleDigest, descDigest, projectManager, fundingGoal.toString()]
        );
        // Try to link grievance -> project by parsing the emitted ProjectCreated from the tx receipt
        try {
          const provider = this.web3Service.getProvider();
          const receipt = (provider && hash) ? await provider.getTransactionReceipt(hash as string) : null;
          if (receipt && this.projectRegistryContract?.interface) {
            const iface = this.projectRegistryContract.interface;
            let createdId: number | null = null;
            for (const log of receipt.logs || []) {
              try {
                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === 'ProjectCreated') {
                  const pid = (parsed.args && (parsed.args['projectId'] ?? parsed.args[0])) as any;
                  createdId = Number(pid);
                  break;
                }
              } catch {}
            }
            if (createdId && this.grievanceHubContract) {
              try {
                const linkTx = await this.grievanceHubContract['linkToProject'](grievanceIdNum, createdId);
                await linkTx.wait();
              } catch (linkErr) {
                console.warn('Failed to link grievance to project after meta create:', linkErr);
              }
            }
          }
        } catch {}
        return hash;
      } else {
        try {
          const tx = await this.projectRegistryContract['createProject'](areaIdNum, titleDigest, descDigest, projectManager, fundingGoal);
          const receipt = await tx.wait();
          // Parse ProjectCreated to obtain projectId and link it
          try {
            if (receipt && this.projectRegistryContract?.interface) {
              const iface = this.projectRegistryContract.interface;
              let createdId: number | null = null;
              for (const log of receipt.logs || []) {
                try {
                  const parsed = iface.parseLog(log);
                  if (parsed && parsed.name === 'ProjectCreated') {
                    const pid = (parsed.args && (parsed.args['projectId'] ?? parsed.args[0])) as any;
                    createdId = Number(pid);
                    break;
                  }
                } catch {}
              }
              if (createdId && this.grievanceHubContract) {
                try {
                  const linkTx = await this.grievanceHubContract['linkToProject'](grievanceIdNum, createdId);
                  await linkTx.wait();
                } catch (linkErr) {
                  console.warn('Failed to link grievance to project:', linkErr);
                }
              }
            }
          } catch {}
          return receipt?.hash ?? null;
        } catch (e: any) {
          // If AccessControl reverts due to missing ADMIN_HEAD_ROLE on ProjectRegistry, continue gracefully
          const reason = String(e?.reason || e?.message || e);
          if (/AccessControl: account .* is missing role/i.test(reason)) {
            console.warn('ProjectRegistry permission denied for createProject: ADMIN_HEAD_ROLE not granted on ProjectRegistry. Marking grievance accepted; project creation must be handled via ops/governance and linked later.');
            return null;
          }
          throw e;
        }
      }
    } catch (error) {
      console.error('Error escalating grievance to project:', error);
      return null;
    }
  }

  // Grievance Hub contract functions
  public async getGrievancesForCitizen(address: string): Promise<any[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      const grievanceCount = await this.grievanceHubContract['getGrievanceCountForCitizen'](address);
      const grievances = [];
      
      for (let i = 0; i < grievanceCount; i++) {
        const id = await this.grievanceHubContract['getCitizenGrievanceIdAtIndex'](address, i);
        const grievance = await this.grievanceHubContract['getGrievance'](id);
        grievances.push({
          id,
          title: grievance.title,
          description: grievance.description,
          status: grievance.status,
          citizen: grievance.citizen,
          validator: grievance.validator,
          createdAt: new Date(Number(grievance.createdAt) * 1000),
          updatedAt: new Date(Number(grievance.updatedAt) * 1000)
        });
      }
      
      return grievances;
    } catch (error) {
      console.error('Error getting grievances:', error);
      return [];
    }
  }

  public async fileGrievance(title: string, description: string, documentsIpfsUri: string): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');

      // Determine user's areaId from UrbanCore citizen info
      const userAddr = this.web3Service.getAccount();
      if (!userAddr) throw new Error('Wallet not connected');
      const citizenInfo = await this.getCitizenInfo(userAddr);
      const areaIdStr = citizenInfo?.areaId?.toString?.() || '0';
      const areaIdNum = parseInt(areaIdStr, 10);
      if (!Number.isFinite(areaIdNum) || areaIdNum <= 0) {
        throw new Error('Unable to determine your area. Ensure your account is registered and approved.');
      }

      // Upload title/description to IPFS if raw strings were provided previously; here we assume title/description are raw text
      const titleIpfsUri = await this.uploadToIpfs({ kind: 'grievance_title', title, createdAt: Date.now() });
      const bodyIpfsUri = await this.uploadToIpfs({ kind: 'grievance_body', description, documents: documentsIpfsUri, createdAt: Date.now() });

      // Convert to bytes32 digests expected by contract
      const titleDigest = this.cidToBytes32(titleIpfsUri);
      const bodyDigest = this.cidToBytes32(bodyIpfsUri);

      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      if (useMeta) {
        const txHash = await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'fileGrievance',
          [areaIdNum, titleDigest, bodyDigest]
        );
        return txHash || null;
      } else {
        const tx = await this.grievanceHubContract['fileGrievance'](areaIdNum, titleDigest, bodyDigest);
        const receipt = await tx.wait();
        return receipt?.hash ?? null;
      }
    } catch (error) {
      console.error('Error filing grievance:', error);
      return null;
    }
  }

  // Project Registry contract functions
  public async getProjectsInArea(areaId: number): Promise<any[]> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Get project IDs for this area directly
      const ids: any[] = await this.projectRegistryContract['getAreaProjects'](Number(areaId));
      const projects: any[] = [];
      for (const id of ids || []) {
        try {
          const project = await this.getProject(Number(id));
          if (project) projects.push(project);
        } catch (err) {
          console.warn(`Error getting project ${id} for area ${areaId}:`, err);
        }
      }
      return projects;
    } catch (error) {
      console.error('Error getting projects in area:', error);
      return [];
    }
  }

  // Tax Module contract functions
  public async getTaxAssessmentsForCitizen(address: string): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      const assessmentCount = await this.taxModuleContract['getTaxAssessmentCountForCitizen'](address);
      const assessments = [];
      
      for (let i = 0; i < Number(assessmentCount); i++) {
        const id = await this.taxModuleContract['getCitizenTaxAssessmentIdAtIndex'](address, i);
        const assessment = await this.taxModuleContract['getTaxAssessment'](id);
        
        // Handle different contract structures safely
        const dueDate = assessment.dueDate;
        let dueDateObj;
        
        if (typeof dueDate === 'number') {
          dueDateObj = new Date(dueDate * 1000);
        } else if (dueDate && typeof dueDate.toNumber === 'function') {
          dueDateObj = new Date(dueDate.toNumber() * 1000);
        } else {
          dueDateObj = new Date(Number(dueDate) * 1000);
        }
        
        assessments.push({
          id: id.toString(),
          amount: ethers.formatEther(assessment.amount),
          dueDate: dueDateObj,
          status: assessment.paid ? 'paid' : 'unpaid',
          details: assessment.details || ''
        });
      }
      
      return assessments;
    } catch (error) {
      console.error('Error getting tax assessments:', error);
      return [];
    }
  }

  // Meta transaction helper functions
  private async shouldUseMetaTransaction(): Promise<boolean> {
    // Check if a configured TX_PAYER is ready (has role, enough balance). Warn if forwarder unverified.
    try {
      const trusted = await this.isTrustedForwarderConfigured().catch(() => false);
      if (!trusted) {
        console.warn('Trusted forwarder not verified on UrbanCore. Proceeding with meta-tx only if TX_PAYER is healthy.');
      }

      const status = await this.getTxPayerStatus('0.01');
      return Boolean(status?.hasRole && status?.sufficient);
    } catch {
      return false;
    }
  }

  public async sendMetaTransaction(
    targetContract: string,
    functionName: string,
    params: any[]
  ): Promise<string | null> {
    try {
      console.log(`Starting meta transaction for ${functionName}...`);
      
      // Check if we should use meta transaction pattern
      const shouldUseMeta = await this.shouldUseMetaTransaction();
      if (!shouldUseMeta) {
        console.error('No suitable TX_PAYER accounts available or they have insufficient balance');
        throw new Error('No TX_PAYER accounts available for gasless transaction');
      }
      
      if (!this.metaForwarderContract) await this.initContracts();
      if (!this.metaForwarderContract) throw new Error('Meta Forwarder contract not initialized');
      
      const signer = this.web3Service.getSigner();
      if (!signer) throw new Error('Signer not available');
      
      const userAddress = await signer.getAddress();
      console.log('User address:', userAddress);
      
      // Get ABI interface for the target contract and encode function call properly
      console.log(`Encoding function data for ${functionName} with params:`, params);
      await this.initContracts();
      const toAddress = targetContract.toLowerCase();
      let abiInterface: any = null;

      if (toAddress === environment.contracts.UrbanCore.toLowerCase() && this.urbanCoreContract) {
        abiInterface = this.urbanCoreContract.interface;
      } else if (toAddress === environment.contracts.GrievanceHub.toLowerCase() && this.grievanceHubContract) {
        abiInterface = this.grievanceHubContract.interface;
      } else if (toAddress === environment.contracts.ProjectRegistry.toLowerCase() && this.projectRegistryContract) {
        abiInterface = this.projectRegistryContract.interface;
      } else if (toAddress === environment.contracts.TaxModule.toLowerCase() && this.taxModuleContract) {
        abiInterface = this.taxModuleContract.interface;
      } else if (environment.contracts.UrbanToken && toAddress === environment.contracts.UrbanToken.toLowerCase() && this.urbanTokenContract) {
        abiInterface = this.urbanTokenContract.interface;
      }

      if (!abiInterface) {
        throw new Error('ABI interface not available for target contract');
      }

      const data = abiInterface.encodeFunctionData(functionName, params);
      
      console.log('Encoded function data:', data);
      
      // Get nonce for meta transaction
      const nonce = await this.metaForwarderContract['getNonce'](userAddress);
      console.log('Got nonce:', nonce.toString());
      
      // Ensure we're using the correct target contract for the specific function
      let finalTargetContract = targetContract;
      
      // For registerCitizen, always make sure we're targeting the UrbanCore contract
      if (functionName === 'registerCitizen') {
        finalTargetContract = environment.contracts.UrbanCore;
        console.log('Setting target contract to UrbanCore for registration:', finalTargetContract);
      }
      // Guard: ensure target trusts forwarder; otherwise meta-tx will revert in target
      const trustedTarget = await this.isTrustedForwarderFor(finalTargetContract).catch(() => false);
      if (!trustedTarget) {
        throw new Error('Target contract does not trust configured forwarder; meta-transaction not supported for this call');
      }
      
      // Create forward request object expected by the MetaForwarder.execute method
      const forwardRequest = {
        from: userAddress,
        to: finalTargetContract,
        value: 0,
        gas: 1000000, // Increased gas limit for complex operations
        nonce,
        data
      };
      
      console.log('Created forward request:', forwardRequest);
      
      // Sign meta transaction using EIP-712
      const domain = {
        name: 'MetaForwarder',
        version: '1.0.0', // Match version in contract constructor
        chainId: this.web3Service.getCurrentChainId() || environment.network.chainId,
        verifyingContract: environment.contracts.MetaForwarder
      };
      
      const types = {
        ForwardRequest: [ // Must match the contract's struct name
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'data', type: 'bytes' }
        ]
      };
      
      console.log('Signing meta transaction with EIP-712');
      const signature = await signer.signTypedData(domain, types, forwardRequest);
      console.log('Obtained signature:', signature);
      
      // ===== IMPORTANT CHANGE: Do not call execute directly from user's wallet =====
      // Instead, we'll call our backend API which will use a TX_PAYER account to execute
      console.log('Sending meta transaction request to relayer service');
      
      // Format the request for the relayer
      // Convert BigInt values to string to make them serializable
      const serializedForwardRequest = {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: forwardRequest.value.toString(),
        gas: forwardRequest.gas.toString(),
        nonce: forwardRequest.nonce.toString(),
        data: forwardRequest.data,
      };
      
      const relayRequest = {
        request: serializedForwardRequest,
        signature: signature
      };
      
      // In a production environment, this would call a backend API
      // For now, we'll simulate the success response since we don't have the actual backend
      console.log('Relayer request payload:', JSON.stringify(relayRequest));
      
      // Instead of just simulating, we will execute the transaction through the TX_PAYER_ROLE account
      // In a production environment, this would happen on a backend server
      // For development purposes, we'll execute it directly if the current account has TX_PAYER_ROLE
      
      try {
        // Get the current user's address from the connected wallet
        const account = this.web3Service.getAccount();
        
        if (!account) {
          console.error('No connected account found');
          throw new Error('No connected account found');
        }
        
        console.log('Current account from web3Service:', account);
        
        // Get the current user's role
        const currentUserRole = await this.getUserRole(account);
        const txPayerAccounts = await this.getRoleHolders(UserRole.TX_PAYER_ROLE);
        
        console.log('Current user role:', currentUserRole);
        console.log('TX_PAYER accounts:', txPayerAccounts);
        console.log('Current account:', account);
        
        // Check if the current account has TX_PAYER_ROLE or if we should attempt to execute ourselves
        if (currentUserRole === UserRole.TX_PAYER_ROLE && txPayerAccounts.includes(account)) {
          console.log('Current account has TX_PAYER_ROLE, executing transaction directly');
          
          // Get signer for the current user (who has TX_PAYER_ROLE)
          const txPayerSigner = this.web3Service.getSigner();
          
          // Check if we successfully got a signer
          if (!txPayerSigner) {
            console.error('Failed to get signer for TX_PAYER account');
            throw new Error('Failed to get signer for TX_PAYER account');
          }

          // Connect the signer to the contract
          const metaForwarderWithSigner = this.metaForwarderContract.connect(txPayerSigner);
          
          const txPayerAddress = await txPayerSigner.getAddress();
          console.log('Executing meta-transaction with TX_PAYER account:', txPayerAddress);
          console.log('Transaction data:', {
            request: serializedForwardRequest,
            signature: signature
          });
          
          // Define the ForwardRequest struct for the execute method
          const forwardRequestForContract = [
            forwardRequest.from,
            forwardRequest.to,
            forwardRequest.value,
            forwardRequest.gas,
            forwardRequest.nonce,
            forwardRequest.data
          ];
          
          // Get the current gas price with a buffer for faster confirmation
          const currentGasPrice = await this.web3Service.getProvider()?.getFeeData();
          
          console.log('Current network fee data:', currentGasPrice);
          
          // Use maxFeePerGas and maxPriorityFeePerGas if EIP-1559 is supported
          // Otherwise fall back to gasPrice
          const txOptions: any = { gasLimit: 2000000 }; // Increased gas limit for safety
          
          if (currentGasPrice?.maxFeePerGas && currentGasPrice?.maxPriorityFeePerGas) {
            // EIP-1559 transaction
            const maxFeePerGas = currentGasPrice.maxFeePerGas * BigInt(12) / BigInt(10); // 20% higher
            const maxPriorityFeePerGas = currentGasPrice.maxPriorityFeePerGas * BigInt(15) / BigInt(10); // 50% higher
            
            txOptions.maxFeePerGas = maxFeePerGas;
            txOptions.maxPriorityFeePerGas = maxPriorityFeePerGas;
            
            console.log('Using EIP-1559 fee structure:', {
              maxFeePerGas: maxFeePerGas.toString(),
              maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
            });
          } else if (currentGasPrice?.gasPrice) {
            // Legacy transaction
            txOptions.gasPrice = currentGasPrice.gasPrice * BigInt(12) / BigInt(10); // 20% higher
            console.log('Using legacy fee structure:', { gasPrice: txOptions.gasPrice.toString() });
          }
          
          console.log('Transaction options:', txOptions);
          
          // Execute the transaction with proper typing and optimized gas settings
          console.log('Executing meta-transaction with the following parameters:');
          console.log('- Forward request:', forwardRequestForContract);
          console.log('- Signature:', signature);
          console.log('- TX options:', txOptions);
          
          // Preflight checks: on-chain verify and static call to catch errors early
          try {
            const isValid = await (this.metaForwarderContract as any).verify(
              forwardRequestForContract,
              signature
            );
            console.log('Preflight verify (user TX_PAYER):', isValid);
            if (!isValid) {
              throw new Error('Meta-tx signature/nonce invalid');
            }
            // Simulate execution without spending gas (supports ethers v5/v6)
            await this.simulateMetaForwarderExecute(forwardRequestForContract, signature);
            console.log('Preflight callStatic.execute passed (user TX_PAYER)');
          } catch (preErr) {
            const decoded = this.decodeCustomError(preErr);
            console.error('Meta-tx preflight failed (user TX_PAYER):', decoded || preErr);
            throw new Error(decoded || ((preErr as any)?.message || 'Meta-tx preflight failed'));
          }
          
          const tx = await (metaForwarderWithSigner as any).execute(
            forwardRequestForContract, 
            signature, 
            txOptions
          );
          
          console.log('Transaction submitted to blockchain, hash:', tx.hash);
          console.log('Waiting for transaction confirmation...');
          
          // Wait for transaction to be mined with proper error handling
          try {
            console.log('Waiting for transaction to be mined, hash:', tx.hash);
            console.log('View on explorer:', `${environment.network.blockExplorer}/tx/${tx.hash}`);
            
            // Wait for more confirmations to ensure transaction is properly recorded
            const receipt = await tx.wait(2); // Wait for 2 confirmations for better reliability
            
            if (!receipt || receipt.status !== 1) {
              console.error('Transaction failed or returned invalid receipt:', receipt);
              throw new Error('Transaction failed to be confirmed on the blockchain');
            }
            
            console.log('Transaction confirmed with receipt:', receipt);
            console.log('Transaction success confirmed with status:', receipt.status);
            console.log('Block number:', receipt.blockNumber);
            console.log('Gas used:', receipt.gasUsed.toString());
            
            // Store transaction hash in local storage for recovery in case of page refresh
            try {
              localStorage.setItem('lastMetaTxHash', tx.hash);
              localStorage.setItem('lastMetaTxTimestamp', Date.now().toString());
            } catch (storageError) {
              console.warn('Could not save transaction info to localStorage:', storageError);
            }
            
            // Return transaction hash as confirmation
            return 'meta-tx-executed-' + tx.hash;
          } catch (confirmError: any) {
            const decoded = this.decodeCustomError(confirmError);
            console.error('Error waiting for transaction confirmation:', decoded || confirmError);
            
            // Store the pending transaction info even if we couldn't confirm it
            // This allows recovery on page refresh
            try {
              localStorage.setItem('pendingMetaTxHash', tx.hash);
              localStorage.setItem('pendingMetaTxTimestamp', Date.now().toString());
            } catch (storageError) {
              console.warn('Could not save pending transaction info to localStorage:', storageError);
            }
            
            // Even though confirmation failed, return the transaction hash
            // The transaction might still be confirmed later
            console.log('Transaction was submitted but confirmation failed or timed out');
            console.log('Transaction might still be confirmed later');
            console.log('Transaction hash for manual verification:', tx.hash);
            
            // Return a special indicator for pending transactions
            return 'meta-tx-pending-' + tx.hash;
          }
        } // end if current user has TX_PAYER_ROLE
        else {
          // We don't have TX_PAYER_ROLE, use configured TX_PAYER from environment
          console.log('Current account does not have TX_PAYER_ROLE, using configured TX_PAYER account');
          
          const configuredTxPayer = environment.rolesMapping?.TX_PAYER_ROLE;
          if (!configuredTxPayer) {
            throw new Error('TX_PAYER_ROLE address not configured in environment.rolesMapping');
          }
          
          // Use a private key for the TX_PAYER account (dev only). In production, relay via backend.
          const txPayerPrivateKey = environment.txPayerPrivateKey;
          
          // Check if we have the private key available (development mode only)
          if (!txPayerPrivateKey) {
            console.error('TX_PAYER private key not available in environment');
            throw new Error('TX_PAYER configuration missing. Cannot execute meta-transaction.');
          }
          
          try {
            // Create a wallet instance for the TX_PAYER account
            const walletProvider = this.web3Service.getProvider();
            if (!walletProvider) {
              throw new Error('Ethereum provider not available');
            }
            const txPayerWallet = new ethers.Wallet(txPayerPrivateKey, walletProvider);
            const walletAddr = (await txPayerWallet.getAddress()).toLowerCase();
            console.log('TX_PAYER wallet created, address:', walletAddr);

            if (walletAddr !== configuredTxPayer.toLowerCase()) {
              throw new Error(`TX_PAYER private key address (${walletAddr}) does not match configured rolesMapping.TX_PAYER_ROLE (${configuredTxPayer})`);
            }

            // Validate the wallet has TX_PAYER_ROLE on-chain
            if (!this.urbanCoreContract) await this.initContracts();
            if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
            const roleBytes = this.getRoleConstant(UserRole.TX_PAYER_ROLE);
            if (roleBytes) {
              const hasRole = await this.urbanCoreContract['hasRole'](roleBytes, configuredTxPayer);
              if (!hasRole) {
                throw new Error(`Configured TX_PAYER address ${configuredTxPayer} does not have TX_PAYER_ROLE on-chain`);
              }
            }

            // Ensure min balance for gas
            try {
              let balEth = 0;
              if (walletProvider) {
                const bal = await walletProvider.getBalance(configuredTxPayer);
                balEth = Number(ethers.formatEther(bal));
              }
              if (balEth < 0.01) {
                throw new Error(`Configured TX_PAYER has low balance (${balEth} ETH). Fund it to cover gas.`);
              }
            } catch (e) {
              console.warn('Could not verify TX_PAYER balance', e);
            }

            // Connect the wallet to the MetaForwarder contract
            const metaForwarderWithTxPayer = this.metaForwarderContract!.connect(txPayerWallet);
            
            console.log('Transaction data:', {
              request: serializedForwardRequest,
              signature: signature
            });
            
            // Define the ForwardRequest struct for the execute method
            const forwardRequestForContract = [
              forwardRequest.from,
              forwardRequest.to,
              forwardRequest.value,
              forwardRequest.gas,
              forwardRequest.nonce,
              forwardRequest.data
            ];
            
            // Get the current gas price with a buffer for faster confirmation
            const provider = this.web3Service.getProvider();
            if (!provider) {
              throw new Error('Ethereum provider not available');
            }
            const feeData = await provider.getFeeData();
            // Also fetch latest block for base fee (for EIP-1559 calc)
            const latestBlock = await provider.getBlock('latest');
            const baseFee = latestBlock?.baseFeePerGas ?? 0n;
            console.log('Current network fee data:', feeData, 'baseFee:', baseFee.toString());

            // Use maxFeePerGas and maxPriorityFeePerGas if EIP-1559 is supported
            // Otherwise fall back to gasPrice
            const txOptions: any = { gasLimit: 2000000 }; // Increased gas limit for safety

            if (feeData && feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
              // EIP-1559 transaction with safe guards
              const suggestedPrio = feeData.maxPriorityFeePerGas ?? 1_500_000_000n; // default 1.5 gwei
              // Slight bump on priority (max 3 gwei)
              let maxPriorityFeePerGas = (suggestedPrio * 12n) / 10n; // +20%
              const hardCapPrio = 3_000_000_000n; // 3 gwei cap to be safe on Sepolia
              if (maxPriorityFeePerGas > hardCapPrio) {
                maxPriorityFeePerGas = hardCapPrio;
              }

              // Candidate max fee: 2x base + priority, then +20% buffer
              const candidate = ((baseFee * 2n) + maxPriorityFeePerGas);
              let maxFeePerGas = (candidate * 12n) / 10n; // +20%

              // Consider provider's suggested max fee (with +20% bump) if available
              if (feeData.maxFeePerGas != null) {
                const suggestedBumped = (feeData.maxFeePerGas * 12n) / 10n;
                if (suggestedBumped > maxFeePerGas) {
                  maxFeePerGas = suggestedBumped;
                }
              }

              // Final guard: ensure maxFee >= priority
              if (maxFeePerGas < maxPriorityFeePerGas) {
                maxFeePerGas = maxPriorityFeePerGas + (baseFee * 2n);
              }

              txOptions.maxFeePerGas = maxFeePerGas;
              txOptions.maxPriorityFeePerGas = maxPriorityFeePerGas;

              console.log('Using EIP-1559 fee structure:', {
                maxFeePerGas: maxFeePerGas.toString(),
                maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
              });
            } else if (feeData && feeData.gasPrice != null) {
              // Legacy transaction
              txOptions.gasPrice = (feeData.gasPrice * 12n) / 10n; // +20%
              console.log('Using legacy fee structure:', { gasPrice: txOptions.gasPrice.toString() });
            }
            
            console.log('Executing meta-transaction with TX_PAYER account with parameters:');
            console.log('- Forward request:', forwardRequestForContract);
            console.log('- Signature:', signature);
            console.log('- TX options:', txOptions);
            
            // Preflight checks: on-chain verify and static call to catch errors early
            try {
              const isValid = await (this.metaForwarderContract as any).verify(
                forwardRequestForContract,
                signature
              );
              console.log('Preflight verify (configured TX_PAYER):', isValid);
              if (!isValid) {
                throw new Error('Meta-tx signature/nonce invalid');
              }
              // Simulate execution without spending gas (supports ethers v5/v6)
              await this.simulateMetaForwarderExecute(forwardRequestForContract, signature);
              console.log('Preflight callStatic.execute passed (configured TX_PAYER)');
            } catch (preErr) {
              console.error('Meta-tx preflight failed (configured TX_PAYER):', preErr);
              throw preErr;
            }
            
            // Execute the transaction using the TX_PAYER account
            const tx = await (metaForwarderWithTxPayer as any).execute(
              forwardRequestForContract,
              signature,
              txOptions
            );
            
            console.log('Transaction submitted to blockchain by TX_PAYER, hash:', tx.hash);
            console.log('Waiting for transaction confirmation...');
            
            // Wait for transaction to be mined with proper error handling
            console.log('View on explorer:', `${environment.network.blockExplorer}/tx/${tx.hash}`);
            
            // Wait for more confirmations to ensure transaction is properly recorded
            const receipt = await tx.wait(2); // Wait for 2 confirmations for better reliability
            
            if (!receipt || receipt.status !== 1) {
              console.error('Transaction failed or returned invalid receipt:', receipt);
              throw new Error('Transaction failed to be confirmed on the blockchain');
            }
            
            console.log('Transaction confirmed with receipt:', receipt);
            console.log('Transaction success confirmed with status:', receipt.status);
            console.log('Block number:', receipt.blockNumber);
            console.log('Gas used:', receipt.gasUsed.toString());
            
            // Store transaction hash in local storage for recovery in case of page refresh
            try {
              localStorage.setItem('lastMetaTxHash', tx.hash);
              localStorage.setItem('lastMetaTxTimestamp', Date.now().toString());
            } catch (storageError) {
              console.warn('Could not save transaction info to localStorage:', storageError);
            }
            
            // Return transaction hash as confirmation
            return 'meta-tx-executed-' + tx.hash;
          } catch (txPayerError: any) {
            const decoded = this.decodeCustomError(txPayerError);
            console.error('Error executing meta-transaction with TX_PAYER account:', decoded || txPayerError);
            throw new Error('Failed to execute meta-transaction with TX_PAYER account: ' + 
              (decoded || (txPayerError as any).message || 'Unknown error'));
          }
        }
      } catch (txError: any) {
        console.error('Error executing meta-transaction:', txError);
        throw new Error('Failed to execute meta-transaction: ' + ((txError as any).message || 'Unknown error'));
      }
    } catch (error) {
      const decoded = this.decodeCustomError(error);
      console.error('Error sending meta transaction:', decoded || error);
      return null;
    }
  }

  // Simulate MetaForwarder.execute in a version-agnostic way (ethers v5/v6)
  private async simulateMetaForwarderExecute(forwardReq: any, signature: string): Promise<void> {
    const contractAny: any = this.metaForwarderContract as any;
    if (!contractAny) {
      throw new Error('MetaForwarder contract not initialized');
    }
    // Try ethers v6 simulate API first
    if (contractAny.simulate && contractAny.simulate.execute) {
      await contractAny.simulate.execute(forwardReq, signature);
      return;
    }
    // Try ethers v5 callStatic path
    if (contractAny.callStatic && contractAny.callStatic.execute) {
      await contractAny.callStatic.execute(forwardReq, signature);
      return;
    }
    // Fallback: raw provider call using encoded data
    const iface = contractAny.interface;
    const data = iface.encodeFunctionData('execute', [forwardReq, signature]);
    const to = contractAny.address ?? contractAny.target; // v5 uses address, v6 uses target
    const provider: any = contractAny.runner ?? contractAny.provider ?? (this as any).provider;
    if (!provider) {
      throw new Error('No provider available to simulate meta-transaction');
    }
    await provider.call({ to, data, value: '0x0' });
  }

  // Getter methods for contracts with initialization checks
  public async getUrbanCoreContract(): Promise<ethers.Contract> {
    // If contract is not initialized, attempt to initialize
    if (!this.urbanCoreContract) {
      console.log('UrbanCore contract not initialized, attempting initialization...');
      await this.initContracts();
      
      // Check again after initialization attempt
      if (!this.urbanCoreContract) {
        throw new Error('Urban Core contract initialization failed');
      }
    }
    
    return this.urbanCoreContract;
  }

  public getUrbanTokenContract(): ethers.Contract | null {
    return this.urbanTokenContract;
  }

  public getGrievanceHubContract(): ethers.Contract | null {
    return this.grievanceHubContract;
  }

  public async getProjectRegistryContract(): Promise<ethers.Contract | null> {
    // Ensure contracts are initialized
    if (!this.projectRegistryContract) {
      await this.initContracts();
    } else {
      // If cached instance points to old address, reset and re-init
      try {
        const desired = environment.contracts.ProjectRegistry?.toLowerCase();
        const current = String(((this.projectRegistryContract as any).target || (this.projectRegistryContract as any).address) || '').toLowerCase();
        if (desired && current && desired !== current) {
          console.warn('Detected ProjectRegistry address mismatch; refreshing contract binding');
          this.projectRegistryContract = null;
          await this.initContracts();
        }
      } catch {}
    }
    return this.projectRegistryContract || null;
  }

  public getTaxModuleContract(): ethers.Contract | null {
    return this.taxModuleContract;
  }
  
  // Get all tax assessments for an area
  public async getTaxAssessmentsByArea(areaId: string): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.taxModuleContract || !this.urbanCoreContract) {
        throw new Error('Required contracts not initialized');
      }
      
      // First get all citizens in the area
      const citizensInArea = await this.getCitizensByArea(areaId);
      const assessments = [];
      
      // For each citizen, get their tax assessments
      for (const citizen of citizensInArea) {
        const citizenAssessments = await this.getTaxAssessmentsForCitizen(citizen.address);
        
        // Add citizen info to each assessment
        for (const assessment of citizenAssessments) {
          assessments.push({
            ...assessment,
            citizenAddress: citizen.address,
            citizenName: citizen.name || this.formatAddress(citizen.address)
          });
        }
      }
      
      // Sort by due date (most recent first)
      return assessments.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
    } catch (error) {
      console.error('Error getting tax assessments by area:', error);
      return [];
    }
  }
  
  // This createTaxAssessment implementation has been moved to the full implementation below
  // to avoid duplicate function implementation errors
  
  // Get tax collection statistics
  public async getTaxStats(): Promise<any> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      const totalCollected = await this.getTotalTaxCollected();
      const totalAssessmentCount = await this.taxModuleContract['getTotalTaxAssessmentCount']();
      const paidAssessmentCount = await this.taxModuleContract['getPaidTaxAssessmentCount']();
      const pendingAssessmentCount = Number(totalAssessmentCount) - Number(paidAssessmentCount);
      
      // Calculate collection rate as percentage
      const collectionRate = Number(totalAssessmentCount) > 0
        ? (Number(paidAssessmentCount) * 100 / Number(totalAssessmentCount)).toFixed(2)
        : '0';
      
      return {
        totalCollected,
        totalAssessmentCount: Number(totalAssessmentCount),
        paidAssessmentCount: Number(paidAssessmentCount),
        pendingAssessmentCount,
        collectionRate: `${collectionRate}%`
      };
    } catch (error) {
      console.error('Error getting tax stats:', error);
      return {
        totalCollected: '0',
        totalAssessmentCount: 0,
        paidAssessmentCount: 0,
        pendingAssessmentCount: 0,
        collectionRate: '0%'
      };
    }
  }
  
  // Pay a tax assessment
  public async payTaxAssessment(assessmentId: string): Promise<boolean> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // Get the assessment details to determine the amount
      const assessment = await this.taxModuleContract['getTaxAssessment'](assessmentId);
      
      // Execute the payment transaction
      const tx = await this.taxModuleContract['payTaxAssessment'](assessmentId, {
        value: assessment.amount
      });
      
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error paying tax assessment:', error);
      return false;
    }
  }

  public async getMetaForwarderContract(): Promise<ethers.Contract | null> {
    // Initialize contracts if not already done
    if (!this.metaForwarderContract) {
      await this.initContracts();
    }
    return this.metaForwarderContract || null;
  }
  public async getAreaDetails(areaId: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const numericAreaId = typeof areaId === 'string' ? Number(areaId) : (areaId as any);
      // UrbanCore ABI exposes getAreaHead(areaId) and not getArea()
      const adminHead = await this.urbanCoreContract['getAreaHead'](numericAreaId);
      // Optionally derive citizen count via helper (best-effort)
      let citizenCount = 0;
      try { citizenCount = await this.getAreaCitizenCount(String(numericAreaId)); } catch {}
      return { id: String(numericAreaId), adminHead, citizenCount };
    } catch (error) {
      console.error(`Error getting area details for area ${areaId}:`, error);
      return {};
    }
  }

  // Returns a TransactionResponse-like object supporting wait() for both meta and direct flows
  public async assignAreaAdminHead(areaId: string, adminHeadAddress: string): Promise<{ hash: string; wait: () => Promise<any> }> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');

      const numericAreaId = typeof areaId === 'string' ? Number(areaId) : (areaId as any);
      const useMeta = await this.shouldUseMetaTransaction();
      if (useMeta) {
        const txHash = await this.sendMetaTransaction(
          environment.contracts.UrbanCore,
          'assignAreaHead',
          [numericAreaId, adminHeadAddress]
        );
        if (!txHash) throw new Error('Meta-transaction failed to submit');
        const hash: string = txHash!;
        return { hash, wait: async () => ({ hash }) };
      } else {
        const tx = await this.urbanCoreContract['assignAreaHead'](numericAreaId, adminHeadAddress);
        // Return TransactionResponse so caller can call tx.wait()
        return { hash: tx.hash, wait: async () => await tx.wait() };
      }
    } catch (error) {
      console.error(`Error assigning admin head to area ${areaId}:`, error);
      throw error;
    }
  }

  // Role management functions
  public async getRoleHolders(role: UserRole): Promise<string[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleBytes = this.getRoleConstant(role);
      if (!roleBytes) {
        console.error(`No constant found for role ${role}`);
        return [];
      }

      // If TX_PAYER is requested and configured, prefer returning the configured address when it has the role
      if (role === UserRole.TX_PAYER_ROLE && environment.rolesMapping?.TX_PAYER_ROLE) {
        const configured = environment.rolesMapping.TX_PAYER_ROLE;
        try {
          const ok = await this.urbanCoreContract['hasRole'](roleBytes, configured);
          if (ok) return [configured];
        } catch {}
      }

      // Discover role holders by scanning UrbanCore events
      const provider = this.web3Service.getProvider();
      if (!provider) throw new Error('No provider available');
      const latestBlock = await provider.getBlockNumber();
      // Use specific signatures to avoid ambiguity (OZ vs custom events)
      const assignedCustomFilter = (this.urbanCoreContract as any).filters['RoleAssigned'](null, roleBytes, null);
      const grantedFilter = (this.urbanCoreContract as any).filters['RoleGranted(bytes32,address,address)'](roleBytes, null, null);
      const revokedCustomFilter = (this.urbanCoreContract as any).filters['RoleRevoked(address,bytes32,address)'](null, roleBytes, null);
      const revokedAccessFilter = (this.urbanCoreContract as any).filters['RoleRevoked(bytes32,address,address)'](roleBytes, null, null);
      const [assignedLogs, grantedLogs, revokedCustomLogs, revokedAccessLogs] = await Promise.all([
        this.urbanCoreContract.queryFilter(assignedCustomFilter, 0, latestBlock),
        this.urbanCoreContract.queryFilter(grantedFilter, 0, latestBlock),
        this.urbanCoreContract.queryFilter(revokedCustomFilter, 0, latestBlock),
        this.urbanCoreContract.queryFilter(revokedAccessFilter, 0, latestBlock)
      ]);

      const holders = new Set<string>();
      for (const log of assignedLogs) {
        const anyLog = log as any;
        const account: string = anyLog?.args?.account ?? anyLog?.args?.[0];
        if (account) holders.add(String(account).toLowerCase());
      }
      for (const log of grantedLogs) {
        const anyLog = log as any;
        const account: string = anyLog?.args?.account ?? anyLog?.args?.[1];
        if (account) holders.add(String(account).toLowerCase());
      }
      for (const log of revokedCustomLogs) {
        const anyLog = log as any;
        const account: string = anyLog?.args?.account ?? anyLog?.args?.[0];
        if (account) holders.delete(String(account).toLowerCase());
      }
      for (const log of revokedAccessLogs) {
        const anyLog = log as any;
        const account: string = anyLog?.args?.account ?? anyLog?.args?.[1];
        if (account) holders.delete(String(account).toLowerCase());
      }

      return Array.from(holders);
    } catch (error) {
      console.error(`Error getting role holders for ${role}:`, error);
      return [];
    }
  }

  public async getRoleRequests(role: UserRole): Promise<any[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Currently only CITIZEN_ROLE requests are implemented in the contract
      if (role !== UserRole.CITIZEN_ROLE) {
        console.warn(`Role requests for ${role} are not implemented yet`);
        return [];
      }
      
      // For CITIZEN_ROLE, we use getPendingRequests and getCitizenRequest
      const pendingAddresses = await this.urbanCoreContract['getPendingRequests']();
      console.log('Pending citizen request addresses:', pendingAddresses);
      
      const requests = [];
      for (let i = 0; i < pendingAddresses.length; i++) {
        const address = pendingAddresses[i];
        const requestDetails = await this.urbanCoreContract['getCitizenRequest'](address);
        
        // Fetch metadata via service (fallback to docsHash if no on-chain URI)
        let metadata: any = null;
        let ipfsUri: string | null = null;
        try {
          metadata = await this.getAddressMetadata(address);
          ipfsUri = metadata?.metadataUri || null;
        } catch (e) {
          console.warn(`Failed to derive metadata for ${address}:`, e);
        }

        const name = metadata?.name || null;
        // Derive document hash with priority: metadata.documentHash -> CID from ipfsUri -> on-chain docsHash
        const docsHashHex = requestDetails?.docsHash
          ? (typeof requestDetails.docsHash === 'string' ? requestDetails.docsHash : ethers.hexlify(requestDetails.docsHash))
          : null;
        const ipfsCid = ipfsUri && ipfsUri.startsWith('ipfs://') ? ipfsUri.replace('ipfs://', '') : null;
        const docsHashNormalized = docsHashHex ? docsHashHex.replace(/^0x/, '') : null;
        const documentHash = (metadata && metadata.documentHash)
          ? metadata.documentHash
          : (ipfsCid || docsHashNormalized);

        // Convert to milliseconds for Date constructor compatibility in UI
        const requestDate = Number(requestDetails.requestedAt) * 1000;

        requests.push({
          id: address, // Using the citizen address as the request ID
          address: address,
          requester: address,
          role: 'citizen', // This is a citizen request
          status: requestDetails.processed ? 'processed' : 'pending',
          requestDate,
          name,
          documentHash,
          metadataUri: ipfsUri || '',
          validator: requestDetails.validator,
          areaId: null // No area ID for citizen requests
        });
      }
      
      return requests;
    } catch (error) {
      console.error(`Error getting role requests for ${role}:`, error);
      return [];
    }
  }

  private resolveRoleRequestStatus(status: number): string {
    const statusMap: {[key: number]: string} = {
      0: 'pending',
      1: 'approved',
      2: 'rejected'
    };
    return statusMap[status] || 'unknown';
  }
  
  /**
   * Convert a bytes32 role constant from the contract to the UserRole enum
   * @param roleBytes The bytes32 role constant from the contract
   * @returns The corresponding UserRole enum value or UserRole.NONE if no match
   */
  public convertRoleToEnum(roleBytes: string): UserRole {
    // If null, undefined or zero bytes, return NONE
    if (!roleBytes || roleBytes.toLowerCase() === '0x' + '0'.repeat(64)) {
      return UserRole.NONE;
    }

    // Build dynamic hash map at runtime to avoid staleness
    const dynamicMap: Array<{ hash: string; role: UserRole }> = [
      { hash: this.getRoleConstant(UserRole.ADMIN_GOVT_ROLE)!, role: UserRole.ADMIN_GOVT_ROLE },
      { hash: this.getRoleConstant(UserRole.ADMIN_HEAD_ROLE)!, role: UserRole.ADMIN_HEAD_ROLE },
      { hash: this.getRoleConstant(UserRole.PROJECT_MANAGER_ROLE)!, role: UserRole.PROJECT_MANAGER_ROLE },
      { hash: this.getRoleConstant(UserRole.TAX_COLLECTOR_ROLE)!, role: UserRole.TAX_COLLECTOR_ROLE },
      { hash: this.getRoleConstant(UserRole.VALIDATOR_ROLE)!, role: UserRole.VALIDATOR_ROLE },
      { hash: this.getRoleConstant(UserRole.CITIZEN_ROLE)!, role: UserRole.CITIZEN_ROLE },
      { hash: this.getRoleConstant(UserRole.TX_PAYER_ROLE)!, role: UserRole.TX_PAYER_ROLE },
      // OWNER_ROLE is an alias to ADMIN_GOVT_ROLE on-chain; map to ADMIN_GOVT_ROLE for UI
      { hash: this.getRoleConstant(UserRole.OWNER_ROLE)!, role: UserRole.ADMIN_GOVT_ROLE }
    ].filter(e => !!e.hash);

    const target = String(roleBytes).toLowerCase();
    const found = dynamicMap.find(e => String(e.hash).toLowerCase() === target);
    return found ? found.role : UserRole.NONE;
  }

  public async approveRoleRequest(requestId: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // For citizen requests, requestId is the citizen's address
      // The contract uses approveCitizen method instead of approveRoleRequest
      // Pre-check: ensure current wallet is validator for the citizen's area to avoid revert
      const signer = this.web3Service.getSigner();
      const caller = await signer!.getAddress();
      // Verify request exists and not processed
      const req = await this.urbanCoreContract['getCitizenRequest'](requestId);
      const requestedAt = Number(req?.requestedAt ?? 0);
      const processed = Boolean(req?.processed ?? false);
      if (!req || requestedAt === 0) {
        throw new Error('Citizen request not found. The request may have been withdrawn or already processed.');
      }
      if (processed) {
        throw new Error('This citizen request has already been processed.');
      }
      // If request is assigned to a specific validator, enforce that
      const assignedValidator = String(req?.validator || '').toLowerCase();
      if (assignedValidator && assignedValidator !== '0x0000000000000000000000000000000000000000') {
        if (assignedValidator !== String(caller).toLowerCase()) {
          throw new Error(`Only the assigned validator (${assignedValidator}) can process this request. Switch to that account.`);
        }
      }
      // Not already approved
      const alreadyApproved = await this.urbanCoreContract['isApprovedCitizen'](requestId);
      if (alreadyApproved) {
        throw new Error('Citizen is already approved.');
      }
      // Derive areaId
      const areaIdBn = await this.urbanCoreContract['citizenArea'](requestId);
      let areaId = Number(areaIdBn);
      if (!Number.isFinite(areaId) || areaId <= 0) {
        // Try to derive areaId from the address metadata (IPFS)
        try {
          const meta = await this.getAddressMetadata(requestId);
          const metaAreaId = meta?.areaId ? Number(meta.areaId) : 0;
          if (Number.isFinite(metaAreaId) && metaAreaId > 0) {
            areaId = metaAreaId;
          }
        } catch {}
      }
      if (!Number.isFinite(areaId) || areaId <= 0) {
        throw new Error('Cannot determine the citizen\'s area. The registration metadata may be missing areaId.');
      }
      const isValidator = await this.urbanCoreContract['isAreaValidator'](areaId, caller);
      console.log(`[approveRoleRequest] caller=${caller} derivedAreaId=${areaId} isValidator=${isValidator}`);
      if (!isValidator) {
        throw new Error(`You are not the validator for this citizen's area (Area ${areaId}). Assign the validator role for this area or switch to the correct validator account.`);
      }
      const canMeta = (await this.shouldUseMetaTransaction()) && (await this.isTrustedForwarderFor(environment.contracts.UrbanCore));
      if (canMeta) {
        try {
          const hash = await this.sendMetaTransaction(environment.contracts.UrbanCore, 'approveCitizen', [requestId]);
          if (hash) {
            console.log('Citizen approved via meta-tx:', hash);
            return { hash, meta: true };
          }
          console.warn('Meta-tx returned null hash; falling back to direct transaction');
        } catch (e) {
          console.warn('Meta-tx path failed; falling back to direct transaction:', e);
        }
      }
      const tx = await this.urbanCoreContract['approveCitizen'](requestId);
      const receipt = await tx.wait();
      console.log('Citizen approved (direct):', receipt);
      return receipt;
    } catch (error) {
      const friendly = this.decodeCustomError(error) || (error as any)?.message || String(error);
      console.error(`Error approving citizen request ${requestId}:`, friendly);
      throw new Error(friendly);
    }
  }

  public async rejectRoleRequest(requestId: string, reason: string = 'Request rejected by validator'): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // For citizen requests, requestId is the citizen's address
      // The contract uses rejectCitizen method which requires a reason
      // Pre-check: ensure current wallet is validator for the citizen's area to avoid revert
      const signer = this.web3Service.getSigner();
      const caller = await signer!.getAddress();
      const areaIdBn = await this.urbanCoreContract['citizenArea'](requestId);
      const areaId = Number(areaIdBn);
      if (!Number.isFinite(areaId) || areaId === 0) {
        // Double-check whether request exists
        const req = await this.urbanCoreContract['getCitizenRequest'](requestId);
        if (!req || (Number(req.requestedAt) === 0 && !req.citizen)) {
          throw new Error('Citizen request not found. The request may have been withdrawn or already processed.');
        }
      }
      const isValidator = await this.urbanCoreContract['isAreaValidator'](areaId, caller);
      if (!isValidator) {
        throw new Error(`You are not the validator for this citizen's area (Area ${areaId}). Assign the validator role for this area or switch to the correct validator account.`);
      }
      const canMeta = (await this.shouldUseMetaTransaction()) && (await this.isTrustedForwarderFor(environment.contracts.UrbanCore));
      if (canMeta) {
        try {
          const hash = await this.sendMetaTransaction(environment.contracts.UrbanCore, 'rejectCitizen', [requestId, reason]);
          if (hash) {
            console.log('Citizen rejected via meta-tx:', hash);
            return { hash, meta: true };
          }
          console.warn('Meta-tx returned null hash for reject; falling back to direct transaction');
        } catch (e) {
          console.warn('Meta-tx reject path failed; falling back to direct transaction:', e);
        }
      }
      const tx = await this.urbanCoreContract['rejectCitizen'](requestId, reason);
      const receipt = await tx.wait();
      console.log('Citizen rejected (direct):', receipt);
      return receipt;
    } catch (error) {
      const friendly = this.decodeCustomError(error) || (error as any)?.message || String(error);
      console.error(`Error rejecting citizen request ${requestId}:`, friendly);
      throw new Error(friendly);
    }
  }

  public async grantRole(role: UserRole, address: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleConstant = this.getRoleConstant(role);
      if (!roleConstant) {
        console.error(`No constant found for role ${role}`);
        throw new Error(`Invalid role: ${role}`);
      }
      
      const tx = await this.urbanCoreContract['grantRole'](roleConstant, address);
      return tx;
    } catch (error) {
      console.error(`Error granting role ${role} to ${address}:`, error);
      throw error;
    }
  }

  public async grantRoleWithMetadata(role: UserRole, address: string, metadataUri: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleConstant = this.getRoleConstant(role);
      if (!roleConstant) {
        console.error(`No constant found for role ${role}`);
        throw new Error(`Invalid role: ${role}`);
      }
      
      const tx = await this.urbanCoreContract['grantRoleWithMetadata'](roleConstant, address, metadataUri);
      return tx;
    } catch (error) {
      console.error(`Error granting role ${role} with metadata to ${address}:`, error);
      throw error;
    }
  }

  public async revokeRole(role: UserRole, address: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleConstant = this.getRoleConstant(role);
      if (!roleConstant) {
        console.error(`No constant found for role ${role}`);
        throw new Error(`Invalid role: ${role}`);
      }
      
      const tx = await this.urbanCoreContract['revokeRole'](roleConstant, address);
      return tx;
    } catch (error) {
      console.error(`Error revoking role ${role} from ${address}:`, error);
      throw error;
    }
  }

  // IPFS functions
  public async uploadToIpfs(data: any): Promise<string> {
    try {
      // Prefer Pinata if JWT provided
      const ipfsCfg: any = (environment as any).ipfs || {};
      const jsonData = JSON.stringify(data);

      if (ipfsCfg.authJWT) {
        const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ipfsCfg.authJWT}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            pinataOptions: { cidVersion: 0 },
            pinataContent: data
          })
        });
        if (!res.ok) throw new Error(`Pinata upload failed: HTTP ${res.status}`);
        const out = await res.json();
        if (!out || !out.IpfsHash) throw new Error('Pinata response missing IpfsHash');
        return `ipfs://${out.IpfsHash}`;
      }

      // Fallback to Infura IPFS if basic auth is present
      if (ipfsCfg.basicAuth) {
        const form = new FormData();
        form.append('file', new Blob([jsonData], { type: 'application/json' }), 'metadata.json');
        const res = await fetch('https://ipfs.infura.io:5001/api/v0/add?pin=true&cid-version=0', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${ipfsCfg.basicAuth}`,
            'Accept': 'application/json'
          },
          body: form
        });
        if (!res.ok) throw new Error(`Infura IPFS upload failed: HTTP ${res.status}`);
        const out = await res.json().catch(async () => {
          // Some gateways can return text; try text fallback
          const text = await res.text();
          try { return JSON.parse(text); } catch { return { Hash: '' }; }
        });
        const cid = out.Hash || out.IpfsHash;
        if (!cid) throw new Error('Infura response missing Hash');
        return `ipfs://${cid}`;
      }

      throw new Error('No IPFS credentials configured. Set environment.ipfs.authJWT (Pinata) or basicAuth (Infura).');
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw error;
    }
  }

  // Upload a single file (Blob/File) to IPFS, preferring Pinata when configured
  public async uploadFileToIPFS(file: File | Blob, fileName?: string): Promise<string> {
    try {
      const ipfsCfg: any = (environment as any).ipfs || {};
      const name = fileName || (file instanceof File && (file as File).name ? (file as File).name : 'document');

      // Prefer Pinata when JWT is configured
      if (ipfsCfg.authJWT) {
        const form = new FormData();
        form.append('file', file, name);
        const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ipfsCfg.authJWT}`
          },
          body: form
        });
        if (!res.ok) throw new Error(`Pinata file upload failed: HTTP ${res.status}`);
        const out = await res.json();
        if (!out || !out.IpfsHash) throw new Error('Pinata response missing IpfsHash');
        return `ipfs://${out.IpfsHash}`;
      }

      // Fallback to Infura IPFS if basic auth is present
      if (ipfsCfg.basicAuth) {
        const form = new FormData();
        form.append('file', file, name);
        const res = await fetch('https://ipfs.infura.io:5001/api/v0/add?pin=true&cid-version=0', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${ipfsCfg.basicAuth}`,
            'Accept': 'application/json'
          },
          body: form
        });
        if (!res.ok) throw new Error(`Infura IPFS file upload failed: HTTP ${res.status}`);
        const out = await res.json().catch(async () => {
          // Some gateways can return text; try text fallback
          const text = await res.text();
          try { return JSON.parse(text); } catch { return { Hash: '' }; }
        });
        const cid = out.Hash || out.IpfsHash;
        if (!cid) throw new Error('Infura response missing Hash');
        return `ipfs://${cid}`;
      }

      throw new Error('No IPFS credentials configured. Set environment.ipfs.authJWT (Pinata) or basicAuth (Infura).');
    } catch (error) {
      console.error('Error uploading file to IPFS:', error);
      throw error;
    }
  }

  public async getIpfsJson(ipfsUri: string): Promise<any> {
    try {
      if (!ipfsUri) throw new Error('Missing IPFS URI');
      const gateways = this.getConfiguredIpfsGateways();
      const cidOrPath = this.extractCidOrPath(ipfsUri);
      if (!cidOrPath) throw new Error(`Unrecognized IPFS URI: ${ipfsUri}`);

      // Overall time budget per call (ms) to avoid long page stalls
      const overallBudgetMs = 5000;
      const deadline = Date.now() + overallBudgetMs;

      let lastErr: any = null;
      for (const gw of gateways) {
        const url = `${gw.baseUrl.replace(/\/$/, '')}/${cidOrPath}`;
        try {
          // Stop early if overall budget exceeded
          if (Date.now() > deadline) throw new Error('IPFS overall timeout exceeded');
          const res = await this.fetchWithTimeout(url, { headers: gw.headers }, 3000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          try {
            // Try JSON first
            const json = await res.clone().json();
            return json;
          } catch {
            // Some gateways mislabel content-type. Try text->JSON parse
            const text = await res.text();
            try { return JSON.parse(text); } catch { throw new Error('Invalid JSON content'); }
          }
        } catch (e) {
          lastErr = e;
          console.warn(`IPFS JSON fetch failed via ${url}:`, e);
        }
      }
      throw lastErr ?? new Error('All IPFS gateways failed');
    } catch (error) {
      console.error('Error getting IPFS JSON:', error);
      throw error;
    }
  }

  public async getAddressMetadata(address: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');

      // No on-chain metadata URI method exists in UrbanCore; derive from citizen request docsHash
      const req = await this.urbanCoreContract['getCitizenRequest'](address);
      if (!req || !req.citizen || req.citizen === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      const docsHashHex = req?.docsHash
        ? (typeof req.docsHash === 'string' ? req.docsHash : ethers.hexlify(req.docsHash))
        : '';

      // Try decode docsHash to ipfs:// URI and fetch JSON metadata
      let ipfsUri = '';
      let metadataJson: any = null;
      if (docsHashHex) {
        try {
          const decoded = ethers.toUtf8String(docsHashHex as any);
          if (decoded && decoded.startsWith('ipfs://')) {
            ipfsUri = decoded;
            try {
              metadataJson = await this.getIpfsJson(ipfsUri);
            } catch (e) {
              console.warn('Failed to fetch IPFS JSON for citizen request:', e);
            }
          }
        } catch {}
        // If not a utf8 ipfs:// string, try reconstructing CIDv0 from bytes32 digest (sha2-256)
        if (!ipfsUri && /^0x[0-9a-fA-F]{64}$/.test(docsHashHex)) {
          try {
            const cid = this.bytes32ToCid(docsHashHex);
            ipfsUri = `ipfs://${cid}`;
            try {
              metadataJson = await this.getIpfsJson(ipfsUri);
            } catch (e) {
              console.warn('Failed to fetch IPFS JSON via reconstructed CID:', e);
            }
          } catch (e) {
            console.warn('Failed to reconstruct CID from bytes32 docsHash:', e);
          }
        }
      }

      // Prefer document hash from metadata JSON if present
      let documentHash = '';
      const name = metadataJson?.name ?? null;

      try {
        const candidateFromMetadata = (metadataJson && typeof metadataJson === 'object')
          ? (metadataJson.documentHash || metadataJson.documentCid || metadataJson.documentURI || metadataJson.documentUrl)
          : null;
        const normalizeCid = (v: string) => v.startsWith('ipfs://') ? v.replace('ipfs://', '') : v;
        if (typeof candidateFromMetadata === 'string' && candidateFromMetadata.trim()) {
          documentHash = normalizeCid(candidateFromMetadata.trim());
        } else if (ipfsUri) {
          // fallback: use metadata CID (not ideal but better than empty)
          documentHash = normalizeCid(ipfsUri);
        } else if (docsHashHex) {
          documentHash = docsHashHex.replace(/^0x/, '');
        }
      } catch {}

      // Extract areaId if present in metadata JSON
      let areaIdFromMeta: string | null = null;
      try {
        const raw = (metadataJson && typeof metadataJson === 'object') ? (metadataJson as any).areaId : null;
        if (raw !== undefined && raw !== null) {
          areaIdFromMeta = raw.toString();
        }
      } catch {}

      return {
        name,
        documentHash,
        metadataUri: ipfsUri,
        timestamp: Number(req.requestedAt) || 0,
        areaId: areaIdFromMeta
      };
    } catch (error) {
      console.error(`Error getting metadata for address ${address}:`, error);
      return null;
    }
  }

  /**
   * Check if the configured MetaForwarder is trusted by UrbanCore on current deployment
   */
  public async isTrustedForwarderConfigured(): Promise<boolean> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      const forwarder = environment.contracts.MetaForwarder;
      if (!forwarder) return false;
      const res = await this.urbanCoreContract['isTrustedForwarder'](forwarder);
      return Boolean(res);
    } catch (e) {
      console.error('Error checking trusted forwarder:', e);
      return false;
    }
  }

  /**
   * Verify TX_PAYER readiness: has role and adequate ETH balance.
   */
  public async getTxPayerStatus(minBalanceEth: string = '0.02'): Promise<{ address: string | null; hasRole: boolean; balanceEth: string; sufficient: boolean; }> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      const provider = this.web3Service.getProvider();
      if (!provider) throw new Error('No provider');

      const txPayerAddress = environment.rolesMapping?.TX_PAYER_ROLE || null;
      if (!txPayerAddress) {
        return { address: null, hasRole: false, balanceEth: '0', sufficient: false };
      }

      const roleBytes = this.getRoleConstant(UserRole.TX_PAYER_ROLE);
      let hasRole = false;
      if (roleBytes) {
        try {
          hasRole = await this.urbanCoreContract['hasRole'](roleBytes, txPayerAddress);
        } catch (e) {
          console.warn('hasRole check failed:', e);
        }
      }

      let balanceEth = '0';
      try {
        const bal = await provider.getBalance(txPayerAddress);
        balanceEth = ethers.formatEther(bal);
      } catch (e) {
        console.warn('Balance check failed:', e);
      }

      const sufficient = Number(balanceEth) >= Number(minBalanceEth);
      return { address: txPayerAddress, hasRole, balanceEth, sufficient };
    } catch (e) {
      console.error('Error getting TX_PAYER status:', e);
      return { address: null, hasRole: false, balanceEth: '0', sufficient: false };
    }
  }

  // Methods for validator module
  public async getPendingGrievances(limit?: number): Promise<any[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Get total grievances from contract
      const totalGrievances = await this.grievanceHubContract['getTotalGrievances']();
      const maxToCheck = Math.min(Number(totalGrievances), 100); // Limit to prevent excessive processing
      const pendingGrievances = [];
      
      // Process in batches to minimize network requests
      const batchSize = 20;
      
      let scanned = 0;
      let statusMatched = 0;
      let validatorMatched = 0;
      // Helper to safely read struct fields
      const safeIndex = (s: any, idx: number) => {
        try {
          if (!s) return undefined;
          const len = typeof s.length === 'number' ? Number(s.length) : -1;
          if (len >= 0 && idx < len) return s[idx];
          return undefined;
        } catch {
          return undefined;
        }
      };

      for (let i = 1; i <= maxToCheck; i += batchSize) {
        const promises = [];
        for (let j = i; j < i + batchSize && j <= maxToCheck; j++) {
          promises.push(
            this.grievanceHubContract['getGrievance'](j)
              .then(grievance => ({ id: j, data: grievance }))
              .catch(() => null)
          );
        }
        
        const grievanceBatch = await Promise.all(promises);
        
        for (const grievance of grievanceBatch) {
          // Coerce status to number to handle BigInt from ethers v6
          if (grievance && grievance.data && Number(grievance.data.status) === 0) {
            const g = grievance.data;
            // Get citizen metadata if available
            let citizenName = '';
            try {
              const metadata = await this.getAddressMetadata(g.citizen);
              if (metadata && metadata.name) {
                citizenName = metadata.name;
              }
            } catch (error) {
              console.warn(`Could not get metadata for citizen ${g.citizen}`, error);
            }

            // Resolve title/body from IPFS
            let titleCid = g.titleHash ? String(g.titleHash) : '';
            let bodyCid = g.bodyHash ? String(g.bodyHash) : '';
            // If hashes are bytes32 digests, convert to CIDv0 for fetching
            try {
              if (titleCid && /^0x[0-9a-fA-F]{64}$/.test(titleCid)) {
                titleCid = `ipfs://${this.bytes32ToCid(titleCid)}`;
              }
            } catch {}
            try {
              if (bodyCid && /^0x[0-9a-fA-F]{64}$/.test(bodyCid)) {
                bodyCid = `ipfs://${this.bytes32ToCid(bodyCid)}`;
              }
            } catch {}
            let titleText = '';
            let descriptionText = '';
            let inferredType = '';
            let inferredLocation = '';

            try {
              if (titleCid) {
                const raw = await this.getIPFSContent(titleCid);
                try {
                  const j = JSON.parse(raw);
                  titleText = j?.title || j?.text || raw;
                } catch {
                  titleText = raw || titleCid;
                }
              }
            } catch { titleText = titleCid; }

            try {
              if (bodyCid) {
                const raw = await this.getIPFSContent(bodyCid);
                try {
                  const j = JSON.parse(raw);
                  descriptionText = j?.description || j?.text || raw;
                  inferredType = j?.type || j?.category || '';
                  inferredLocation = j?.location || j?.address || '';
                } catch {
                  descriptionText = raw || bodyCid;
                }
              }
            } catch { descriptionText = bodyCid; }

            // Prefer createdAt, fallback to timestamp if present
            const createdAtSec = Number((g as any).createdAt ?? (g as any).timestamp ?? 0);
            pendingGrievances.push({
              id: grievance.id.toString(),
              title: titleText || titleCid,
              description: descriptionText || bodyCid,
              location: inferredLocation,
              type: inferredType,
              timestamp: createdAtSec,
              citizenAddress: g.citizen,
              citizenName,
              urgent: false,
              imageUrls: []
            });
            
            if (limit && pendingGrievances.length >= limit) {
              break;
            }
          }
        }
        
        if (limit && pendingGrievances.length >= limit) {
          break;
        }
      }
      
      return pendingGrievances;
    } catch (error) {
      console.error('Error getting pending grievances:', error);
      return [];
    }
  }
  
  public async getGrievanceById(grievanceId: string): Promise<any> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      const grievance = await this.grievanceHubContract['getGrievance'](grievanceId);
      
      // Get citizen metadata if available
      let citizenName = '';
      try {
        const metadata = await this.getAddressMetadata(grievance.citizen);
        if (metadata && metadata.name) {
          citizenName = metadata.name;
        }
      } catch (error) {
        console.warn(`Could not get metadata for citizen ${grievance.citizen}`, error);
      }
      
      // Map according to current ABI shape (see GrievanceHub.getGrievance)
      // Return numeric Unix seconds so components can convert to Date correctly
      const createdAtSec = Number(grievance.createdAt ?? grievance.timestamp ?? 0);

      // Resolve IPFS content for title/body if possible
      const titleCid = grievance.titleHash ? String(grievance.titleHash) : '';
      const bodyCid = grievance.bodyHash ? String(grievance.bodyHash) : '';

      let titleText = '';
      let descriptionText = '';
      let inferredType = '';
      let inferredLocation = '';

      try {
        if (titleCid) {
          let ref = titleCid;
          // Convert bytes32 digest to CID if needed
          try {
            if (/^0x[0-9a-fA-F]{64}$/.test(ref)) {
              ref = `ipfs://${this.bytes32ToCid(ref)}`;
            }
          } catch {}
          const titleRaw = await this.getIPFSContent(ref);
          try {
            const titleJson = JSON.parse(titleRaw);
            titleText = titleJson?.title || titleJson?.text || titleRaw;
          } catch {
            titleText = titleRaw || titleCid;
          }
        }
      } catch (e) {
        console.warn('Failed to resolve title from IPFS', e);
        titleText = titleCid;
      }

      try {
        if (bodyCid) {
          let ref = bodyCid;
          // Convert bytes32 digest to CID if needed
          try {
            if (/^0x[0-9a-fA-F]{64}$/.test(ref)) {
              ref = `ipfs://${this.bytes32ToCid(ref)}`;
            }
          } catch {}
          const bodyRaw = await this.getIPFSContent(ref);
          try {
            const bodyJson = JSON.parse(bodyRaw);
            descriptionText = bodyJson?.description || bodyJson?.text || bodyRaw;
            inferredType = bodyJson?.type || bodyJson?.category || '';
            inferredLocation = bodyJson?.location || bodyJson?.address || '';
          } catch {
            descriptionText = bodyRaw || bodyCid;
          }
        }
      } catch (e) {
        console.warn('Failed to resolve body from IPFS', e);
        descriptionText = bodyCid;
      }

      // Normalize status to a lowercase string for UI safety
      const statusCode = Number(grievance.status);
      let statusStr: string;
      switch (statusCode) {
        case 0: statusStr = 'pending'; break;
        case 1: statusStr = 'validated'; break;
        case 2: statusStr = 'rejected'; break;
        case 3: statusStr = 'accepted'; break;
        case 4: statusStr = 'in_project'; break;
        case 5: statusStr = 'resolved'; break;
        case 6: statusStr = 'reopened'; break;
        default: statusStr = 'unknown';
      }

      return {
        id: grievanceId,
        // Keep original CIDs for reference
        title: titleCid,
        description: bodyCid,
        // Back-compat aliases expected by components
        titleHash: titleCid,
        descriptionHash: bodyCid,
        // Resolved content for UI
        titleText,
        descriptionText,
        location: inferredLocation,
        grievanceType: inferredType,
        // Timestamps (seconds)
        timestamp: createdAtSec,
        createdAt: createdAtSec,
        lastUpdated: createdAtSec,
        // Addresses
        citizenAddress: grievance.citizen,
        citizen: grievance.citizen,
        citizenName,
        validatorAddress: grievance.validator,
        // Status in multiple convenient forms
        status: statusStr.toUpperCase(),
        statusLower: statusStr,
        statusCode,
        // Optional fields (best-effort from contract struct)
        area: Number(grievance.areaId ?? grievance.area ?? 0) || undefined,
        severityLevel: Number(grievance.severityLevel ?? grievance.priority ?? 0) || 0,
        urgent: false,
        images: [],
        comments: [],
        resolutionDetails: '',
        resolvedAt: null,
        assignedTo: grievance.headReviewer && grievance.headReviewer !== ethers.ZeroAddress
          ? grievance.headReviewer
          : grievance.validator || ethers.ZeroAddress,
        resolvedBy: null
      };
    } catch (error) {
      console.error(`Error getting grievance with ID ${grievanceId}:`, error);
      return null;
    }
  }
  
  public async processGrievance(
    grievanceId: string,
    isApproved: boolean,
    comments: string
  ): Promise<boolean> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Ensure grievanceId is properly converted to BigNumber
      // This handles different input formats (string, number) and ensures proper BigNumberish representation
      const grievanceIdBN = ethers.toBigInt(grievanceId);
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction: GrievanceHub.approveGrievance(uint256 grievanceId, bool approve)
        const hash = await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'approveGrievance',
          [grievanceIdBN, isApproved]
        );
        return !!hash;
      } else {
        // Direct transaction: call approveGrievance with boolean flag
        const tx = await this.grievanceHubContract['approveGrievance'](grievanceIdBN, isApproved);
        await tx.wait();
        return true;
      }
    } catch (error) {
      console.error(`Error processing grievance ${grievanceId}:`, error);
      return false;
    }
  }
  
  public async getValidatorGrievanceStats(validatorAddress: string): Promise<any> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Get total grievances
      const totalGrievances = await this.grievanceHubContract['getTotalGrievances']();
      let pendingCount = 0;
      let validatedCount = 0;
      let rejectedCount = 0;
      
      // Iterate through each grievance to check if this validator processed it
      // Using batch processing to limit API calls
      const batchSize = 20;
      const maxGrievances = Math.min(Number(totalGrievances), 100); // Limit to prevent excessive processing
      
      for (let i = 1; i <= maxGrievances; i += batchSize) {
        const promises = [];
        for (let j = i; j < i + batchSize && j <= maxGrievances; j++) {
          promises.push(this.grievanceHubContract['getGrievance'](j).catch(() => null));
        }
        
        const grievanceBatch = await Promise.all(promises);
        
        for (const grievance of grievanceBatch) {
          if (grievance && grievance.validator) {
            // Convert addresses to lowercase for comparison to handle checksum addresses
            const grievanceValidator = grievance.validator.toLowerCase();
            const currentValidator = validatorAddress.toLowerCase();
            
            if (grievanceValidator === currentValidator) {
              // Status is an enum: 0=Pending, 1=Validated, 2=Rejected, etc.
              if (grievance.status === 0) {
                pendingCount++;
              } else if (grievance.status === 1) {
                validatedCount++;
              } else if (grievance.status === 2) {
                rejectedCount++;
              }
            } else if (grievance.validator === ethers.ZeroAddress && grievance.status === 0) {
              // Count all pending grievances that aren't assigned to any validator
              pendingCount++;
            }
          }
        }
      }
      
      return {
        pending: pendingCount,
        validated: validatedCount,
        rejected: rejectedCount,
        totalProcessed: validatedCount + rejectedCount
      };
    } catch (error) {
      console.error(`Error getting validator stats for ${validatorAddress}:`, error);
      return {
        pending: 0,
        validated: 0,
        rejected: 0,
        totalProcessed: 0
      };
    }
  }
  
  public async getProcessedGrievancesByValidator(validatorAddress: string): Promise<any[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Get total grievances from contract
      const totalGrievances = await this.grievanceHubContract['getTotalGrievances']();
      const maxToCheck = Math.min(Number(totalGrievances), 100); // Limit to prevent excessive processing
      const processedGrievances = [];
      
      // Process in batches to minimize network requests
      const batchSize = 20;
      // Diagnostics
      let scanned = 0;
      let statusMatched = 0;
      let validatorMatched = 0;
      // Helper to safely read struct fields by index
      const safeIndex = (s: any, idx: number) => {
        try {
          if (!s) return undefined;
          const len = typeof s.length === 'number' ? Number(s.length) : -1;
          if (len >= 0 && idx < len) return s[idx];
          return undefined;
        } catch {
          return undefined;
        }
      };
      
      for (let i = 1; i <= maxToCheck; i += batchSize) {
        const promises = [];
        for (let j = i; j < i + batchSize && j <= maxToCheck; j++) {
          promises.push(
            this.grievanceHubContract['getGrievance'](j)
              .then(grievance => ({ id: j, data: grievance }))
              .catch(() => null)
          );
        }
        
        const grievanceBatch = await Promise.all(promises);
        
        for (const entry of grievanceBatch) {
          scanned += 1;
          // Check if grievance exists, has been processed by this validator (status 1=Validated or 2=Rejected)
          // and the validator address matches
          if (!entry) continue;
          const g: any = entry.data;
          const statusCode = Number((g && (g.status ?? safeIndex(g, 6))) ?? -1);
          const hasProcessedStatus = statusCode === 1 || statusCode === 2;
          if (hasProcessedStatus) statusMatched += 1;
          const validatorAddr = String((g && (g.validator ?? g.reviewer ?? safeIndex(g, 7))) || '');
          const validatorMatches = validatorAddr.toLowerCase() === String(validatorAddress).toLowerCase();
          if (hasProcessedStatus && !validatorMatches) {
            try { console.debug('[ContractService] processed skip: validator mismatch', { id: entry.id, validator: validatorAddr, expected: validatorAddress }); } catch {}
          }
          if (hasProcessedStatus && validatorMatches) {
            validatorMatched += 1;

            // Get citizen metadata if available
            let citizenName = '';
            try {
              const citizen = String((g && (g.citizen ?? safeIndex(g, 1))) || '');
              const metadata = await this.getAddressMetadata(citizen);
              if (metadata && metadata.name) {
                citizenName = metadata.name;
              }
            } catch (error) {
              console.warn('Could not get metadata for citizen (processed list)', error);
            }

            // Return shape aligned with ProcessedGrievancesComponent expectations
            try {
              const full = await this.getGrievanceById(String(entry.id));
              processedGrievances.push({
                id: String(entry.id ?? ''),
                title: String((full as any).title || ''),
                location: String((full as any).location || ''),
                type: String((full as any).type || this.resolveGrievanceType(Number((g && (g.grievanceType ?? safeIndex(g, 12))) || 0))),
                citizenAddress: String((full as any).citizen || (g && (g.citizen ?? safeIndex(g, 1))) || ''),
                citizenName,
                // seconds since epoch
                timestamp: Number(((full as any).timestamp ?? (full as any).createdAt ?? (g && (g.timestamp ?? g.createdAt ?? safeIndex(g, 5))) ?? 0)),
                processedTimestamp: Number(((full as any).resolutionTimestamp ?? (full as any).lastUpdated ?? (g && (g.resolutionTimestamp ?? g.lastUpdated ?? g.timestamp ?? safeIndex(g, 13))) ?? 0)),
                status: statusCode === 1 ? 'VALIDATED' : 'REJECTED',
                validatorComments: String((g && (g.comments ?? safeIndex(g, 14))) || ''),
                validatorAddress: validatorAddr
              });
            } catch (enrichErr) {
              // Fallback to minimal struct if enrich fails
              processedGrievances.push({
                id: String(entry.id ?? ''),
                title: String((g && (g.title || g.titleHash || safeIndex(g, 3))) || ''),
                location: String((g && (g.location || safeIndex(g, 11))) || ''),
                type: this.resolveGrievanceType(Number((g && (g.grievanceType ?? safeIndex(g, 12))) || 0)),
                citizenAddress: String((g && (g.citizen ?? safeIndex(g, 1))) || ''),
                citizenName,
                // seconds since epoch
                timestamp: Number((g && (g.timestamp ?? g.createdAt ?? safeIndex(g, 5))) || 0),
                processedTimestamp: Number((g && (g.resolutionTimestamp ?? g.lastUpdated ?? g.timestamp ?? safeIndex(g, 13))) || 0),
                status: statusCode === 1 ? 'VALIDATED' : 'REJECTED',
                validatorComments: String((g && (g.comments ?? safeIndex(g, 14))) || ''),
                validatorAddress: validatorAddr
              });
            }
          }
        }
      }
      
      try { console.debug('[ContractService] getProcessedGrievancesByValidator summary', { validatorAddress, scanned, statusMatched, validatorMatched, returned: processedGrievances.length }); } catch {}
      // Sort by timestamp (most recent first) - timestamps are seconds since epoch
      processedGrievances.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
      
      return processedGrievances;
    } catch (error) {
      console.error(`Error getting processed grievances for validator ${validatorAddress}:`, error);
      return [];
    }
  }
  
  // Helper method to resolve grievance status
  private resolveGrievanceStatus(status: number): string {
    const statusMap: {[key: number]: string} = {
      0: 'pending',
      1: 'validated',
      2: 'rejected',
      3: 'accepted',
      4: 'in_project',
      5: 'resolved',
      6: 'reopened'
    };
    return statusMap[status] || 'unknown';
  }

  // Helper method to resolve grievance type
  private resolveGrievanceType(typeId: number): string {
    const types = [
      'Other',
      'Infrastructure',
      'Sanitation',
      'Water Supply',
      'Electricity',
      'Public Safety',
      'Noise Pollution',
      'Road Maintenance',
      'Waste Management'
    ];
    return types[typeId] || 'Other';
  }

  // Helper method to parse document URLs
  private parseDocumentUrls(documents: string): string[] {
    try {
      if (!documents) return [];
      // Document string may be a JSON array or a comma-separated list
      if (documents.startsWith('[')) {
        return JSON.parse(documents);
      } else {
        return documents.split(',').map(url => url.trim()).filter(url => url.length > 0);
      }
    } catch (error) {
      console.error('Error parsing document URLs:', error);
      return [];
    }
  }
  
  // Add comment to a grievance
  public async addGrievanceComment(grievanceId: string, comment: string): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Upload the comment to IPFS and convert CID to bytes32 digest expected by contract
      const ipfsUri = await this.uploadToIpfs({ kind: 'grievance_comment', text: comment, createdAt: Date.now() });
      const feedbackDigest = this.cidToBytes32(ipfsUri);

      // Ensure grievanceId is BigInt for contract call
      const grievanceIdBN = ethers.toBigInt(grievanceId);

      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction with correct method name per ABI
        return await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'submitFeedback',
          [grievanceIdBN, feedbackDigest, false]
        );
      } else {
        // Direct transaction
        const tx = await this.grievanceHubContract['submitFeedback'](grievanceIdBN, feedbackDigest, false);
        const receipt = await tx.wait();
        return receipt.hash;
      }
    } catch (error) {
      console.error('Error adding comment to grievance:', error);
      return null;
    }
  }
  
  // This is intentionally left empty as we've moved the implementation to the primary location

  // Project Manager module methods
  public async getProject(projectId: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      const p = await this.projectRegistryContract['getProject'](projectId);
      // Map to ABI-correct shape; keep wei values for callers to format
      return {
        id: Number(p.id ?? projectId),
        areaId: Number(p.areaId),
        titleHash: String(p.titleHash),
        descriptionHash: String(p.descriptionHash),
        manager: String(p.manager),
        fundingGoal: p.fundingGoal,
        escrowed: p.escrowed,
        released: p.released,
        status: Number(p.status),
        milestoneCount: Number(p.milestoneCount),
        currentMilestone: Number(p.currentMilestone),
        citizenUpvotes: Number(p.citizenUpvotes),
        createdAt: Number(p.createdAt)
      };
    } catch (error) {
      console.error(`Error getting project ${projectId}:`, error);
      return null;
    }
  }

  // Helper function to convert project status numbers to text
  private getProjectStatusText(status: number): string {
    switch (status) {
      case 0: return 'Proposed';
      case 1: return 'Approved';
      case 2: return 'In Progress';
      case 3: return 'Completed';
      case 4: return 'Cancelled';
      default: return 'Unknown';
    }
  }

  public async getIPFSContent(ipfsRef: string): Promise<string> {
    try {
      if (!ipfsRef) return '';
      const gateways = this.getConfiguredIpfsGateways();
      const cidOrPath = this.extractCidOrPath(ipfsRef);
      if (!cidOrPath) return '';

      const overallBudgetMs = 5000;
      const deadline = Date.now() + overallBudgetMs;

      for (const gw of gateways) {
        const url = `${gw.baseUrl.replace(/\/$/, '')}/${cidOrPath}`;
        try {
          if (Date.now() > deadline) break;
          const res = await this.fetchWithTimeout(url, { headers: gw.headers }, 3000);
          if (!res.ok) continue;
          return await res.text();
        } catch {
          // try next gateway
        }
      }
      return '';
    } catch (error) {
      console.error('Error getting IPFS content:', error);
      return '';
    }
  }

  /**
   * Build configured IPFS gateway list. Supports optional environment.ipfs config.
   */
  private getConfiguredIpfsGateways(): Array<{ baseUrl: string; headers?: HeadersInit }> {
    const cfg: any = (environment as any).ipfs || {};
    // Compute an auth header if configured
    const authHeader: HeadersInit | undefined = cfg.authJWT
      ? { Authorization: `Bearer ${cfg.authJWT}` }
      : (cfg.basicAuth
          ? { Authorization: `Basic ${cfg.basicAuth}` }
          : undefined);

    // Gateways list
    const gateways: string[] = cfg.gateways && Array.isArray(cfg.gateways) && cfg.gateways.length
      ? cfg.gateways
      : [
          // Keep a lean default list to avoid long retries; env can override
          'https://ipfs.io/ipfs',
          'https://dweb.link/ipfs',
          'https://gateway.pinata.cloud/ipfs'
        ];

    // Optional allowlist for which gateways should receive Authorization headers when fetching
    // Backward compatible: if not provided, do NOT attach auth headers to avoid CORS issues on public gateways
    const authFetchHosts: string[] = Array.isArray(cfg.authFetchHosts) ? cfg.authFetchHosts : (
      Array.isArray(cfg.authFetchGateways) ? cfg.authFetchGateways : []
    );

    const shouldAttachAuth = (baseUrl: string): boolean => {
      if (!authHeader || !authFetchHosts.length) return false;
      try {
        const host = new URL(baseUrl).host.toLowerCase();
        return authFetchHosts.some((h: string) => host.includes(String(h).toLowerCase()));
      } catch {
        // Fallback to substring check if URL parsing fails
        const lower = baseUrl.toLowerCase();
        return authFetchHosts.some((h: string) => lower.includes(String(h).toLowerCase()));
      }
    };

    return gateways.map((baseUrl: string) => ({
      baseUrl,
      headers: shouldAttachAuth(baseUrl) ? authHeader : undefined
    }));
  }

  /**
   * Fetch with timeout helper to avoid long hangs on failing gateways
   */
  private async fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs: number = 10000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...(init || {}), signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  // Direct call helper: get current head for an area via UrbanCore view
  public async getAreaHead(areaId: string | number): Promise<string> {
    if (!this.urbanCoreContract) await this.initContracts();
    if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
    const idNum = typeof areaId === 'string' ? Number(areaId) : areaId;
    return await this.urbanCoreContract['getAreaHead'](idNum);
  }

  /**
   * Accepts ipfs://<cid[/path]>, bare CID, or a 0x-hex that decodes to an ipfs URI.
   */
  private extractCidOrPath(input: string): string | null {
    try {
      if (!input) return null;
      // ipfs://CID[/path]
      if (input.startsWith('ipfs://')) {
        return input.replace('ipfs://', '').replace(/^\/*/, '');
      }
      // If it's a 0x-hex that decodes to a string starting with ipfs://
      if (/^0x[0-9a-fA-F]+$/.test(input)) {
        try {
          const decoded = ethers.toUtf8String(input as any);
          if (decoded && decoded.startsWith('ipfs://')) {
            return decoded.replace('ipfs://', '').replace(/^\/*/, '');
          }
        } catch {
          // not a utf8 string
        }
      }
      // Bare CID (CIDv0 starts with Qm, CIDv1 often with bafy...)
      if (/^(Qm|bafy)[a-zA-Z0-9]+/.test(input)) {
        return input;
      }
      return null;
    } catch {
      return null;
    }
  }

  public fromWei(wei: ethers.BigNumberish): string {
    try {
      return ethers.formatEther(wei);
    } catch (error) {
      console.error('Error converting wei to ether:', error);
      return '0';
    }
  }

  /**
   * Convert IPFS CID (CIDv0 "Qm..." preferred) to bytes32 digest (sha2-256) for on-chain storage.
   */
  public cidToBytes32(cid: string): string {
    if (!cid) throw new Error('Empty CID');
    // Accept ipfs://...
    if (cid.startsWith('ipfs://')) cid = cid.replace('ipfs://', '');
    // Currently support CIDv0 (base58btc, multihash sha2-256 32 bytes)
    if (!/^Qm[1-9A-HJ-NP-Za-km-z]+$/.test(cid)) {
      throw new Error('Only CIDv0 is supported for conversion. Configure uploader to use cidVersion=0.');
    }
    const bytes = this.base58btcDecode(cid);
    if (bytes.length !== 34 || bytes[0] !== 0x12 || bytes[1] !== 0x20) {
      throw new Error('Unsupported multihash format; expected sha2-256 digest');
    }
    const digest = bytes.slice(2);
    return '0x' + Array.from(digest).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert bytes32 sha2-256 digest to CIDv0 string (Qm...).
   */
  public bytes32ToCid(digestHex: string): string {
    if (!/^0x[0-9a-fA-F]{64}$/.test(digestHex)) throw new Error('Invalid bytes32 digest');
    const hex = digestHex.replace(/^0x/, '');
    const digest = new Uint8Array(hex.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
    const mh = new Uint8Array(2 + digest.length);
    mh[0] = 0x12; // sha2-256 code
    mh[1] = 0x20; // 32 bytes
    mh.set(digest, 2);
    return this.base58btcEncode(mh);
  }

  // Base58 BTC alphabet
  private readonly b58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  private base58btcEncode(buffer: Uint8Array): string {
    if (buffer.length === 0) return '';
    let digits = [0];
    for (let i = 0; i < buffer.length; i++) {
      let carry = buffer[i];
      for (let j = 0; j < digits.length; j++) {
        const x = (digits[j] << 8) + carry;
        digits[j] = x % 58;
        carry = Math.floor(x / 58);
      }
      while (carry) {
        digits.push(carry % 58);
        carry = Math.floor(carry / 58);
      }
    }
    // deal with leading zeros
    for (let k = 0; k < buffer.length && buffer[k] === 0; k++) {
      digits.push(0);
    }
    return digits.reverse().map(d => this.b58Alphabet[d]).join('');
  }

  private base58btcDecode(str: string): Uint8Array {
    if (str.length === 0) return new Uint8Array(0);
    const map: Record<string, number> = {};
    for (let i = 0; i < this.b58Alphabet.length; i++) map[this.b58Alphabet[i]] = i;
    let bytes = [0];
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const val = map[c];
      if (val === undefined) throw new Error('Invalid base58 character');
      let carry = val;
      for (let j = 0; j < bytes.length; j++) {
        const x = bytes[j] * 58 + carry;
        bytes[j] = x & 0xff;
        carry = x >> 8;
      }
      while (carry) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }
    // deal with leading ones
    for (let k = 0; k < str.length && str[k] === '1'; k++) {
      bytes.push(0);
    }
    return new Uint8Array(bytes.reverse());
  }

  // Methods for tax collector module
  public async getAllCitizens(): Promise<any[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Get all citizens from the Urban Core contract
      const citizenAddresses = await this.getRoleHolders(UserRole.CITIZEN_ROLE);
      const citizens = [];
      
      for (const address of citizenAddresses) {
        // Get citizen metadata if available
        const metadata = await this.getAddressMetadata(address);
        
        citizens.push({
          address,
          name: metadata?.name || 'Unknown',
          areaId: metadata?.areaId || '0',
          registrationDate: metadata?.timestamp || Date.now() / 1000
        });
      }
      
      return citizens;
    } catch (error) {
      console.error('Error getting all citizens:', error);
      return [];
    }
  }

  public async getTaxCollectionStats(): Promise<any> {
    try {
      if(!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      const totalAssessmentsBn = await this.taxModuleContract['getTotalTaxAssessmentCount']();
      const paidAssessmentsBn = await this.taxModuleContract['getPaidTaxAssessmentCount']();
      const totalAssessments = Number(totalAssessmentsBn);
      const completedPayments = Number(paidAssessmentsBn);
      const pendingPayments = Math.max(0, totalAssessments - completedPayments);
      const totalCollected = await this.getTotalTaxCollected();
      const collectionRate = totalAssessments > 0 ? Math.round((completedPayments / totalAssessments) * 100) : 0;
      
      return { totalAssessments, pendingPayments, completedPayments, collectionRate, totalCollected };
    } catch (error) {
      console.error('Error getting tax collection stats:', error);
      return { totalAssessments: 0, pendingPayments: 0, completedPayments: 0, collectionRate: 0, totalCollected: '0' };
    }
  }

 // Implementation of missing methods for citizen module
 public async getUserGrievances(userAddress: string | null): Promise<any[]> {
  try {
    if (!userAddress) return [];
    if (!this.grievanceHubContract) await this.initContracts();
    if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
    
    // Get all grievance IDs for the citizen
    const grievanceIds: bigint[] = await this.grievanceHubContract!['getCitizenGrievances'](userAddress);
    
    // Fetch grievances for each ID
    const grievances = await Promise.all(
      grievanceIds.map(async (idBigInt: bigint) => {
        const id = idBigInt.toString();
        const g = await this.getGrievanceById(id);
        if (!g) return null;
        return {
          id: id,
          title: g.titleText || g.titleHash || 'Untitled Grievance',
          description: g.descriptionText || g.descriptionHash || 'No description',
          titleHash: g.titleHash || '',
          descriptionHash: g.descriptionHash || '',
          status: g.statusCode, // numeric enum per canonical mapping
          timestamp: Number(g.createdAt),
          lastUpdated: Number(g.lastUpdated),
          assignedTo: g.assignedTo,
          resolvedBy: g.resolvedBy || null,
          resolvedAt: g.resolvedAt ? Number(g.resolvedAt) : null,
          images: g.images || []
        };
      })
    );
    
    return grievances.filter(Boolean);
  } catch (error: any) {
    console.error(`Error getting user grievances for ${userAddress}:`, error);
    return [];
  }
}
  public async submitGrievance(grievanceData: {
    areaId: number | string;
    titleIpfsHash: string; // ipfs://CIDv0 or Qm...
    bodyIpfsHash: string;  // ipfs://CIDv0 or Qm...
  }): Promise<boolean> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Normalize inputs
      const areaIdNum = typeof grievanceData.areaId === 'string'
        ? parseInt(grievanceData.areaId, 10)
        : grievanceData.areaId;
      if (!Number.isFinite(areaIdNum) || areaIdNum <= 0) {
        throw new Error('Invalid areaId for grievance');
      }
      
      // Convert IPFS CIDs to bytes32 digests expected by contract
      const titleDigest = this.cidToBytes32(grievanceData.titleIpfsHash);
      const bodyDigest = this.cidToBytes32(grievanceData.bodyIpfsHash);
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        const hash = await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'fileGrievance',
          [areaIdNum, titleDigest, bodyDigest]
        );
        return !!hash;
      } else {
        const tx = await this.grievanceHubContract['fileGrievance'](areaIdNum, titleDigest, bodyDigest);
        await tx.wait();
        return true;
      }
    } catch (error: any) {
      console.error('Error submitting grievance:', error);
      return false;
    }
  }
  
  public async getLocalProjects(userAddress: string | null): Promise<any[]> {
    try {
      if (!userAddress) return [];
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Mock implementation - to be replaced with actual contract call
      return [
        {
          id: '1',
          title: 'Community Park Renovation',
          description: 'Renovation of local park with new equipment',
          budget: ethers.parseEther('10'),
          currentFunding: ethers.parseEther('6.5'),
          status: 'active',
          location: 'Main Street Park',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
          creator: '0x1234567890123456789012345678901234567890',
          upvotes: 24,
          hasUserUpvoted: false
        },
        {
          id: '2',
          title: 'Street Lighting Upgrade',
          description: 'Replacing old lights with energy-efficient LED lights',
          budget: ethers.parseEther('5'),
          currentFunding: ethers.parseEther('5'),
          status: 'funded',
          location: 'Oak Avenue',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 15, // 15 days ago
          creator: '0x2345678901234567890123456789012345678901',
          upvotes: 42,
          hasUserUpvoted: true
        }
      ];
    } catch (error: any) {
      console.error(`Error getting local projects for ${userAddress}:`, error);
      return [];
    }
  }
  
  public async upvoteProject(projectId: number): Promise<boolean> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        const hash = await this.sendMetaTransaction(
          environment.contracts.ProjectRegistry,
          'upvoteProject',
          [projectId]
        );
        return !!hash;
      } else {
        // Direct transaction
        const tx = await this.projectRegistryContract['upvoteProject'](projectId);
        await tx.wait();
        return true;
      }
    } catch (error: any) {
      console.error(`Error upvoting project ${projectId}:`, error);
      return false;
    }
  }
  
  public async getUserTaxAssessments(userAddress: string | null): Promise<any[]> {
    try {
      if (!userAddress) return [];
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // Get all tax years for the citizen
      const taxYears: bigint[] = await this.taxModuleContract!['getCitizenTaxYears'](userAddress);
      
      // Fetch assessments for each year
      const assessments = await Promise.all(
        taxYears.map(async (yearBigInt: bigint) => {
          const year = Number(yearBigInt); // Convert BigInt to number for year (safe as years are small)
          const assessment = await this.taxModuleContract!['getAssessment'](userAddress, year);
          
          // Parse the assessment struct
          const amount: bigint = assessment[0];
          const docsHash: string = assessment[1];
          const assessedBy: string = assessment[2];
          const paid: boolean = assessment[3];
          const paidAt: bigint = assessment[4];
          const objectionHash: string = assessment[5];
          const objectionFiled: boolean = assessment[6];
          const meetingTimestamp: bigint = assessment[7];
          
          // Adapt to expected format (no propertyId or dueDate in contract, use year as id, no createdAt so use paidAt or 0 if not paid)
          return {
            id: year.toString(),
            propertyId: 'N/A', // Not available in contract
            amount: amount, // Keep as BigInt for summation handling
            dueDate: 0, // Not available, set to 0
            isPaid: paid,
            year: year,
            description: docsHash, // Use docsHash as description proxy
            createdAt: paid ? Number(paidAt) : 0 // Use paidAt if paid, else 0
          };
        })
      );
      
      return assessments;
    } catch (error: any) {
      console.error(`Error getting tax assessments for ${userAddress}:`, error);
      return [];
    }
  }
  
  public async payTax(assessmentId: number, amount: string): Promise<any> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      const amountWei = ethers.parseEther(amount);
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        const hash = await this.sendMetaTransaction(
          environment.contracts.TaxModule,
          'payTax',
          [assessmentId, amountWei.toString()]
        );
        return {
          success: !!hash,
          hash: hash,
          receipt: hash ? { id: Date.now().toString(), amount: amount } : null
        };
      } else {
        // Direct transaction
        const tx = await this.taxModuleContract['payTax'](assessmentId, amountWei);
        const receipt = await tx.wait();
        return {
          success: true,
          hash: receipt.hash,
          receipt: { id: Date.now().toString(), amount: amount }
        };
      }
    } catch (error: any) {
      console.error(`Error paying tax for assessment ${assessmentId}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  public async createTaxAssessment(assessment: {
    citizenAddress: string;
    propertyId: string;
    amount: string;
    dueDate: number;
    year: number;
    description?: string;
    quarter?: number; // Changed from string to number to match component usage
    lateFee?: string;
    penaltyRate?: number;
  }): Promise<boolean> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // Convert amount from string to BigNumber (ethers)
      const amountWei = ethers.parseEther(assessment.amount);
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        const hash = await this.sendMetaTransaction(
          environment.contracts.TaxModule,
          'createTaxAssessment',
          [
            assessment.citizenAddress,
            assessment.propertyId,
            amountWei.toString(),
            assessment.dueDate.toString(),
            assessment.year.toString(),
            assessment.description || ''
          ]
        );
        return !!hash;
      } else {
        // Direct transaction
        const tx = await this.taxModuleContract['createTaxAssessment'](
          assessment.citizenAddress,
          assessment.propertyId,
          amountWei,
          assessment.dueDate,
          assessment.year,
          assessment.description || ''
        );
        await tx.wait();
        return true;
      }
    } catch (error) {
      console.error('Error creating tax assessment:', error);
      return false;
    }
  }

  public async getCitizenInfo(address: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Check if address has citizen role
      const isCitizen = await this.hasRole(UserRole.CITIZEN_ROLE, address);
      if (!isCitizen) {
        console.warn(`Address ${address} is not a registered citizen`);
        return null;
      }
      
      // Get citizen metadata
      const metadata = await this.getAddressMetadata(address);
      
      // Get area details if available
      let areaDetails: { name?: string; id?: string; adminHead?: string; citizenCount?: string; metadata?: string; } = {};
      if (metadata?.areaId) {
        areaDetails = await this.getAreaDetails(metadata.areaId);
      }
      
      return {
        address,
        name: metadata?.name || 'Unknown',
        areaId: metadata?.areaId || '0',
        areaName: areaDetails?.name || 'Unknown Area',
        registrationDate: metadata?.timestamp || Date.now() / 1000
      };
    } catch (error) {
      console.error(`Error getting citizen info for ${address}:`, error);
      return null;
    }
  }

  public async getTaxPaymentHistory(address: string): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // Get all payments for this citizen
      const paymentCount = await this.taxModuleContract['getPaymentCountForCitizen'](address);
      const payments = [];
      
      for (let i = 0; i < paymentCount; i++) {
        const paymentId = await this.taxModuleContract['getCitizenPaymentIdAtIndex'](address, i);
        const payment = await this.taxModuleContract['getPayment'](paymentId);
        
        payments.push({
          id: paymentId.toString(),
          amount: ethers.formatEther(payment.amount),
          timestamp: new Date(Number(payment.timestamp) * 1000),
          assessmentId: payment.assessmentId.toString(),
          citizen: payment.citizen,
          receiptId: payment.receiptId.toString()
        });
      }
      
      return payments;
    } catch (error) {
      console.error(`Error getting tax payment history for ${address}:`, error);
      return [];
    }
  }

  public async getPendingTaxAssessments(
    limitOrYear?: number,
    citizenAddress?: string
  ): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');

      // If citizenAddress is provided, get assessments for that citizen only.
      // In this branch, limitOrYear is interpreted as a year filter if provided.
      if (citizenAddress) {
        const assessmentCount = await this.taxModuleContract['getTaxAssessmentCountForCitizen'](citizenAddress);
        const assessments = [] as any[];
        
        for (let i = 0; i < assessmentCount; i++) {
          const id = await this.taxModuleContract['getCitizenTaxAssessmentIdAtIndex'](citizenAddress, i);
          const assessment = await this.taxModuleContract['getTaxAssessment'](id);

          // Skip if paid or if year doesn't match (if year is specified)
          if (assessment.paid || (limitOrYear !== undefined && assessment.year !== limitOrYear)) {
            continue;
          }

          const dueSeconds = Number(assessment.dueDate);
          const month = new Date(dueSeconds * 1000).getUTCMonth();
          const quarter = Math.floor(month / 3) + 1;

          const citizenInfo = await this.getCitizenInfo(assessment.citizen);

          assessments.push({
            id: id.toString(),
            amount: ethers.formatEther(assessment.amount),
            year: assessment.year,
            dueDate: dueSeconds, // seconds
            quarter,
            citizenAddress: assessment.citizen,
            citizenName: citizenInfo?.name || 'Unknown',
            propertyId: assessment.propertyId
          });
        }
        
        return assessments;
      }

      // Otherwise (no citizen filter), treat the single numeric argument as a limit.
      const limit = typeof limitOrYear === 'number' ? limitOrYear : undefined;
      const pendingCountBn = await this.taxModuleContract['getPendingAssessmentCount'](0);
      const pendingCount = Number(pendingCountBn);
      const toFetch = limit ? Math.min(pendingCount, limit) : pendingCount;

      const assessments = [] as any[];
      for (let i = 0; i < toFetch; i++) {
        const id = await this.taxModuleContract['getPendingAssessmentAtIndex'](i, 0);
        const assessment = await this.taxModuleContract['getTaxAssessment'](id);

        const dueSeconds = Number(assessment.dueDate);
        const month = new Date(dueSeconds * 1000).getUTCMonth();
        const quarter = Math.floor(month / 3) + 1;

        const citizenInfo = await this.getCitizenInfo(assessment.citizen);

        assessments.push({
          id: id.toString(),
          amount: ethers.formatEther(assessment.amount),
          year: assessment.year,
          dueDate: dueSeconds, // seconds
          quarter,
          citizenAddress: assessment.citizen,
          citizenName: citizenInfo?.name || 'Unknown',
          propertyId: assessment.propertyId
        });
      }

      return assessments;
    } catch (error: any) {
      console.error('Error getting pending tax assessments:', error);
      return [];
    }
  }

  public async getAllTaxPayments(): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // Get total payment count
      const paymentCount = await this.taxModuleContract['getTotalPaymentCount']();
      const payments = [];
      
      for (let i = 0; i < paymentCount; i++) {
        const paymentId = await this.taxModuleContract['getPaymentIdAtIndex'](i);
        const payment = await this.taxModuleContract['getPayment'](paymentId);
        
        // Get citizen info for this payment
        const citizenInfo = await this.getCitizenInfo(payment.citizen);
        
        payments.push({
          id: paymentId.toString(),
          amount: ethers.formatEther(payment.amount),
          timestamp: new Date(Number(payment.timestamp) * 1000),
          assessmentId: payment.assessmentId.toString(),
          citizen: payment.citizen,
          citizenName: citizenInfo?.name || 'Unknown',
          receiptId: payment.receiptId.toString()
        });
      }
      
      return payments;
    } catch (error) {
      console.error('Error getting all tax payments:', error);
      return [];
    }
  }

  public async getRecentTaxPayments(limit: number = 5): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');

      // Guard
      if (limit <= 0) return [];

      const totalCountBn = await this.taxModuleContract['getTotalPaymentCount']();
      const totalCount = Number(totalCountBn);
      if (totalCount === 0) return [];

      const startIndex = Math.max(0, totalCount - limit);
      const results: any[] = [];

      for (let i = startIndex; i < totalCount; i++) {
        try {
          const paymentId = await this.taxModuleContract['getPaymentIdAtIndex'](i);
          const payment = await this.taxModuleContract['getPayment'](paymentId);

          // Fetch assessment to get year/quarter context
          const assessment = await this.taxModuleContract['getTaxAssessment'](payment.assessmentId);

          // Derive quarter from due date if available (fallback to current quarter)
          const dueTsSec = Number(assessment?.dueDate || 0);
          const dateForQuarter = dueTsSec > 0 ? new Date(dueTsSec * 1000) : new Date(Number(payment.timestamp) * 1000);
          const month = dateForQuarter.getUTCMonth(); // 0-11
          const quarter = Math.floor(month / 3) + 1; // 1-4

          // Get citizen info for display name
          const citizenInfo = await this.getCitizenInfo(payment.citizen);

          results.push({
            id: paymentId.toString(),
            citizenAddress: payment.citizen,
            citizenName: citizenInfo?.name || 'Unknown',
            amount: ethers.formatEther(payment.amount),
            paidOn: Number(payment.timestamp), // seconds
            year: Number(assessment?.year || dateForQuarter.getUTCFullYear()),
            quarter
          });
        } catch (innerErr) {
          console.warn('Error processing recent payment at index', i, innerErr);
        }
      }

      // Ensure most recent first
      return results.sort((a, b) => b.paidOn - a.paidOn).slice(0, limit);
    } catch (error: any) {
      console.error('Error getting recent tax payments:', error);
      return [];
    }
  }

  // Project management methods
  public async getManagerProjects(managerAddress: string): Promise<number[]> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      const ids: any[] = await this.projectRegistryContract['getManagerProjects'](managerAddress);
      return (ids || []).map((x: any) => Number(x));
    } catch (error) {
      console.error('Error getting manager projects:', error);
      return [];
    }
  }
  
  public async getRemainingFunds(projectId: number): Promise<string> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      // Use contract's helper for correctness
      const remainingWei = await this.projectRegistryContract['getRemainingFunds'](projectId);
      // Return as wei string/BigNumberish for callers to format
      return remainingWei;
    } catch (error) {
      console.error(`Error getting remaining funds for project ${projectId}:`, error);
      return '0';
    }
  }
  
  // Get all projects from the contract
  public async getAllProjects(): Promise<any[]> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Get total project count
      const projectCount = await this.projectRegistryContract['getTotalProjects']();
      const projects = [];
      
      // Fetch each project by ID
      for (let i = 1; i <= Number(projectCount); i++) {
        try {
          const project = await this.getProject(i);
          if (project) {
            projects.push(project);
          }
        } catch (err) {
          console.warn(`Error fetching project ${i}:`, err);
        }
      }
      
      return projects;
    } catch (error) {
      console.error('Error getting all projects:', error);
      return [];
    }
  }

  // Approve a project proposal
  public async approveProject(projectId: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Get the connected account address
      const account = this.web3Service.getAccount();
      if (!account) throw new Error('No connected account');
      
      // Call the contract's approveProject method
      const tx = await this.projectRegistryContract['approveProject'](projectId);
      await tx.wait();
      
      return { success: true, message: `Project ${projectId} has been approved` };
    } catch (error: any) {
      console.error(`Error approving project ${projectId}:`, error);
      return { success: false, message: `Failed to approve project: ${error.message || error}` };
    }
  }

  // Reject a project proposal
  public async rejectProject(projectId: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Get the connected account address
      const account = this.web3Service.getAccount();
      if (!account) throw new Error('No connected account');
      
      // Call the contract's rejectProject method
      const tx = await this.projectRegistryContract['rejectProject'](projectId);
      await tx.wait();
      
      return { success: true, message: `Project ${projectId} has been rejected` };
    } catch (error: any) {
      console.error(`Error rejecting project ${projectId}:`, error);
      return { success: false, message: `Failed to reject project: ${error.message || error}` };
    }
  }
  
  // Fund a project with specified amount
  public async fundProject(projectId: number, amount: string): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Get the connected account address
      const account = this.web3Service.getAccount();
      if (!account) throw new Error('No connected account');
      
      // Convert amount to wei (ethers format)
      const amountInWei = ethers.parseEther(amount);
      
      // Call the contract's fundProject method with the amount
      const tx = await this.projectRegistryContract['fundProject'](projectId, amountInWei);
      await tx.wait();
      
      return { 
        success: true, 
        message: `Project ${projectId} has been funded with ${amount} ETH` 
      };
    } catch (error: any) {
      console.error(`Error funding project ${projectId}:`, error);
      return { 
        success: false, 
        message: `Failed to fund project: ${error.message || error}` 
      };
    }
  }

  public async getMilestone(projectId: number, milestoneIndex: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      const m = await this.projectRegistryContract['getMilestone'](projectId, milestoneIndex);
      // Map directly from ABI struct
      return {
        projectId: Number(m.projectId),
        milestoneNumber: Number(m.milestoneNumber),
        proofHash: String(m.proofHash),
        amount: m.amount,
        completed: Boolean(m.completed),
        completedAt: Number(m.completedAt),
        submittedBy: String(m.submittedBy)
      };
    } catch (error: any) {
      console.error(`Error getting milestone for project ${projectId}:`, error);
      return null;
    }
  }

  // Add a milestone to a project
  public async addMilestone(projectId: number, title: string, description: string, targetDate: Date, fundAmount: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Get the connected account address
      const account = this.web3Service.getAccount();
      if (!account) throw new Error('No connected account');
      
      // Convert fundAmount to wei for the contract call
      const fundAmountInWei = ethers.parseEther(fundAmount.toString());
      
      // Format the date as a timestamp for the contract
      const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
      
      // Call the contract's addMilestone method
      const tx = await this.projectRegistryContract['addMilestone'](projectId, title, description, targetTimestamp, fundAmountInWei);
      await tx.wait();
      
      return {
        success: true,
        message: `Milestone "${title}" added to project ${projectId}`
      };
    } catch (error: any) {
      console.error(`Error adding milestone to project ${projectId}:`, error);
      return {
        success: false,
        message: `Failed to add milestone: ${error.message || error}`
      };
    }
  }
  
  // Mark a milestone as completed
  public async completeMilestone(projectId: number, milestoneIndex: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Get the connected account address
      const account = this.web3Service.getAccount();
      if (!account) throw new Error('No connected account');
      
      // Call the contract's completeMilestone method
      const tx = await this.projectRegistryContract['completeMilestone'](projectId, milestoneIndex);
      await tx.wait();
      
      return {
        success: true,
        message: `Milestone ${milestoneIndex} has been marked as complete for project ${projectId}`
      };
    } catch (error: any) {
      console.error(`Error completing milestone ${milestoneIndex} for project ${projectId}:`, error);
      return {
        success: false,
        message: `Failed to complete milestone: ${error.message || error}`
      };
    }
  }

  public convertToWei(amount: string): ethers.BigNumberish {
    try {
      return ethers.parseEther(amount);
    } catch (error) {
      console.error('Error converting to wei:', error);
      return ethers.parseEther('0');
    }
  }

  // Overloaded createProject method with separate parameters (for AdminHead module)
  public async createProject(
    titleIpfsHash: string,
    descriptionIpfsHash: string,
    budgetInWei: string,
    totalMilestones: number,
    managerAddress: string,
    areaId: string,
    initialFundingInWei: string
  ): Promise<boolean> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      if (!environment.contracts.ProjectRegistry) throw new Error('ProjectRegistry address not configured');
      // Ensure binding matches environment in case of redeploy
      const desired = environment.contracts.ProjectRegistry.toLowerCase();
      const current = String(((this.projectRegistryContract as any).target || (this.projectRegistryContract as any).address) || '').toLowerCase();
      if (desired && current && desired !== current) {
        this.projectRegistryContract = null;
        await this.initContracts();
        if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      }

      // Convert inputs to bytes32 and numeric
      const toDigest = (v: string): string => {
        if (!v) return ethers.ZeroHash;
        const s = String(v);
        if (s.startsWith('ipfs://')) return this.cidToBytes32(s);
        if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s;
        // Fallback: keccak of text
        return ethers.keccak256(ethers.toUtf8Bytes(s));
      };
      const titleDigest = toDigest(titleIpfsHash);
      const descDigest = toDigest(descriptionIpfsHash);
      const areaIdNum = Number(areaId);
      const fundingGoal = BigInt(budgetInWei || '0');

      // Create project
      const tx = await this.projectRegistryContract['createProject'](areaIdNum, titleDigest, descDigest, managerAddress, fundingGoal);
      const receipt = await tx.wait();

      // Optionally parse ProjectCreated for feedback/logging
      try {
        const iface = this.projectRegistryContract.interface;
        for (const log of receipt.logs || []) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed && parsed.name === 'ProjectCreated') {
              const pid = (parsed.args && (parsed.args['projectId'] ?? parsed.args[0])) as any;
              console.log('Project created with ID', Number(pid));
              break;
            }
          } catch {}
        }
      } catch {}

      return true;
    } catch (error) {
      console.error('Error creating project:', error);
      return false;
    }
  }
  
  // Original createProject method with project data object
  public async createProjectFromData(projectData: {
    title: string;
    description: string;
    location: string;
    budget: string;
    timelineInDays?: number;
    documents?: string;
    milestones?: {
      title: string;
      description: string;
      funds: string;
    }[];
  }): Promise<boolean> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        console.log('Using meta-transaction for project creation');
        // In a real implementation, this would use meta-transactions
        // For mock purposes, we'll just simulate a successful creation
        console.log('Creating project via meta-transaction:', projectData);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate blockchain delay
      } else {
        // Direct transaction (simplified mock)
        // In a real implementation, we would call the contract method directly
        console.log('Creating new project:', projectData);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate blockchain delay
      }
      
      return true;
    } catch (error) {
      console.error('Error creating project:', error);
      return false;
    }
  }
}