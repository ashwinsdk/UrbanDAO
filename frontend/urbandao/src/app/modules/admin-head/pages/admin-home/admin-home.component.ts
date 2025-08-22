import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface AreaSummary {
  id: string;
  citizenCount: number;
  grievanceCount: number;
  taxCollectors: number;
  validators: number;
  projectManagers: number;
}

interface GrievanceSummary {
  pending: number;
  validated: number;
  rejected: number;
  resolved: number;
  total: number;
}

@Component({
  selector: 'app-admin-home',
  templateUrl: './admin-home.component.html',
  styleUrls: ['./admin-home.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ]
})
export class AdminHomeComponent implements OnInit {
  loading = true;
  error: string | null = null;
  userAddress: string | null = null;
  areaId: string | null = null;
  areaData: AreaSummary | null = null;
  grievanceSummary: GrievanceSummary = {
    pending: 0,
    validated: 0,
    rejected: 0,
    resolved: 0,
    total: 0
  };
  
  recentGrievances: any[] = [];
  pendingRoles: any[] = [];

  constructor(
    private router: Router,
    private contractService: ContractService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.loadAdminData();
      }
    });
  }

  async loadAdminData(): Promise<void> {
    try {
      this.loading = true;
      
      // Get area ID managed by this admin
      this.areaId = await this.contractService.getAdminAreaId(this.userAddress);
      
      if (!this.areaId) {
        this.error = 'You are not assigned to any area. Please contact the system administrator.';
        this.loading = false;
        return;
      }
      
      // Load area summary data
      await this.loadAreaSummary();
      
      // Load grievance summary data
      await this.loadGrievanceSummary();
      
      // Load recent grievances
      await this.loadRecentGrievances();
      
      // Load pending role assignments
      await this.loadPendingRoles();
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading admin data:', error);
      this.error = error.message || 'Failed to load admin data. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async loadAreaSummary(): Promise<void> {
    if (!this.areaId) return;
    
    try {
      // Get citizens in area
      const citizens = await this.contractService.getCitizensByArea(this.areaId);
      
      // Count role holders in this area
      const taxCollectors = await this.contractService.getRoleHoldersByArea(this.areaId, 'TAX_COLLECTOR_ROLE');
      const validators = await this.contractService.getRoleHoldersByArea(this.areaId, 'VALIDATOR_ROLE');
      const projectManagers = await this.contractService.getRoleHoldersByArea(this.areaId, 'PROJECT_MANAGER_ROLE');
      
      // Get grievance count
      const grievances = await this.contractService.getGrievancesByArea(this.areaId);
      
      this.areaData = {
        id: this.areaId,
        citizenCount: citizens.length,
        grievanceCount: grievances.length,
        taxCollectors: taxCollectors.length,
        validators: validators.length,
        projectManagers: projectManagers.length
      };
    } catch (error) {
      console.error('Error loading area summary:', error);
    }
  }

  async loadGrievanceSummary(): Promise<void> {
    if (!this.areaId) return;
    
    try {
      // Get grievances by status
      const pendingGrievances = await this.contractService.getGrievancesByStatusAndArea('PENDING', this.areaId);
      const validatedGrievances = await this.contractService.getGrievancesByStatusAndArea('VALIDATED', this.areaId);
      const rejectedGrievances = await this.contractService.getGrievancesByStatusAndArea('REJECTED', this.areaId);
      const resolvedGrievances = await this.contractService.getGrievancesByStatusAndArea('RESOLVED', this.areaId);
      
      this.grievanceSummary = {
        pending: pendingGrievances.length,
        validated: validatedGrievances.length,
        rejected: rejectedGrievances.length,
        resolved: resolvedGrievances.length,
        total: pendingGrievances.length + validatedGrievances.length + 
               rejectedGrievances.length + resolvedGrievances.length
      };
    } catch (error) {
      console.error('Error loading grievance summary:', error);
    }
  }

  async loadRecentGrievances(): Promise<void> {
    if (!this.areaId) return;
    
    try {
      // Get all grievances for this area
      const grievanceIds = await this.contractService.getGrievancesByArea(this.areaId);
      
      // Sort by ID (newer first) and take only the most recent 5
      // For string IDs, sort by string comparison or extract numeric portion if needed
      const sortedIds = grievanceIds.sort((a, b) => b.localeCompare(a)).slice(0, 5);
      
      this.recentGrievances = [];
      
      for (const id of sortedIds) {
        const grievance = await this.contractService.getGrievance(id);
        
        if (grievance) {
          // Get IPFS content
          const title = await this.contractService.getIPFSContent(grievance.titleHash);
          
          this.recentGrievances.push({
            id: grievance.id,
            title: title || 'Unknown Grievance',
            status: grievance.status,
            citizenAddress: grievance.citizen,
            severityLevel: grievance.severityLevel,
            createdAt: new Date(grievance.createdAt * 1000)
          });
        }
      }
    } catch (error) {
      console.error('Error loading recent grievances:', error);
    }
  }

  async loadPendingRoles(): Promise<void> {
    if (!this.areaId) return;
    
    try {
      // In a real implementation, this would fetch pending role assignment requests
      // from the contract or a separate database. For now, we'll simulate this.
      this.pendingRoles = await this.contractService.getPendingRoleRequests(this.areaId);
    } catch (error) {
      console.error('Error loading pending roles:', error);
    }
  }

  navigateToGrievances(): void {
    this.router.navigate(['/admin-head/grievances']);
  }

  navigateToProjects(): void {
    this.router.navigate(['/admin-head/projects']);
  }

  navigateToManageRoles(): void {
    this.router.navigate(['/admin-head/manage-roles']);
  }

  refreshData(): void {
    this.loadAdminData();
  }

  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
