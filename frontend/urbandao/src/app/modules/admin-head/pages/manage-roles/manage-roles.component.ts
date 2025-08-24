import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserRole } from '../../../../core/models/role.model';

interface RoleRequest {
  id: string;
  requestor: string;
  role: UserRole;
  timestamp: number;
  status: string;
  name?: string;
  email?: string;
}

interface RoleAssignment {
  address: string;
  role: UserRole;
  timestamp: number;
  name?: string;
}

@Component({
  selector: 'app-manage-roles',
  templateUrl: './manage-roles.component.html',
  styleUrls: ['./manage-roles.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule
  ]
})
export class ManageRolesComponent implements OnInit {
  // View state
  loading = true;
  loadingAction = false;
  error: string | null = null;
  success: string | null = null;
  activeTab: 'requests' | 'assign' | 'current' = 'requests';
  
  // Data containers
  areaId: string | null = null;
  userAddress: string | null = null;
  roleRequests: RoleRequest[] = [];
  roleAssignments: RoleAssignment[] = [];
  
  // Forms
  assignRoleForm: FormGroup;
  
  // Available roles for Admin Head to assign
  availableRoles = [
    { value: UserRole.VALIDATOR_ROLE, label: 'Validator' },
    { value: UserRole.TAX_COLLECTOR_ROLE, label: 'Tax Collector' },
    { value: UserRole.PROJECT_MANAGER_ROLE, label: 'Project Manager' }
  ];

