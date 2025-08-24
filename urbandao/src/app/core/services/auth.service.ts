import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Web3Service } from './web3.service';
import { ContractService } from './contract.service';
import { UserRole } from '../models/role.model';
import { Router } from '@angular/router';
import * as ethers from 'ethers';
import { environment } from '../../../environments/environment';

export interface User {
  address: string;
  role: UserRole;
  isLoggedIn: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private registrationStatusSubject = new BehaviorSubject<'pending' | 'approved' | 'rejected' | null>(null);

  public user$ = this.userSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public registrationStatus$ = this.registrationStatusSubject.asObservable();

  constructor(
    private web3Service: Web3Service,
    private contractService: ContractService,
    private router: Router
  ) {
    // Listen for wallet connection changes
    this.web3Service.account$.subscribe(address => {
      if (address) {
        this.checkUserStatus(address).catch(error => {
          console.error('Error checking user status on account change:', error);
        });
      } else {
        this.logout().catch(error => {
          console.error('Error during logout:', error);
        });
      }
    });
    
    // Check user status on init if wallet is already connected
    if (this.web3Service.isConnected()) {
      const address = this.web3Service.getAccount();
      if (address) {
        this.checkUserStatus(address).catch(error => {
          console.error('Error checking initial user status:', error);
        });
      }
    }
  }

