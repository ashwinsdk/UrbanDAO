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
            this.projectRegistryContract = new ethers.Contract(
              environment.contracts.ProjectRegistry,
              (projectRegistryABI as any).abi ?? projectRegistryABI,
              signer
            );
            console.log('ProjectRegistry contract initialized');
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
        throw error; // Re-throw so callers know initialization failed
      } finally {
        this.loadingSubject.next(false);
        this.initPromise = null;
        this.contractsInitialized = false;
        return false;
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
    // Map from enum values to hardcoded bytes32 constants (from role-verification.json)
    const roleConstants: {[key in UserRole]?: string} = {
      [UserRole.OWNER_ROLE]: '0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e', // Verified from contract
      [UserRole.ADMIN_GOVT_ROLE]: '0x0c79c71313e07ef49c5e10d46bbd278f8ec590008f378c219bb3e54b15bb0e84', // Corrected from verification
      [UserRole.ADMIN_HEAD_ROLE]: '0xb302d06c4efadeded1e387e0955d9d440d227b6b55549296dd39bd21dc8eddf9', // Corrected from verification
      [UserRole.PROJECT_MANAGER_ROLE]: '0xa88d484f5aeb539ab60f9bd084e23511bc356a4f715a255e909643bb69ddcb41', // Corrected from verification
      [UserRole.TAX_COLLECTOR_ROLE]: '0x7cb8da4815c5c7bfec597d7479bf1f02def0b6d0f50cd2ad5eb80c69ac5c1a1b', // Corrected from verification
      [UserRole.VALIDATOR_ROLE]: '0x21702c8af46127c7fa207f89d0b0a8441bb32959a0ac7df790e9ab1a25c98926', // Corrected from verification
      [UserRole.CITIZEN_ROLE]: '0x8f1426173eb922d2001706a308dabfa96e3c06475230fb5111184f70a4b5776d', // Corrected from verification
      [UserRole.TX_PAYER_ROLE]: '0x56e46fdde77b111e5bb65b63a6dac3eb9e218dc429289c985fdd859cca14412b' // Corrected from verification
    };
    
    return roleConstants[roleName] || null;
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
      
      // First try getAddressRole method
      try {
        console.log('Calling getAddressRole on UrbanCore contract');
        const roleBytes = await this.urbanCoreContract['getAddressRole'](address);
        console.log('Raw role bytes from getAddressRole:', roleBytes);
        
        const userRole = this.convertRoleToEnum(roleBytes);
        console.log(`Role converted to enum: ${userRole} (${UserRole[userRole]})`);
        
        if (userRole !== UserRole.NONE) {
          return userRole;
        }
      } catch (error) {
        console.error('Error calling getAddressRole:', error);
        // Continue to fallback checks
      }
      
      // Fallback to checking each role individually
      console.log('Falling back to individual role checks');
      
      // Check roles in priority order
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
            console.log(`Address has role: ${name}`);
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
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Mock implementation - in a real scenario would query the contract
      return "1"; // Return area ID 1 for testing as string
    } catch (error) {
      console.error('Error getting admin area ID:', error);
      return null;
    }
  }
  
  // Get pending role requests for an area
  public async getPendingRoleRequests(areaId: string): Promise<any[]> {
    try {
      const allRequests = await this.getRoleRequests(UserRole.CITIZEN_ROLE);
      // Filter to only show pending requests for this area
      return allRequests.filter(request => request.areaId === areaId && request.status === 'pending');
    } catch (error) {
      console.error('Error getting pending role requests:', error);
      return [];
    }
  }
  
  // Get role holders by area
  public async getRoleHoldersByArea(areaId: string, role: UserRole): Promise<any[]> {
    try {
      const allHolders = await this.getRoleHolders(role);
      // In a real implementation, would filter by area
      // For now return all holders
      return allHolders;
    } catch (error) {
      console.error('Error getting role holders by area:', error);
      return [];
    }
  }
  
  // Check if user has any other role
  public async hasAnyOtherRole(address: string): Promise<boolean> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Mock implementation
      // In a real scenario would check all roles for this address
      return Math.random() > 0.5; // Randomly return true or false for testing
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
      const tx = await this.urbanCoreContract['assignRole'](roleConstant, address);
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error assigning role:', error);
      return false;
    }
  }
  
  // Get projects by area
  public async getProjectsByArea(areaId: string): Promise<number[]> {
    const numericAreaId = parseInt(areaId, 10);
    return this.getProjectsInArea(numericAreaId);
  }
  
  // Helper methods for currency conversion
  public weiToEth(weiValue: string): string {
    return ethers.formatEther(weiValue);
  }
  
  public ethToWei(ethValue: string | number): string {
    return ethers.parseEther(ethValue.toString()).toString();
  }
  
  // Method to reject a grievance
  public async rejectGrievance(grievanceId: string, feedback: string): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Mock implementation
      console.log(`Rejecting grievance ${grievanceId} with feedback: ${feedback}`);
      return 'mock-transaction-hash';
    } catch (error) {
      console.error('Error rejecting grievance:', error);
      return null;
    }
  }
  
  // Get grievances for an area
  public async getGrievancesByArea(areaId: string): Promise<string[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Mock implementation - return some IDs
      return ['grievance-1', 'grievance-2', 'grievance-3', 'grievance-4', 'grievance-5'];
    } catch (error) {
      console.error('Error getting grievances by area:', error);
      return [];
    }
  }
  
  // Get grievances by status and area
  public async getGrievancesByStatusAndArea(status: string, areaId: string): Promise<string[]> {
    try {
      const allGrievances = await this.getGrievancesByArea(areaId);
      // In a real implementation, filter by status
      // For now return all grievances for any status
      return allGrievances;
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
      
      // Mock implementation
      return [
        { address: '0x1234...', name: 'Citizen 1', registrationDate: new Date() },
        { address: '0x5678...', name: 'Citizen 2', registrationDate: new Date() },
        { address: '0x9ABC...', name: 'Citizen 3', registrationDate: new Date() }
      ];
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
      return 1250; // Mock implementation
    } catch (error) {
      console.error('Error getting total citizen count:', error);
      throw new Error('Failed to get total citizen count');
    }
  }

  public async getTotalProjectsCount(): Promise<number> {
    try {
      return 42; // Mock implementation
    } catch (error) {
      console.error('Error getting total projects count:', error);
      throw new Error('Failed to get total projects count');
    }
  }

  public async getTotalGrievancesCount(): Promise<number> {
    try {
      return 326; // Mock implementation
    } catch (error) {
      console.error('Error getting total grievances count:', error);
      throw new Error('Failed to get total grievances count');
    }
  }

  public async getTotalTaxCollected(): Promise<string> {
    try {
      return '15000000000000000000'; // Mock implementation (15 ETH in wei)
    } catch (error) {
      console.error('Error getting total tax collected:', error);
      throw new Error('Failed to get total tax collected');
    }
  }

  public async getRecentSystemEvents(): Promise<any[]> {
    try {
      return [
        { id: '1', type: 'NewArea', title: 'New Area Created', description: 'Area #12 was created', timestamp: Date.now() - 3600000 },
        { id: '2', type: 'NewRole', title: 'Role Assigned', description: 'New tax collector assigned to Area #5', timestamp: Date.now() - 7200000 },
        { id: '3', type: 'TaxCollection', title: 'Tax Milestone', description: '10 ETH total tax collected', timestamp: Date.now() - 86400000 }
      ]; // Mock implementation
    } catch (error) {
      console.error('Error getting recent system events:', error);
      throw new Error('Failed to get recent system events');
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
  
  // Create a new area
  public async createArea(areaName: string): Promise<string | null> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Mock implementation
      console.log(`Creating area ${areaName}`);
      return 'mock-transaction-hash';
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
      
      // Mock implementation
      console.log(`Escalating grievance ${grievanceId} to project: ${projectName}`);
      return 'mock-transaction-hash';
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

  public async fileGrievance(title: string, description: string, documents: string): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        return await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'fileGrievance',
          [title, description, documents]
        );
      } else {
        // Direct transaction
        const tx = await this.grievanceHubContract['fileGrievance'](title, description, documents);
        const receipt = await tx.wait();
        return receipt.hash;
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
      
      const projectCount = await this.projectRegistryContract['getProjectCountInArea'](areaId);
      const projects = [];
      
      for (let i = 0; i < projectCount; i++) {
        const id = await this.projectRegistryContract['getProjectIdInAreaAtIndex'](areaId, i);
        const project = await this.projectRegistryContract['getProject'](id);
        projects.push({
          id,
          title: project.title,
          description: project.description,
          budget: ethers.formatEther(project.budget),
          status: project.status,
          manager: project.manager,
          createdAt: new Date(Number(project.createdAt) * 1000)
        });
      }
      
      return projects;
    } catch (error) {
      console.error('Error getting projects:', error);
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
      
      for (let i = 0; i < assessmentCount; i++) {
        const id = await this.taxModuleContract['getCitizenTaxAssessmentIdAtIndex'](address, i);
        const assessment = await this.taxModuleContract['getTaxAssessment'](id);
        assessments.push({
          id,
          amount: ethers.formatEther(assessment.amount),
          year: assessment.year,
          paid: assessment.paid,
          dueDate: new Date(Number(assessment.dueDate) * 1000),
          citizen: assessment.citizen,
          receiptId: assessment.receiptId
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
    // Check if TX_PAYER is available
    try {
      // Get TX_PAYER role holders from contract
      const txPayers = await this.getRoleHolders(UserRole.TX_PAYER_ROLE);
      if (!txPayers || txPayers.length === 0) return false;
      
      // Use the first TX_PAYER found
      const txPayerAddress = txPayers[0];
      if (!txPayerAddress) return false;
      
      // Check if tx payer has enough balance
      const provider = this.web3Service.getProvider();
      if (!provider) return false;
      
      const balance = await provider.getBalance(txPayerAddress);
      return balance > ethers.parseEther('0.01'); // Minimum balance required
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
      
      // Get contract ABI to properly encode function call
      const urbanCoreContract = await this.getUrbanCoreContract();
      if (!urbanCoreContract) throw new Error('UrbanCore contract not available');
      
      // For registerCitizen specifically, we know it takes a bytes32 parameter
      console.log(`Encoding function data for ${functionName} with params:`, params);
      let data;
      
      if (functionName === 'registerCitizen') {
        // Specific handling for registerCitizen
        data = urbanCoreContract.interface.encodeFunctionData('registerCitizen', params);
      } else {
        // Generic handling for other functions
        const iface = new ethers.Interface([
          `function ${functionName}(bytes32)`
        ]);
        data = iface.encodeFunctionData(functionName, params);
      }
      
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
            console.error('Error waiting for transaction confirmation:', confirmError);
            
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
        } else {
          // We don't have TX_PAYER_ROLE, so we need to use a known TX_PAYER account
          console.log('Current account does not have TX_PAYER_ROLE, using known TX_PAYER account');
          
          // Get the known TX_PAYER address from role-verification.json
          const txPayerAddress = '0xe0b1ee4660e296bae4054f67c5d46493ff455061';
          console.log('Using TX_PAYER account:', txPayerAddress);
          
          // Use a private key for the TX_PAYER account (for local development only)
          // In production, this would be handled by a secure backend service
          const txPayerPrivateKey = environment.txPayerPrivateKey;
          
          // Check if we have the private key available (development mode only)
          if (!txPayerPrivateKey) {
            console.error('TX_PAYER private key not available in environment');
            throw new Error('TX_PAYER configuration missing. Cannot execute meta-transaction.');
          }
          
          try {
            // Create a wallet instance for the TX_PAYER account
            const txPayerWallet = new ethers.Wallet(txPayerPrivateKey, this.web3Service.getProvider());
            console.log('TX_PAYER wallet created, address:', await txPayerWallet.getAddress());
            
            // Connect the wallet to the MetaForwarder contract
            const metaForwarderWithTxPayer = this.metaForwarderContract.connect(txPayerWallet);
            
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
            
            console.log('Executing meta-transaction with TX_PAYER account with parameters:');
            console.log('- Forward request:', forwardRequestForContract);
            console.log('- Signature:', signature);
            console.log('- TX options:', txOptions);
            
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
            console.error('Error executing meta-transaction with TX_PAYER account:', txPayerError);
            throw new Error('Failed to execute meta-transaction with TX_PAYER account: ' + 
              (txPayerError.message || 'Unknown error'));
          }
        }
      } catch (txError: any) {
        console.error('Error executing meta-transaction:', txError);
        throw new Error('Failed to execute meta-transaction: ' + (txError.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending meta transaction:', error);
      return null;
    }
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
    // Initialize contracts if not already done
    if (!this.projectRegistryContract) {
      await this.initContracts();
    }
    return this.projectRegistryContract || null;
  }

  public getTaxModuleContract(): ethers.Contract | null {
    return this.taxModuleContract;
  }

  public async getMetaForwarderContract(): Promise<ethers.Contract | null> {
    // Initialize contracts if not already done
    if (!this.metaForwarderContract) {
      await this.initContracts();
    }
    return this.metaForwarderContract || null;
  }

  // Area management functions
  public async getAllAreaIds(): Promise<string[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const areaCount = await this.urbanCoreContract['getAreaCount']();
      
      const areaIds: string[] = [];
      for (let i = 0; i < areaCount; i++) {
        const areaId = await this.urbanCoreContract['getAreaIdAtIndex'](i);
        areaIds.push(areaId.toString());
      }
      
      return areaIds;
    } catch (error) {
      console.error('Error getting area IDs:', error);
      return [];
    }
  }

  public async getAreaDetails(areaId: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const area = await this.urbanCoreContract['getArea'](areaId);
      return {
        id: areaId,
        name: area.name,
        adminHead: area.adminHead,
        citizenCount: area.citizenCount.toString(),
        metadata: area.metadata
      };
    } catch (error) {
      console.error(`Error getting area details for area ${areaId}:`, error);
      return {};
    }
  }

  public async assignAreaAdminHead(areaId: string, adminHeadAddress: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const tx = await this.urbanCoreContract['assignAreaAdminHead'](areaId, adminHeadAddress);
      return tx;
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

      // For TX_PAYER_ROLE specifically, we'll hardcode known TX_PAYER addresses since the contract
      // doesn't expose getRoleMemberCount/getRoleMember functions
      if (role === UserRole.TX_PAYER_ROLE) {
        console.log('Using known TX_PAYER address from logs:', '0xe0b1ee4660e296bae4054f67c5d46493ff455061');
        return ['0xe0b1ee4660e296bae4054f67c5d46493ff455061']; // The known TX_PAYER from logs
      }
      
      // Fallback method: check if the role is held using hasRole
      // Since we don't have a getRoleMemberCount/getRoleMember, we'll try another approach
      // This only works for specific addresses we want to check
      const knownAddresses = [
        '0xe0b1ee4660e296bae4054f67c5d46493ff455061' // TX_PAYER
      ];
      
      const addresses: string[] = [];
      for (const address of knownAddresses) {
        const hasRole = await this.urbanCoreContract['hasRole'](roleBytes, address);
        if (hasRole) {
          addresses.push(address);
        }
      }
      
      return addresses;
    } catch (error) {
      console.error(`Error getting role holders for ${role}:`, error);
      return [];
    }
  }

  public async getRoleRequests(role: UserRole): Promise<any[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleBytes = this.getRoleConstant(role);
      if (!roleBytes) {
        console.error(`No constant found for role ${role}`);
        return [];
      }
      
      const requestCount = await this.urbanCoreContract['getRoleRequestCount'](roleBytes);
      
      const requests = [];
      for (let i = 0; i < requestCount; i++) {
        const requestId = await this.urbanCoreContract['getRoleRequestIdAtIndex'](roleBytes, i);
        const request = await this.urbanCoreContract['getRoleRequest'](requestId);
        
        requests.push({
          id: requestId.toString(),
          requester: request.requester,
          role: this.convertRoleToEnum(request.role), // Convert bytes32 role to enum
          status: this.resolveRoleRequestStatus(request.status),
          timestamp: request.timestamp.toString(),
          metadataUri: request.metadataUri,
          areaId: request.areaId?.toString() || null // Extract areaId if available
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
    if (!roleBytes || roleBytes === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return UserRole.NONE;
    }
    
    // Map of role hash bytes to enum values (from role-verification.json)
    const roleMap: {[key: string]: UserRole} = {
      '0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e': UserRole.OWNER_ROLE,              // Verified from contract
      '0x0c79c71313e07ef49c5e10d46bbd278f8ec590008f378c219bb3e54b15bb0e84': UserRole.ADMIN_GOVT_ROLE,         // Corrected from verification
      '0xb302d06c4efadeded1e387e0955d9d440d227b6b55549296dd39bd21dc8eddf9': UserRole.ADMIN_HEAD_ROLE,         // Corrected from verification
      '0xa88d484f5aeb539ab60f9bd084e23511bc356a4f715a255e909643bb69ddcb41': UserRole.PROJECT_MANAGER_ROLE,    // Corrected from verification
      '0x7cb8da4815c5c7bfec597d7479bf1f02def0b6d0f50cd2ad5eb80c69ac5c1a1b': UserRole.TAX_COLLECTOR_ROLE,      // Corrected from verification
      '0x21702c8af46127c7fa207f89d0b0a8441bb32959a0ac7df790e9ab1a25c98926': UserRole.VALIDATOR_ROLE,          // Corrected from verification
      '0x8f1426173eb922d2001706a308dabfa96e3c06475230fb5111184f70a4b5776d': UserRole.CITIZEN_ROLE,            // Corrected from verification
      '0x56e46fdde77b111e5bb65b63a6dac3eb9e218dc429289c985fdd859cca14412b': UserRole.TX_PAYER_ROLE            // Corrected from verification
    };
    
    // Log the role for debugging
    console.log('Converting role bytes to enum:', roleBytes);
    const resolvedRole = roleMap[roleBytes] || UserRole.NONE;
    console.log('Resolved to role:', UserRole[resolvedRole]);
    
    // Return the mapped enum value or NONE if not found
    return resolvedRole;
  }

  public async approveRoleRequest(requestId: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const tx = await this.urbanCoreContract['approveRoleRequest'](requestId);
      return tx;
    } catch (error) {
      console.error(`Error approving role request ${requestId}:`, error);
      throw error;
    }
  }

  public async rejectRoleRequest(requestId: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const tx = await this.urbanCoreContract['rejectRoleRequest'](requestId);
      return tx;
    } catch (error) {
      console.error(`Error rejecting role request ${requestId}:`, error);
      throw error;
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
      // Convert data to JSON string
      const jsonData = JSON.stringify(data);
      
      // In a real implementation, this would use an IPFS client
      // For now, we'll use a mock implementation that returns a fake CID
      console.log('Uploading data to IPFS:', jsonData);
      
      // Generate a pseudo-random CID for testing
      const mockCid = 'Qm' + Array.from({length: 44}, () => 
        '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
      ).join('');
      
      return `ipfs://${mockCid}`;
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw error;
    }
  }

  public async getIpfsJson(ipfsUri: string): Promise<any> {
    try {
      // In a real implementation, this would fetch from IPFS
      // For now, return mock data based on the URI
      console.log('Fetching IPFS data from:', ipfsUri);
      
      // Generate some deterministic mock data based on the CID
      const cid = ipfsUri.replace('ipfs://', '');
      const mockData = {
        name: `User ${cid.substring(0, 6)}`,
        description: `Metadata for ${cid.substring(0, 10)}`,
        role: 'Admin Head',
        timestamp: Date.now() / 1000
      };
      
      return mockData;
    } catch (error) {
      console.error('Error getting IPFS JSON:', error);
      throw error;
    }
  }

  public async getAddressMetadata(address: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const metadataUri = await this.urbanCoreContract['getAddressMetadata'](address);
      
      if (!metadataUri || metadataUri === '') {
        return null;
      }
      
      return await this.getIpfsJson(metadataUri);
    } catch (error) {
      console.error(`Error getting metadata for address ${address}:`, error);
      return null;
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
      
      for (let i = 1; i <= maxToCheck; i += batchSize) {
        const promises = [];
        for (let j = i; j < i + batchSize && j <= maxToCheck; j++) {
          promises.push(
            this.grievanceHubContract['getGrievance'](j)
              .then(grievance => ({ id: j, ...grievance }))
              .catch(() => null)
          );
        }
        
        const grievanceBatch = await Promise.all(promises);
        
        for (const grievance of grievanceBatch) {
          // Check if grievance exists and has status 'Pending' (status code 0)
          if (grievance && grievance.status === 0) {
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
            
            // Parse grievance data from contract
            const parsedGrievance = {
              id: grievance.id.toString(),
              title: grievance.title || '',
              description: grievance.description || '',
              location: grievance.location || '',
              type: this.resolveGrievanceType(grievance.grievanceType || 0),
              timestamp: grievance.timestamp ? Number(grievance.timestamp) : Date.now() / 1000,
              citizenAddress: grievance.citizen,
              citizenName,
              urgent: grievance.urgent || false,
              imageUrls: grievance.documents ? this.parseDocumentUrls(grievance.documents) : []
            };
            
            pendingGrievances.push(parsedGrievance);
            
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
      
      // Parse grievance data from contract
      return {
        id: grievanceId,
        title: grievance.title || '',
        description: grievance.description || '',
        location: grievance.location || '',
        type: this.resolveGrievanceType(grievance.grievanceType || 0),
        timestamp: grievance.timestamp ? new Date(Number(grievance.timestamp) * 1000) : new Date(),
        citizenAddress: grievance.citizen,
        citizenName,
        validatorAddress: grievance.validator,
        status: this.resolveGrievanceStatus(grievance.status),
        urgent: grievance.urgent || false,
        imageUrls: grievance.documents ? this.parseDocumentUrls(grievance.documents) : [],
        comments: grievance.comments || '',
        resolutionDetails: grievance.resolutionDetails || '',
        resolutionTimestamp: grievance.resolutionTimestamp ? new Date(Number(grievance.resolutionTimestamp) * 1000) : null
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
        // Use meta transaction
        const methodName = isApproved ? 'approveGrievance' : 'rejectGrievance';
        const hash = await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          methodName,
          [grievanceIdBN, comments]
        );
        return !!hash;
      } else {
        // Direct transaction
        let tx;
        if (isApproved) {
          tx = await this.grievanceHubContract['approveGrievance'](grievanceIdBN, comments);
        } else {
          tx = await this.grievanceHubContract['rejectGrievance'](grievanceIdBN, comments);
        }
        
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
      
      for (let i = 1; i <= maxToCheck; i += batchSize) {
        const promises = [];
        for (let j = i; j < i + batchSize && j <= maxToCheck; j++) {
          promises.push(
            this.grievanceHubContract['getGrievance'](j)
              .then(grievance => ({ id: j, ...grievance }))
              .catch(() => null)
          );
        }
        
        const grievanceBatch = await Promise.all(promises);
        
        for (const grievance of grievanceBatch) {
          // Check if grievance exists, has been processed by this validator (status 1=Validated or 2=Rejected)
          // and the validator address matches
          if (grievance && 
              (grievance.status === 1 || grievance.status === 2) && 
              grievance.validator.toLowerCase() === validatorAddress.toLowerCase()) {
            
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
            
            // Parse grievance data from contract
            const parsedGrievance = {
              id: grievance.id.toString(),
              title: grievance.title || '',
              description: grievance.description || '',
              location: grievance.location || '',
              status: this.resolveGrievanceStatus(grievance.status),
              timestamp: grievance.timestamp ? new Date(Number(grievance.timestamp) * 1000) : new Date(),
              resolutionTimestamp: grievance.resolutionTimestamp ? new Date(Number(grievance.resolutionTimestamp) * 1000) : null,
              citizenAddress: grievance.citizen,
              citizenName,
              urgent: grievance.urgent || false,
              comments: grievance.comments || '',
              type: this.resolveGrievanceType(grievance.grievanceType || 0),
              imageUrls: grievance.documents ? this.parseDocumentUrls(grievance.documents) : []
            };
            
            processedGrievances.push(parsedGrievance);
          }
        }
      }
      
      // Sort by timestamp (most recent first)
      processedGrievances.sort((a, b) => {
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
      
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
      1: 'approved',
      2: 'rejected',
      3: 'resolved'
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
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        return await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'addComment',
          [grievanceId, comment]
        );
      } else {
        // Direct transaction
        const tx = await this.grievanceHubContract['addComment'](grievanceId, comment);
        const receipt = await tx.wait();
        return receipt.hash;
      }
    } catch (error) {
      console.error('Error adding comment to grievance:', error);
      return null;
    }
  }
  
  // Get recent tax payments for admin dashboard
  public async getRecentTaxPayments(limit: number = 5): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // In a real implementation, this would fetch recent payments from events or state
      // For now, return mock data
      const mockPayments = [];
      
      for (let i = 0; i < limit; i++) {
        mockPayments.push({
          id: `tx-${Date.now() - i * 86400000}`,
          citizen: `0x${Math.random().toString(16).substring(2, 12)}...`,
          amount: (Math.random() * 5 + 0.1).toFixed(4),
          timestamp: new Date(Date.now() - i * 86400000),
          assessmentId: `tax-${Math.floor(Math.random() * 1000)}`,
          receiptId: `receipt-${Math.floor(Math.random() * 10000)}`
        });
      }
      
      return mockPayments;
    } catch (error) {
      console.error('Error getting recent tax payments:', error);
      return [];
    }
  }

  // Project Manager module methods
  public async getProject(projectId: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      const project = await this.projectRegistryContract['getProject'](projectId);
      
      return {
        id: projectId,
        areaId: project.areaId,
        titleHash: project.titleHash,
        descriptionHash: project.descriptionHash,
        manager: project.manager,
        fundingGoal: project.fundingGoal,
        escrowed: project.escrowed,
        released: project.released,
        status: project.status,
        milestoneCount: project.milestoneCount,
        currentMilestone: project.currentMilestone,
        citizenUpvotes: project.citizenUpvotes,
        createdAt: project.createdAt
      };
    } catch (error) {
      console.error(`Error getting project ${projectId}:`, error);
      throw error;
    }
  }

  public async getIPFSContent(ipfsHash: string): Promise<string> {
    try {
      // In a real implementation, this would fetch from IPFS gateway
      // For now, return mock data based on the hash
      console.log('Fetching IPFS content for hash:', ipfsHash);
      
      // If it's a real IPFS hash/URI, strip the prefix
      const cleanHash = ipfsHash.replace('ipfs://', '');
      
      // For testing, return a deterministic string based on the hash
      if (cleanHash.includes('title')) {
        return `Project ${cleanHash.substring(0, 6)}`;
      } else if (cleanHash.includes('desc')) {
        return `This is a description for project ${cleanHash.substring(0, 6)}. It contains details about the project goals, timeline, and benefits to the community.`;
      } else {
        // Generate some dummy content based on the hash
        return `Content for ${cleanHash.substring(0, 10)}`;
      }
    } catch (error) {
      console.error('Error getting IPFS content:', error);
      return '';
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
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // In a real implementation, this would call a contract method
      // For now, return mock statistics
      return {
        totalAssessments: 75,
        totalCollected: ethers.parseEther('150'),
        totalPending: ethers.parseEther('50'),
        collectionRate: 75, // percentage
        paymentCount: 120
      };
    } catch (error) {
      console.error('Error getting tax collection stats:', error);
      return {
        totalAssessments: 0,
        totalCollected: ethers.parseEther('0'),
        totalPending: ethers.parseEther('0'),
        collectionRate: 0,
        paymentCount: 0
      };
    }
  }

  // Implementation of missing methods for citizen module
  public async getUserGrievances(userAddress: string | null): Promise<any[]> {
    try {
      if (!userAddress) return [];
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Mock implementation - to be replaced with actual contract call
      return [
        {
          id: '1',
          title: 'Road pothole on Main Street',
          description: 'Large pothole causing traffic hazards',
          status: 0, // 0=pending, 1=validated, 2=assigned, 3=resolved, 4=rejected
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago
          lastUpdated: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
          assignedTo: '0x0000000000000000000000000000000000000000',
          resolvedBy: null,
          resolvedAt: null,
          images: ['ipfs://QmHash1', 'ipfs://QmHash2']
        },
        {
          id: '2',
          title: 'Broken streetlight on Oak Avenue',
          description: 'Streetlight non-functional for 2 weeks causing safety concerns',
          status: 2, // assigned
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 10, // 10 days ago
          lastUpdated: Math.floor(Date.now() / 1000) - 86400 * 1, // 1 day ago
          assignedTo: '0x1234567890123456789012345678901234567890',
          resolvedBy: null,
          resolvedAt: null,
          images: ['ipfs://QmHash3']
        }
      ];
    } catch (error: any) {
      console.error(`Error getting user grievances for ${userAddress}:`, error);
      return [];
    }
  }
  
  public async submitGrievance(grievanceData: any): Promise<boolean> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        const hash = await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'submitGrievance',
          [
            grievanceData.title,
            grievanceData.description,
            grievanceData.location || '',
            grievanceData.images || []
          ]
        );
        return !!hash;
      } else {
        // Direct transaction
        const tx = await this.grievanceHubContract['submitGrievance'](
          grievanceData.title,
          grievanceData.description,
          grievanceData.location || '',
          grievanceData.images || []
        );
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
      
      // Mock implementation - to be replaced with actual contract call
      return [
        {
          id: '1',
          propertyId: '101',
          amount: ethers.parseEther('1.2'),
          dueDate: Math.floor(Date.now() / 1000) + 86400 * 15, // 15 days from now
          isPaid: false,
          year: 2023,
          description: 'Annual property tax',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 10 // 10 days ago
        },
        {
          id: '2',
          propertyId: '102',
          amount: ethers.parseEther('0.8'),
          dueDate: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago (overdue)
          isPaid: false,
          year: 2023,
          description: 'Special assessment for road maintenance',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 20 // 20 days ago
        },
        {
          id: '3',
          propertyId: '101',
          amount: ethers.parseEther('1.5'),
          dueDate: Math.floor(Date.now() / 1000) - 86400 * 60, // 60 days ago
          isPaid: true,
          paymentDate: Math.floor(Date.now() / 1000) - 86400 * 65, // paid 65 days ago
          year: 2022,
          description: 'Annual property tax',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 120 // 120 days ago
        }
      ];
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
    year?: number,
    citizenAddress?: string
  ): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // If citizenAddress is provided, get assessments for that citizen only
      if (citizenAddress) {
        const assessmentCount = await this.taxModuleContract['getTaxAssessmentCountForCitizen'](citizenAddress);
        const assessments = [];
        
        for (let i = 0; i < assessmentCount; i++) {
          const id = await this.taxModuleContract['getCitizenTaxAssessmentIdAtIndex'](citizenAddress, i);
          const assessment = await this.taxModuleContract['getTaxAssessment'](id);
          
          // Skip if paid or if year doesn't match (if year is specified)
          if (assessment.paid || (year !== undefined && assessment.year !== year)) {
            continue;
          }
          
          assessments.push({
            id: id.toString(),
            amount: ethers.formatEther(assessment.amount),
            year: assessment.year,
            paid: assessment.paid,
            dueDate: new Date(Number(assessment.dueDate) * 1000),
            citizen: assessment.citizen,
            propertyId: assessment.propertyId,
            description: assessment.description || ''
          });
        }
        
        return assessments;
      } 
      // Otherwise, get all pending assessments for the specified year
      else {
        const pendingCount = await this.taxModuleContract['getPendingAssessmentCount'](year || 0);
        const assessments = [];
        
        for (let i = 0; i < pendingCount; i++) {
          const id = await this.taxModuleContract['getPendingAssessmentAtIndex'](i, year || 0);
          const assessment = await this.taxModuleContract['getTaxAssessment'](id);
          
          assessments.push({
            id: id.toString(),
            amount: ethers.formatEther(assessment.amount),
            year: assessment.year,
            paid: false, // Must be pending since we're calling getPendingAssessmentAtIndex
            dueDate: new Date(Number(assessment.dueDate) * 1000),
            citizen: assessment.citizen,
            propertyId: assessment.propertyId,
            description: assessment.description || ''
          });
        }
        
        return assessments;
      }
    } catch (error) {
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

  // Project management methods
  public async getManagerProjects(managerAddress: string): Promise<number[]> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // In a real implementation, this would call a contract method to get all project IDs
      // For now, return mock data
      return [1, 2, 3, 4, 5];
    } catch (error) {
      console.error('Error getting manager projects:', error);
      return [];
    }
  }
  
  public async getRemainingFunds(projectId: number): Promise<string> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      const project = await this.getProject(projectId);
      if (!project) return '0';
      
      // Calculate remaining funds (budget - released)
      const budget = project.fundingGoal || project.budget || ethers.parseEther('0');
      const released = project.released || ethers.parseEther('0');
      const remaining = budget - released;
      
      return this.fromWei(remaining);
    } catch (error) {
      console.error(`Error getting remaining funds for project ${projectId}:`, error);
      return '0';
    }
  }
  
  public async getMilestone(projectId: number, milestoneIndex: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // In a real implementation, this would call a contract method to get milestone data
      // For now, return mock data
      const milestoneData = [
        {
          title: 'Project Initiation',
          description: 'Setting up the project and initial planning',
          funds: ethers.parseEther('2.5'),
          completed: true,
          releaseDate: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 20 // 20 days ago
        },
        {
          title: 'Phase 1 Development',
          description: 'Implementation of core features',
          funds: ethers.parseEther('2.5'),
          completed: true,
          releaseDate: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 10 // 10 days ago
        },
        {
          title: 'Phase 2 Development',
          description: 'Implementation of advanced features',
          funds: ethers.parseEther('2.5'),
          completed: false,
          releaseDate: 0
        },
        {
          title: 'Final Release',
          description: 'Final testing and project completion',
          funds: ethers.parseEther('2.5'),
          completed: false,
          releaseDate: 0
        }
      ];
      
      if (milestoneIndex < 0 || milestoneIndex >= milestoneData.length) {
        throw new Error('Invalid milestone index');
      }
      
      return milestoneData[milestoneIndex];
    } catch (error) {
      console.error(`Error getting milestone for project ${projectId} at index ${milestoneIndex}:`, error);
      return null;
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
      
      // Mock implementation for AdminHead module
      console.log(`Creating project with title hash ${titleIpfsHash}, manager ${managerAddress}, in area ${areaId}`);
      console.log(`Budget: ${budgetInWei}, initial funding: ${initialFundingInWei}, milestones: ${totalMilestones}`);
      
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
