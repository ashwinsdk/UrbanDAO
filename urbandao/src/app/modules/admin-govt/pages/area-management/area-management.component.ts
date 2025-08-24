import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ContractService } from '../../../../core/services/contract.service';
import { UserRole } from '../../../../core/models/role.model';

interface Area {
  id: string;
  name: string;
  adminHead: string;
  adminHeadName?: string;
  citizenCount: number;
  createdAt: number;
}

@Component({
  selector: 'app-area-management',
  templateUrl: './area-management.component.html',
  styleUrls: ['./area-management.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule
  ]
})
export class AreaManagementComponent implements OnInit {
  // View states
  loading = true;
  creating = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Area data
  areas: Area[] = [];
  filteredAreas: Area[] = [];
  selectedArea: Area | null = null;
  
  // Forms
  createAreaForm: FormGroup;
  assignAdminForm: FormGroup;
  searchQuery = '';
  
  constructor(
    private formBuilder: FormBuilder,
    private contractService: ContractService,
    private authService: AuthService
  ) {
    this.createAreaForm = this.formBuilder.group({
      areaName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]]
    });
    
    this.assignAdminForm = this.formBuilder.group({
      adminAddress: ['', [Validators.required, Validators.pattern('^0x[a-fA-F0-9]{40}$')]]
    });
  }

  ngOnInit(): void {
    this.loadAreas();
  }
  
  async loadAreas(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      
      // Get all areas from the contract
      const areaIds = await this.contractService.getAllAreaIds();
      
      this.areas = [];
      for (const areaId of areaIds) {
        // Get area details
        const area = await this.contractService.getAreaDetails(areaId);
        
        // Get citizen count
        const citizenCount = await this.contractService.getAreaCitizenCount(areaId);
        
        // Get admin head name if available
        let adminHeadName = '';
        if (area.adminHead && area.adminHead !== '0x0000000000000000000000000000000000000000') {
          try {
            const metadata = await this.contractService.getAddressMetadata(area.adminHead);
            if (metadata && metadata.name) {
              adminHeadName = metadata.name;
            }
          } catch (e) {
            console.warn('Failed to get admin head metadata:', e);
          }
        }
        
        this.areas.push({
          id: areaId,
          name: area.name || `Area ${areaId}`,
          adminHead: area.adminHead || '0x0000000000000000000000000000000000000000',
          adminHeadName,
          citizenCount,
          createdAt: area.createdAt || 0
        });
      }
      
      // Sort areas by ID
      this.areas.sort((a, b) => Number(a.id) - Number(b.id));
      this.filteredAreas = [...this.areas];
      
      this.loading = false;
    } catch (error: any) {
      console.error('Error loading areas:', error);
      this.error = error.message || 'Failed to load areas. Please try again.';
      this.loading = false;
    }
  }
  
  async createArea(): Promise<void> {
    if (this.createAreaForm.invalid) {
      return;
    }
    
    try {
      this.creating = true;
      this.error = null;
      this.successMessage = null;
      
      const areaName = this.createAreaForm.get('areaName')?.value;
      
      // Create the area using the contract
      const txHash = await this.contractService.createArea(areaName);
      
      if (!txHash) {
        throw new Error('Failed to create area');
      }
      
      this.successMessage = `Successfully created area: ${areaName} (Transaction: ${txHash})`;
      this.createAreaForm.reset();
      
      // Reload areas to get the newly created one
      await this.loadAreas();
      
      this.creating = false;
    } catch (error: any) {
      console.error('Error creating area:', error);
      this.error = error.message || 'Failed to create area. Please try again.';
      this.creating = false;
    }
  }
  
  selectArea(area: Area): void {
    this.selectedArea = area;
    
    // Reset the form and pre-populate with the current admin head address if it exists
    this.assignAdminForm.reset();
    if (area.adminHead && area.adminHead !== '0x0000000000000000000000000000000000000000') {
      this.assignAdminForm.patchValue({
        adminAddress: area.adminHead
      });
    }
  }
  
  async assignAdminHead(): Promise<void> {
    if (this.assignAdminForm.invalid || !this.selectedArea) {
      return;
    }
    
    try {
      this.creating = true;
      this.error = null;
      this.successMessage = null;
      
      const adminAddress = this.assignAdminForm.get('adminAddress')?.value;
      
      // Check if the address has the required role
      const hasRole = await this.contractService.hasRole(UserRole.ADMIN_HEAD_ROLE, adminAddress);
      
      if (!hasRole) {
        // Assign the ADMIN_HEAD_ROLE first
        const assignRoleTx = await this.contractService.grantRole(UserRole.ADMIN_HEAD_ROLE, adminAddress);
        await assignRoleTx.wait();
      }
      
      // Assign the admin head to the area
      const tx = await this.contractService.assignAreaAdminHead(this.selectedArea.id, adminAddress);
      await tx.wait();
      
      this.successMessage = `Successfully assigned Admin Head to area ${this.selectedArea.name}`;
      
      // Reload areas to refresh the data
      await this.loadAreas();
      
      // Update the selected area with new data
      const updatedArea = this.areas.find(a => a.id === this.selectedArea?.id) || null;
      this.selectedArea = updatedArea;
      
      this.creating = false;
    } catch (error: any) {
      console.error('Error assigning admin head:', error);
      this.error = error.message || 'Failed to assign admin head. Please try again.';
      this.creating = false;
    }
  }
  
  async removeAdminHead(): Promise<void> {
    if (!this.selectedArea || !this.selectedArea.adminHead || 
        this.selectedArea.adminHead === '0x0000000000000000000000000000000000000000') {
      return;
    }
    
    if (!confirm(`Are you sure you want to remove the Admin Head from ${this.selectedArea.name}?`)) {
      return;
    }
    
    try {
      this.creating = true;
      this.error = null;
      this.successMessage = null;
      
      // Remove the admin head by setting it to the zero address
      const tx = await this.contractService.assignAreaAdminHead(
        this.selectedArea.id, 
        '0x0000000000000000000000000000000000000000'
      );
      await tx.wait();
      
      this.successMessage = `Successfully removed Admin Head from area ${this.selectedArea.name}`;
      
      // Reload areas to refresh the data
      await this.loadAreas();
      
      // Update the selected area with new data
      const updatedArea = this.areas.find(a => a.id === this.selectedArea?.id) || null;
      this.selectedArea = updatedArea;
      
      this.creating = false;
    } catch (error: any) {
      console.error('Error removing admin head:', error);
      this.error = error.message || 'Failed to remove admin head. Please try again.';
      this.creating = false;
    }
  }
  
  filterAreas(): void {
    if (!this.searchQuery.trim()) {
      this.filteredAreas = [...this.areas];
      return;
    }
    
    const query = this.searchQuery.toLowerCase().trim();
    this.filteredAreas = this.areas.filter(area => 
      area.name.toLowerCase().includes(query) ||
      area.id.toLowerCase().includes(query) ||
      (area.adminHeadName && area.adminHeadName.toLowerCase().includes(query)) ||
      area.adminHead.toLowerCase().includes(query)
    );
  }
  
  clearSearch(): void {
    this.searchQuery = '';
    this.filterAreas();
  }
  
  clearSelectedArea(): void {
    this.selectedArea = null;
    this.assignAdminForm.reset();
  }
  
  formatAddress(address: string): string {
    if (!address || address === '0x0000000000000000000000000000000000000000') return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  formatTimestamp(timestamp: number): string {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }
}