  private async checkUserStatus(address: string): Promise<void> {
    try {
      this.loadingSubject.next(true);
      
      // Get the user role directly from the contract service
      // This uses the improved dynamic role hash computation
      let role: UserRole = UserRole.NONE; // Initialize with default value
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`Attempt ${retryCount + 1}/${maxRetries} to get user role for address: ${address}`);
          
          // Ensure contracts are initialized before checking role
          await this.contractService.initContracts();
          
          role = await this.contractService.getUserRole(address) || UserRole.NONE;
          console.log(`User role from contract service (attempt ${retryCount + 1}): ${role}, ${UserRole[role]}`);
          
          // If we got a valid role or explicitly got NONE after proper contract initialization, break the retry loop
          break;
        } catch (error: any) {
          retryCount++;
          console.error(`Error getting user role (attempt ${retryCount}/${maxRetries}):`, error);
          
          if (retryCount >= maxRetries) {
            throw new Error('Failed to get user role after multiple attempts: ' + (error.message || 'Unknown error'));
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Default to NONE if role is still undefined after retries
      role = role || UserRole.NONE;
      
      if (role !== UserRole.NONE) {
        // User has a role, they are registered
        console.log(`User has role: ${UserRole[role]}, setting as logged in`);
        this.userSubject.next({
          address,
          role: role,
          isLoggedIn: true
        });
        this.registrationStatusSubject.next('approved');
      } else {
        // User has no role, check if registration is pending
        console.log('No role detected, checking if registration is pending');
        const isPending = await this.checkRegistrationPending(address);
        
        if (isPending) {
          console.log('Registration is pending');
          this.registrationStatusSubject.next('pending');
        } else {
          console.log('No pending registration found');
          this.registrationStatusSubject.next(null);
        }
        
        this.userSubject.next({
          address,
          role: UserRole.NONE,
          isLoggedIn: false
        });
      }
    } catch (error: any) {
      console.error('Error checking user status:', error);
      this.userSubject.next({
        address,
        role: UserRole.NONE,
        isLoggedIn: false
      });
      this.registrationStatusSubject.next(null);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  public async login(): Promise<boolean> {
    try {
      this.loadingSubject.next(true);
      
      // Connect wallet
      let address;
      try {
        address = await this.web3Service.connectWallet();
      } catch (error: any) {
        console.error('Wallet connection failed:', error);
        throw new Error('Failed to connect wallet: ' + (error.message || 'Unknown error'));
      }
      
      if (!address) {
        throw new Error('No address returned after wallet connection');
      }
      
      // Initialize contracts before checking user status
      try {
        await this.contractService.getUrbanCoreContract();
      } catch (error: any) {
        console.error('Contract initialization failed:', error);
        throw new Error('Failed to initialize contracts: ' + (error.message || 'Unknown error'));
      }
      
      // Check user status
      await this.checkUserStatus(address);
      
      // If user has a role, they are logged in
      const user = this.userSubject.value;
      
      if (user && user.role !== UserRole.NONE) {
        console.log('User has role, navigating to role-specific page:', user.role);
        // Handle role-based navigation directly here
        this.navigateByRole(user.role);
        return true;
      }
      
      // Check if registration is pending
      if (this.registrationStatusSubject.value === 'pending') {
        console.log('Registration pending, navigating to status page');
        // Redirect to registration status page
        this.router.navigate(['/registration-status']);
        return false;
      }
      
      // No role and no pending registration, need to register
      console.log('No role and not pending, navigating to register page');
      this.router.navigate(['/register']);
      return false;
    } catch (error: any) {
      console.error('Error logging in:', error);
      // Alert the user with a more specific error
      return false;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  public async logout(): Promise<void> {
    await this.web3Service.disconnectWallet();
    this.userSubject.next(null);
    this.registrationStatusSubject.next(null);
    this.router.navigate(['/']);
  }

  public async register(dataOrName: any): Promise<boolean> {
    try {
      this.loadingSubject.next(true);
      
      // Make sure wallet is connected
      const address = await this.web3Service.connectWallet();
      
      if (!address) {
        throw new Error('Wallet not connected');
      }

      // Get contract instance with proper async handling
      const urbanCore = await this.contractService.getUrbanCoreContract();
      
      if (!urbanCore) {
        throw new Error('UrbanCore contract not initialized');
      }
      
      // Extract registration data
      const name = dataOrName.name || dataOrName.fullName;
      const aadhaar = dataOrName.aadhaar || dataOrName.id;
      const area = dataOrName.area || dataOrName.areaId || 1;
      
      // Create bytes32 hash of citizen data
      const dataHash = ethers.keccak256(
        ethers.toUtf8Bytes(
          JSON.stringify({
            name: name,
            aadhaar: aadhaar,
            area: area
          })
        )
      );
      
      console.log('Using gasless transaction for registration');
      // Use gasless transaction via MetaForwarder
      const txHash = await this.contractService.sendMetaTransaction(
        environment.contracts.UrbanCore,
        'registerCitizen',
        [dataHash]
      );
      
      if (!txHash) {
        throw new Error('Failed to send gasless transaction');
      }
      
      console.log('Registration transaction submitted:', txHash);
      
      // Update registration status
      this.registrationStatusSubject.next('pending');
      
      // Redirect to registration status page
      this.router.navigate(['/registration-status']);
      
      return true;
    } catch (error: any) {
      console.error('Error registering user:', error);
      return false;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private async checkRegistrationPending(address: string): Promise<boolean> {
    try {
      // Get the UrbanCore contract with proper async handling
      let urbanCore;
      try {
        urbanCore = await this.contractService.getUrbanCoreContract();
      } catch (error: any) {
        console.error('Failed to get UrbanCore contract for registration check:', error);
        throw new Error('Urban Core contract not initialized: ' + (error.message || 'Unknown error'));
      }
      
      if (!urbanCore) {
        throw new Error('UrbanCore contract is null for registration check');
      }
      
      // Get the citizen request to check if it exists and is not processed
      let request;
      try {
        request = await urbanCore['getCitizenRequest'](address);
      } catch (error: any) {
        console.error('Error calling getCitizenRequest:', error);
        throw new Error('Failed to get citizen request: ' + (error.message || 'Unknown error'));
      }
      
      // If citizen property is non-zero address and not processed, the request is pending
      const isPending = request && 
             request.citizen !== '0x0000000000000000000000000000000000000000' && 
             !request.processed;
             
      console.log('Registration pending check result:', isPending);
      return isPending;
    } catch (error: any) {
      console.error('Error checking registration status:', error);
      return false;
    }
  }

  public isAuthenticated(): boolean {
    const user = this.userSubject.value;
    return !!user && user.isLoggedIn;
  }

  public hasRole(role: UserRole): boolean {
    const user = this.userSubject.value;
    
    if (!user || !user.isLoggedIn) {
      return false;
    }
    
    // Check if user has specific role
    return user.role === role;
  }

  public hasAnyRole(roles: UserRole[]): boolean {
    const user = this.userSubject.value;
    
    if (!user || !user.isLoggedIn) {
      return false;
    }
    
    // Check if user has any of the specified roles
    return roles.includes(user.role);
  }

  public getCurrentUser(): User | null {
    return this.userSubject.value;
  }

  public getRegistrationStatus(): 'pending' | 'approved' | 'rejected' | null {
    return this.registrationStatusSubject.value;
  }
  
  // Alias for getRegistrationStatus to maintain compatibility
  public async checkRegistrationStatus(): Promise<'registered' | 'pending' | 'not_registered' | 'rejected' | null> {
    const status = await this.getRegistrationStatus();
    // Convert 'approved' to 'registered' and null to 'not_registered' to match component expectations
    if (status === 'approved') return 'registered';
    if (status === null) return 'not_registered';
    return status; // 'pending' and 'rejected' remain the same
  }
  
  // Add method to check user role
  public async checkUserRole(): Promise<void> {
    const address = this.web3Service.getAccount();
    if (address) {
      await this.checkUserStatus(address);
    }
  }
  
  // Helper method for role-based navigation
  private navigateByRole(role: UserRole): void {
    // First make sure the role is valid
    if (role === undefined || role === null) {
      console.warn('Attempted navigation with null or undefined role, redirecting to home');
      this.router.navigate(['/']);
      return;
    }

    // Log the navigation intent for debugging
    console.log(`Navigating user based on role: ${role} (${UserRole[role]})`); 
    
    switch(role) {
      case UserRole.CITIZEN_ROLE:
        console.log('Navigating to citizen dashboard');
        this.router.navigate(['/citizen']);
        break;
      case UserRole.VALIDATOR_ROLE:
        console.log('Navigating to validator dashboard');
        this.router.navigate(['/validator']);
        break;
      case UserRole.TAX_COLLECTOR_ROLE:
        console.log('Navigating to tax collector dashboard');
        this.router.navigate(['/tax-collector']);
        break;
      case UserRole.PROJECT_MANAGER_ROLE:
        console.log('Navigating to project manager dashboard');
        this.router.navigate(['/project-manager']);
        break;
      case UserRole.ADMIN_HEAD_ROLE:
        console.log('Navigating to admin head dashboard');
        this.router.navigate(['/admin-head']);
        break;
      case UserRole.ADMIN_GOVT_ROLE:
        console.log('Navigating to admin govt dashboard');
        this.router.navigate(['/admin-govt']);
        break;
      case UserRole.OWNER_ROLE:
        console.log('Navigating to owner dashboard');
        this.router.navigate(['/owner']);
        break;
      case UserRole.TX_PAYER_ROLE:
        console.log('Navigating to tx payer dashboard');
        this.router.navigate(['/tx-payer']);
        break;
      case UserRole.NONE:
        console.log('No role assigned, redirecting to register page');
        this.router.navigate(['/register']);
        break;
      default:
        console.warn(`Unrecognized role value: ${role}, redirecting to home`);
        this.router.navigate(['/']);
    }
  }
}
