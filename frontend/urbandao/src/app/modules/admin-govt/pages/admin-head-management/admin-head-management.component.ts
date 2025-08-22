import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ContractService } from '../../../../core/services/contract.service';

interface AdminHead {
  address: string;
  name?: string;
  areaId?: string;
  areaName?: string;
  metadata?: any;
}

interface RoleRequest {
  id: string;
  address: string;
  name?: string;
  role: string;
  timestamp: number;
  status: string;
  metadata?: any;
}

@Component({
  selector: 'app-admin-head-management',
  templateUrl: './admin-head-management.component.html',
  styleUrls: ['./admin-head-management.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule
  ]
})
export class AdminHeadManagementComponent implements OnInit {
  // View states
  loading = true;
  processingAction = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Tab state
  activeTab: 'current' | 'requests' | 'assign' = 'current';
  
  // Data containers
  adminHeads: AdminHead[] = [];
  roleRequests: RoleRequest[] = [];
  areas: any[] = [];
  
  // Filters
  searchQuery = '';
  filteredAdminHeads: AdminHead[] = [];
  filteredRoleRequests: RoleRequest[] = [];
  
  // Selected items
  selectedAdminHead: AdminHead | null = null;
  
  // Forms
  assignRoleForm: FormGroup;
  
  constructor(
    private formBuilder: FormBuilder,
    private contractService: ContractService,
    private authService: AuthService
  ) {
    this.assignRoleForm = this.formBuilder.group({
      address: ['', [Validators.required, Validators.pattern('^0x[a-fA-F0-9]{40}$')]],
      name: [''],
      areaId: ['', Validators.required],
      metadataUri: ['']
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      
      // Load areas first
      await this.loadAreas();
      
      // Load admin heads
      await this.loadAdminHeads();
      
      // Load role requests
      await this.loadRoleRequests();
      
      this.loading = false;
    } catch (error: any) {
      console.error('Error loading data:', error);
      this.error = error.message || 'Failed to load data. Please try again.';
      this.loading = false;
    }
  }
  
  async loadAreas(): Promise<void> {
    try {
      // Get all areas from the contract
      const areaIds = await this.contractService.getAllAreaIds();
      
      this.areas = [];
      
      for (const areaId of areaIds) {
        // Get area details
        const area = await this.contractService.getAreaDetails(areaId);
        
        this.areas.push({
          id: areaId,
          name: area.name || `Area ${areaId}`,
          adminHead: area.adminHead || '0x0000000000000000000000000000000000000000'
        });
      }
      
      // Sort areas by ID
      this.areas.sort((a, b) => Number(a.id) - Number(b.id));
    } catch (error: any) {
      console.error('Error loading areas:', error);
      throw error;
    }
  }
  
  async loadAdminHeads(): Promise<void> {
    try {
      // Get all addresses with the ADMIN_HEAD_ROLE
      const adminHeadAddresses = await this.contractService.getRoleHolders('ADMIN_HEAD_ROLE');
      
      this.adminHeads = [];
      
      for (const address of adminHeadAddresses) {
        // Get metadata if available
        let metadata = null;
        let name = null;
        
        try {
          metadata = await this.contractService.getAddressMetadata(address);
          name = metadata?.name;
        } catch (e) {
          console.warn('Failed to get metadata for address:', address);
        }
        
        // Find if assigned to an area
        const assignedArea = this.areas.find(area => 
          area.adminHead.toLowerCase() === address.toLowerCase()
        );
        
        this.adminHeads.push({
          address,
          name,
          areaId: assignedArea?.id,
          areaName: assignedArea?.name,
          metadata
        });
      }
      
      // Update filtered list
      this.filterAdminHeads();
    } catch (error: any) {
      console.error('Error loading admin heads:', error);
      throw error;
    }
  }
  
  async loadRoleRequests(): Promise<void> {
    try {
      // Get all role requests for ADMIN_HEAD_ROLE
      const requests = await this.contractService.getRoleRequests('ADMIN_HEAD_ROLE');
      
      this.roleRequests = [];
      
      for (const request of requests) {
        // Only include pending requests
        if (request.status !== 'pending') continue;
        
        // Get metadata if available
        let metadata = null;
        let name = null;
        
        if (request.metadataUri) {
          try {
            metadata = await this.contractService.getIpfsJson(request.metadataUri);
            name = metadata?.name;
          } catch (e) {
            console.warn('Failed to get metadata for request:', request);
          }
        }
        
        this.roleRequests.push({
          id: request.id,
          address: request.requester,
          role: request.role,
          timestamp: request.timestamp,
          status: request.status,
          name,
          metadata
        });
      }
      
      // Sort by timestamp (most recent first)
      this.roleRequests.sort((a, b) => b.timestamp - a.timestamp);
      
      // Update filtered list
      this.filterRoleRequests();
    } catch (error: any) {
      console.error('Error loading role requests:', error);
      throw error;
    }
  }

  filterAdminHeads(): void {
    if (!this.searchQuery.trim()) {
      this.filteredAdminHeads = [...this.adminHeads];
      return;
    }
    
    const query = this.searchQuery.toLowerCase().trim();
    this.filteredAdminHeads = this.adminHeads.filter(admin => 
      admin.address.toLowerCase().includes(query) ||
      (admin.name && admin.name.toLowerCase().includes(query)) ||
      (admin.areaName && admin.areaName.toLowerCase().includes(query))
    );
  }
  
  filterRoleRequests(): void {
    if (!this.searchQuery.trim()) {
      this.filteredRoleRequests = [...this.roleRequests];
      return;
    }
    
    const query = this.searchQuery.toLowerCase().trim();
    this.filteredRoleRequests = this.roleRequests.filter(request => 
      request.address.toLowerCase().includes(query) ||
      (request.name && request.name.toLowerCase().includes(query))
    );
  }
  
  search(): void {
    this.filterAdminHeads();
    this.filterRoleRequests();
  }
  
  clearSearch(): void {
    this.searchQuery = '';
    this.filterAdminHeads();
    this.filterRoleRequests();
  }
  
  selectAdminHead(adminHead: AdminHead): void {
    this.selectedAdminHead = adminHead;
  }
  
  clearSelectedAdminHead(): void {
    this.selectedAdminHead = null;
  }
  
  setActiveTab(tab: 'current' | 'requests' | 'assign'): void {
    this.activeTab = tab;
    this.selectedAdminHead = null;
  }
  
  async assignAdminHeadRole(): Promise<void> {
    if (this.assignRoleForm.invalid) {
      return;
    }
    
    try {
      this.processingAction = true;
      this.error = null;
      this.successMessage = null;
      
      const address = this.assignRoleForm.get('address')?.value;
      const name = this.assignRoleForm.get('name')?.value;
      const areaId = this.assignRoleForm.get('areaId')?.value;
      const metadataUri = this.assignRoleForm.get('metadataUri')?.value;
      
      // Check if address already has any role
      const hasRole = await this.contractService.hasRole('ADMIN_HEAD_ROLE', address);
      
      // If not, grant the admin head role
      if (!hasRole) {
        let metadata = null;
        
        // If name is provided, upload to IPFS
        if (name) {
          metadata = { name };
          const metadataUri = await this.contractService.uploadToIpfs(metadata);
          
          // Grant role with metadata
          const grantTx = await this.contractService.grantRoleWithMetadata('ADMIN_HEAD_ROLE', address, metadataUri);
          await grantTx.wait();
        } else {
          // Grant role without metadata
          const grantTx = await this.contractService.grantRole('ADMIN_HEAD_ROLE', address);
          await grantTx.wait();
        }
      }
      
      // Assign the admin head to the selected area
      if (areaId) {
        const assignTx = await this.contractService.assignAreaAdminHead(areaId, address);
        await assignTx.wait();
      }
      
      this.successMessage = 'Successfully assigned Admin Head role and area';
      this.assignRoleForm.reset();
      
      // Reload data to reflect changes
      await this.loadData();
      
      this.processingAction = false;
    } catch (error: any) {
      console.error('Error assigning admin head:', error);
      this.error = error.message || 'Failed to assign admin head. Please try again.';
      this.processingAction = false;
    }
  }
  
  async approveRoleRequest(request: RoleRequest): Promise<void> {
    if (!confirm(`Are you sure you want to approve the Admin Head role request for ${request.address}?`)) {
      return;
    }
    
    try {
      this.processingAction = true;
      this.error = null;
      this.successMessage = null;
      
      // Approve the role request
      const tx = await this.contractService.approveRoleRequest(request.id);
      await tx.wait();
      
      this.successMessage = `Successfully approved Admin Head role request for ${this.formatAddress(request.address)}`;
      
      // Reload data to reflect changes
      await this.loadData();
      
      this.processingAction = false;
    } catch (error: any) {
      console.error('Error approving role request:', error);
      this.error = error.message || 'Failed to approve role request. Please try again.';
      this.processingAction = false;
    }
  }
  
  async rejectRoleRequest(request: RoleRequest): Promise<void> {
    if (!confirm(`Are you sure you want to reject the Admin Head role request for ${request.address}?`)) {
      return;
    }
    
    try {
      this.processingAction = true;
      this.error = null;
      this.successMessage = null;
      
      // Reject the role request
      const tx = await this.contractService.rejectRoleRequest(request.id);
      await tx.wait();
      
      this.successMessage = `Successfully rejected Admin Head role request for ${this.formatAddress(request.address)}`;
      
      // Reload data to reflect changes
      await this.loadData();
      
      this.processingAction = false;
    } catch (error: any) {
      console.error('Error rejecting role request:', error);
      this.error = error.message || 'Failed to reject role request. Please try again.';
      this.processingAction = false;
    }
  }
  
  async revokeAdminHeadRole(adminHead: AdminHead): Promise<void> {
    if (!confirm(`Are you sure you want to revoke the Admin Head role from ${adminHead.address}? This will also remove them from any assigned area.`)) {
      return;
    }
    
    try {
      this.processingAction = true;
      this.error = null;
      this.successMessage = null;
      
      // If assigned to an area, remove from area first
      if (adminHead.areaId) {
        const unassignTx = await this.contractService.assignAreaAdminHead(
          adminHead.areaId,
          '0x0000000000000000000000000000000000000000'
        );
        await unassignTx.wait();
      }
      
      // Revoke the role
      const tx = await this.contractService.revokeRole('ADMIN_HEAD_ROLE', adminHead.address);
      await tx.wait();
      
      this.successMessage = `Successfully revoked Admin Head role from ${this.formatAddress(adminHead.address)}`;
      this.selectedAdminHead = null;
      
      // Reload data to reflect changes
      await this.loadData();
      
      this.processingAction = false;
    } catch (error: any) {
      console.error('Error revoking admin head role:', error);
      this.error = error.message || 'Failed to revoke admin head role. Please try again.';
      this.processingAction = false;
    }
  }
  
  async assignAreaToAdminHead(adminHead: AdminHead, areaId: string): Promise<void> {
    if (!confirm(`Are you sure you want to assign Area ${areaId} to this Admin Head?`)) {
      return;
    }
    
    try {
      this.processingAction = true;
      this.error = null;
      this.successMessage = null;
      
      // Check if area already has an admin head
      const area = this.areas.find(a => a.id === areaId);
      if (area && area.adminHead !== '0x0000000000000000000000000000000000000000') {
        if (!confirm(`This area already has an Admin Head assigned. Do you want to replace them?`)) {
          this.processingAction = false;
          return;
        }
      }
      
      // Assign the admin head to the area
      const tx = await this.contractService.assignAreaAdminHead(areaId, adminHead.address);
      await tx.wait();
      
      this.successMessage = `Successfully assigned Admin Head to Area ${areaId}`;
      
      // Reload data to reflect changes
      await this.loadData();
      
      // Update the selected admin head with new data
      const updatedAdminHead = this.adminHeads.find(a => a.address === adminHead.address);
      this.selectedAdminHead = updatedAdminHead || null;
      
      this.processingAction = false;
    } catch (error: any) {
      console.error('Error assigning area to admin head:', error);
      this.error = error.message || 'Failed to assign area. Please try again.';
      this.processingAction = false;
    }
  }
  
  async removeAreaFromAdminHead(adminHead: AdminHead): Promise<void> {
    if (!adminHead.areaId) {
      return;
    }
    
    if (!confirm(`Are you sure you want to unassign ${adminHead.name || adminHead.address} from Area ${adminHead.areaId}?`)) {
      return;
    }
    
    try {
      this.processingAction = true;
      this.error = null;
      this.successMessage = null;
      
      // Remove the admin head by setting it to the zero address
      const tx = await this.contractService.assignAreaAdminHead(
        adminHead.areaId,
        '0x0000000000000000000000000000000000000000'
      );
      await tx.wait();
      
      this.successMessage = `Successfully unassigned Admin Head from Area ${adminHead.areaId}`;
      
      // Reload data to reflect changes
      await this.loadData();
      
      // Update the selected admin head with new data
      const updatedAdminHead = this.adminHeads.find(a => a.address === adminHead.address);
      this.selectedAdminHead = updatedAdminHead || null;
      
      this.processingAction = false;
    } catch (error: any) {
      console.error('Error removing area from admin head:', error);
      this.error = error.message || 'Failed to remove area assignment. Please try again.';
      this.processingAction = false;
    }
  }
  
  getUnassignedAreas(): any[] {
    // Filter areas that don't have an admin head or are assigned to the selected admin head
    return this.areas.filter(area => 
      area.adminHead === '0x0000000000000000000000000000000000000000' || 
      (this.selectedAdminHead && area.adminHead.toLowerCase() === this.selectedAdminHead.address.toLowerCase())
    );
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
  
  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }
}
