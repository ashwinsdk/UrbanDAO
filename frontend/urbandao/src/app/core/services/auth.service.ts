import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Web3Service } from './web3.service';
import { ContractService } from './contract.service';
import { UserRole } from '../models/role.model';
import { Router } from '@angular/router';

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
        this.checkUserStatus(address);
      } else {
        this.logout();
      }
    });
  }

  private async checkUserStatus(address: string): Promise<void> {
    try {
      this.loadingSubject.next(true);
      
      // Check user role
      const urbanCore = this.contractService.getUrbanCoreContract();
      if (!urbanCore) throw new Error('Urban Core contract not initialized');
      
      const role = await urbanCore['getUserRole'](address);
      
      if (role) {
        // User has a role, they are registered
        this.userSubject.next({
          address,
          role: role as UserRole,
          isLoggedIn: true
        });
        this.registrationStatusSubject.next('approved');
      } else {
        // User has no role, check if registration is pending
        const isPending = await this.checkRegistrationPending(address);
        
        if (isPending) {
          this.registrationStatusSubject.next('pending');
        } else {
          this.registrationStatusSubject.next(null);
        }
        
        this.userSubject.next({
          address,
          role: UserRole.NONE,
          isLoggedIn: false
        });
      }
    } catch (error) {
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
      const address = await this.web3Service.connectWallet();
      
      if (!address) {
        throw new Error('Failed to connect wallet');
      }
      
      // Check user status
      await this.checkUserStatus(address);
      
      // If user has a role, they are logged in
      const user = this.userSubject.value;
      
      if (user && user.role !== UserRole.NONE) {
        return true;
      }
      
      // Check if registration is pending
      if (this.registrationStatusSubject.value === 'pending') {
        // Redirect to registration status page
        this.router.navigate(['/registration-status']);
        return false;
      }
      
      // No role and no pending registration, need to register
      this.router.navigate(['/register']);
      return false;
    } catch (error) {
      console.error('Error logging in:', error);
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

  public async register(dataOrName: string | any, email?: string, areaId?: number, role?: UserRole): Promise<boolean> {
    // Handle both object and individual parameters
    let name: string, emailVal: string, areaIdVal: number, roleVal: UserRole;
    
    if (typeof dataOrName === 'object') {
      // Object parameter mode
      const data = dataOrName;
      name = data.fullName || data.name;
      emailVal = data.email;
      areaIdVal = data.areaId || 1; // Default to area 1 if not provided
      roleVal = data.role;
    } else {
      // Individual parameters mode
      name = dataOrName;
      emailVal = email!;
      areaIdVal = areaId!;
      roleVal = role!;
    }
    try {
      this.loadingSubject.next(true);
      
      // Check if wallet is connected
      if (!this.web3Service.isConnected()) {
        await this.web3Service.connectWallet();
      }
      
      const address = this.web3Service.getAccount();
      
      if (!address) {
        throw new Error('Wallet not connected');
      }
      
      // Call registration function on contract
      const urbanCore = this.contractService.getUrbanCoreContract();
      
      if (!urbanCore) {
        throw new Error('UrbanCore contract not initialized');
      }
      
      // Submit registration request
      const tx = await urbanCore['registerUser'](name, emailVal, areaIdVal, roleVal);
      const receipt = await tx.wait();
      
      // Registration submitted, update status
      this.registrationStatusSubject.next('pending');
      this.router.navigate(['/registration-status']);
      
      return true;
    } catch (error) {
      console.error('Error registering user:', error);
      return false;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private async checkRegistrationPending(address: string): Promise<boolean> {
    try {
      const urbanCore = this.contractService.getUrbanCoreContract();
      
      if (!urbanCore) {
        throw new Error('UrbanCore contract not initialized');
      }
      
      // Check if registration is pending
      const isPending = await urbanCore['isRegistrationPending'](address);
      return isPending;
    } catch (error) {
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
}