  constructor(
    private router: Router,
    private contractService: ContractService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.assignRoleForm = this.fb.group({
      address: ['', [Validators.required, Validators.pattern(/^0x[a-fA-F0-9]{40}$/)]],
      role: ['', Validators.required],
      name: ['', [Validators.minLength(2)]],
      email: ['', [Validators.email]]
    });
  }

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.loadAreaAndRoleData();
      }
    });
  }

  async loadAreaAndRoleData(): Promise<void> {
    try {
      this.loading = true;
      
      // Get area ID for this admin
      this.areaId = await this.contractService.getAdminAreaId(this.userAddress);
      
      if (!this.areaId) {
        this.error = 'You are not assigned to any area. Please contact the system administrator.';
        this.loading = false;
        return;
      }
      
      // Load role requests
      await this.loadRoleRequests();
      
      // Load existing role assignments
      await this.loadRoleAssignments();
      
      this.loading = false;
    } catch (error: any) {
      console.error('Error loading role data:', error);
      this.error = error.message || 'Failed to load role data. Please try again.';
      this.loading = false;
    }
  }

  async loadRoleRequests(): Promise<void> {
    if (!this.areaId) return;
    
    try {
      // Get pending role requests from the contract
      const requests = await this.contractService.getPendingRoleRequests(this.areaId);
      
      this.roleRequests = [];
      
      for (const request of requests) {
        // Get additional info from IPFS if available
        let name = '';
        let email = '';
        
        if (request.metadataHash) {
          try {
            const metadata = await this.contractService.getIPFSContent(request.metadataHash);
            if (metadata) {
              const parsed = JSON.parse(metadata);
              name = parsed.name || '';
              email = parsed.email || '';
            }
          } catch (e) {
            console.warn('Failed to parse metadata for request:', e);
          }
        }
        
        this.roleRequests.push({
          id: request.id,
          requestor: request.requestor,
          role: request.role,
          timestamp: request.timestamp,
          status: request.status,
          name,
          email
        });
      }
      
      // Sort by most recent first
      this.roleRequests.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error: any) {
      console.error('Error loading role requests:', error);
      this.error = error.message || 'Failed to load role requests. Please try again.';
    }
  }

  async loadRoleAssignments(): Promise<void> {
    if (!this.areaId) return;
    
    try {
      this.roleAssignments = [];
      
      // Get role assignments for each available role
      for (const roleObj of this.availableRoles) {
        const roleHolders = await this.contractService.getRoleHoldersByArea(this.areaId, roleObj.value);
        
        for (const holder of roleHolders) {
          this.roleAssignments.push({
            address: holder.address,
            role: roleObj.value,
            timestamp: holder.timestamp || 0,
            name: holder.name || ''
          });
        }
      }
      
      // Sort by most recent first
      this.roleAssignments.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error: any) {
      console.error('Error loading role assignments:', error);
    }
  }

  async approveRoleRequest(request: RoleRequest): Promise<void> {
    try {
      this.loadingAction = true;
      this.success = null;
      this.error = null;
      
      // Check if requestor already has another role
      const hasAnotherRole = await this.contractService.hasAnyOtherRole(request.requestor);
      
      if (hasAnotherRole) {
        if (!confirm(`Warning: This address already has another role assigned. Assigning a new role may cause issues with role collisions. Do you want to proceed anyway?`)) {
          this.loadingAction = false;
          return;
        }
      }
      
      // Call contract to approve role request
      const result = await this.contractService.approveRoleRequestWithArea(request.id, this.areaId!);
      
      if (result) {
        this.success = `Role request approved! ${this.formatAddress(request.requestor)} has been assigned as ${this.getRoleLabel(request.role)}.`;
        
        // Reload data after a short delay
        setTimeout(() => {
          this.loadRoleRequests();
          this.loadRoleAssignments();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error approving role request:', error);
      this.error = error.message || 'Failed to approve role request. Please try again.';
    } finally {
      this.loadingAction = false;
    }
  }

  async rejectRoleRequest(request: RoleRequest): Promise<void> {
    if (!confirm(`Are you sure you want to reject the role request from ${this.formatAddress(request.requestor)}?`)) {
      return;
    }
    
    try {
      this.loadingAction = true;
      this.success = null;
      this.error = null;
      
      // Call contract to reject role request
      const result = await this.contractService.rejectRoleRequest(request.id);
      
      if (result) {
        this.success = `Role request rejected successfully.`;
        
        // Reload requests after a short delay
        setTimeout(() => {
          this.loadRoleRequests();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error rejecting role request:', error);
      this.error = error.message || 'Failed to reject role request. Please try again.';
    } finally {
      this.loadingAction = false;
    }
  }

  async submitAssignRoleForm(): Promise<void> {
    if (this.assignRoleForm.invalid) {
      return;
    }
    
    try {
      this.loadingAction = true;
      this.success = null;
      this.error = null;
      
      const formData = this.assignRoleForm.value;
      
      // Check if address already has another role
      const hasAnotherRole = await this.contractService.hasAnyOtherRole(formData.address);
      
      if (hasAnotherRole) {
        if (!confirm(`Warning: This address already has another role assigned. Assigning a new role may cause issues with role collisions. Do you want to proceed anyway?`)) {
          this.loadingAction = false;
          return;
        }
      }
      
      // Check if the address is already registered as a citizen
      const isCitizen = await this.contractService.hasRole(UserRole.CITIZEN_ROLE, formData.address);
      
      if (!isCitizen) {
        this.error = 'This address is not registered as a citizen. Only citizens can be assigned roles.';
        this.loadingAction = false;
        return;
      }
      
      // Prepare metadata if name or email is provided
      let metadataHash = '';
      
      if (formData.name || formData.email) {
        const metadata = {
          name: formData.name || '',
          email: formData.email || ''
        };
        
        metadataHash = await this.contractService.uploadToIPFS(JSON.stringify(metadata));
      }
      
      // Call contract to assign role
      const result = await this.contractService.assignRole(
        formData.address,
        formData.role,
        this.areaId!,
        metadataHash
      );
      
      if (result) {
        this.success = `Role assigned successfully! ${this.formatAddress(formData.address)} has been assigned as ${this.getRoleLabel(formData.role)}.`;
        this.assignRoleForm.reset();
        
        // Reload role assignments after a short delay
        setTimeout(() => {
          this.loadRoleAssignments();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error assigning role:', error);
      this.error = error.message || 'Failed to assign role. Please try again.';
    } finally {
      this.loadingAction = false;
    }
  }

  async revokeRole(assignment: RoleAssignment): Promise<void> {
    if (!confirm(`Are you sure you want to revoke the ${this.getRoleLabel(assignment.role)} role from ${this.formatAddress(assignment.address)}?`)) {
      return;
    }
    
    try {
      this.loadingAction = true;
      this.success = null;
      this.error = null;
      
      // Call contract to revoke role
      const result = await this.contractService.revokeRole(assignment.role, assignment.address);
      
      if (result) {
        this.success = `Role revoked successfully.`;
        
        // Reload role assignments after a short delay
        setTimeout(() => {
          this.loadRoleAssignments();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error revoking role:', error);
      this.error = error.message || 'Failed to revoke role. Please try again.';
    } finally {
      this.loadingAction = false;
    }
  }

  setActiveTab(tab: 'requests' | 'assign' | 'current'): void {
    this.activeTab = tab;
  }

  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  formatTimestamp(timestamp: number): string {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }
  
  getRoleLabel(roleConstant: UserRole): string {
    const role = this.availableRoles.find(r => r.value === roleConstant);
    return role ? role.label : roleConstant;
  }
  
  countPendingRequests(): number {
    return this.roleRequests.filter(req => req.status === 'PENDING').length;
  }
}
