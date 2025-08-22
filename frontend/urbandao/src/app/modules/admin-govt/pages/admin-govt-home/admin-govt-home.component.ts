import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ContractService } from '../../../../core/services/contract.service';

interface AreaSummary {
  id: string;
  name: string;
  citizenCount: number;
  adminHeadAddress: string;
  adminHeadName?: string;
}

interface SystemStat {
  label: string;
  value: string | number;
  icon: string;
  change?: number;
}

@Component({
  selector: 'app-admin-govt-home',
  templateUrl: './admin-govt-home.component.html',
  styleUrls: ['./admin-govt-home.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ]
})
export class AdminGovtHomeComponent implements OnInit {
  // View state
  loading = true;
  error: string | null = null;
  
  // Data containers
  areas: AreaSummary[] = [];
  systemStats: SystemStat[] = [];
  recentActivities: any[] = [];
  
  // Computed properties
  get assignedAdminHeadsCount(): number {
    return this.areas.filter(a => a.adminHeadAddress !== '0x0000000000000000000000000000000000000000').length;
  }
  
  get unassignedAreasCount(): number {
    return this.areas.filter(a => a.adminHeadAddress === '0x0000000000000000000000000000000000000000').length;
  }
  
  constructor(
    private router: Router,
    private contractService: ContractService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    try {
      this.loading = true;
      
      // Get areas managed by the system
      await this.loadAreas();
      
      // Get system statistics
      await this.loadSystemStats();
      
      // Get recent activities
      await this.loadRecentActivities();
      
      this.loading = false;
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      this.error = error.message || 'Failed to load dashboard data. Please try again.';
      this.loading = false;
    }
  }

  async loadAreas(): Promise<void> {
    try {
      // Get all areas from contract
      const areaIds = await this.contractService.getAllAreaIds();
      
      this.areas = [];
      
      for (const areaId of areaIds) {
        // Get area details
        const area = await this.contractService.getAreaDetails(areaId);
        
        // Get citizen count for this area
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
          citizenCount,
          adminHeadAddress: area.adminHead || '0x0000000000000000000000000000000000000000',
          adminHeadName
        });
      }
      
      // Sort by area ID
      this.areas.sort((a, b) => Number(a.id) - Number(b.id));
    } catch (error: any) {
      console.error('Error loading areas:', error);
      throw error;
    }
  }

  async loadSystemStats(): Promise<void> {
    try {
      // Get total citizen count
      const totalCitizens = await this.contractService.getTotalCitizenCount();
      
      // Get total projects count
      const totalProjects = await this.contractService.getTotalProjectsCount();
      
      // Get total grievances count
      const totalGrievances = await this.contractService.getTotalGrievancesCount();
      
      // Get total tax collected (in ETH)
      const totalTaxWei = await this.contractService.getTotalTaxCollected();
      const totalTaxEth = this.contractService.weiToEth(totalTaxWei);
      
      this.systemStats = [
        {
          label: 'Total Citizens',
          value: totalCitizens,
          icon: 'fa-users',
          change: 0
        },
        {
          label: 'Total Areas',
          value: this.areas.length,
          icon: 'fa-map-marker-alt',
          change: 0
        },
        {
          label: 'Projects',
          value: totalProjects,
          icon: 'fa-project-diagram',
          change: 5
        },
        {
          label: 'Grievances',
          value: totalGrievances,
          icon: 'fa-exclamation-circle',
          change: 12
        },
        {
          label: 'Tax Collected',
          value: `${parseFloat(totalTaxEth).toFixed(2)} ETH`,
          icon: 'fa-coins',
          change: 3.2
        }
      ];
    } catch (error: any) {
      console.error('Error loading system stats:', error);
      throw error;
    }
  }

  async loadRecentActivities(): Promise<void> {
    try {
      // Get recent events from various contracts
      const recentEvents = await this.contractService.getRecentSystemEvents();
      
      this.recentActivities = recentEvents.map(event => {
        // Format the event data for display
        return {
          id: event.id,
          type: event.eventType,
          address: event.address,
          timestamp: event.timestamp,
          description: event.description || this.formatEventDescription(event),
          data: event.data || {}
        };
      });
      
      // Sort by most recent
      this.recentActivities.sort((a, b) => b.timestamp - a.timestamp);
      
      // Limit to the most recent 10 activities
      this.recentActivities = this.recentActivities.slice(0, 10);
    } catch (error: any) {
      console.error('Error loading recent activities:', error);
      // Don't throw here as this is not critical data
      this.recentActivities = [];
    }
  }

  formatEventDescription(event: any): string {
    // Format event description based on event type
    switch (event.eventType) {
      case 'AreaCreated':
        return `New area created with ID ${event.data.areaId}`;
      case 'AdminHeadAssigned':
        return `Admin Head assigned to area ${event.data.areaId}`;
      case 'RoleAssigned':
        return `${this.formatRole(event.data.role)} role assigned to ${this.formatAddress(event.data.account)}`;
      case 'ProjectCreated':
        return `New project created in area ${event.data.areaId}`;
      case 'GrievanceFiled':
        return `New grievance filed in area ${event.data.areaId}`;
      default:
        return `${event.eventType} event occurred`;
    }
  }

  formatRole(role: string): string {
    // Format role constant to readable string
    const roleMap: { [key: string]: string } = {
      'CITIZEN_ROLE': 'Citizen',
      'VALIDATOR_ROLE': 'Validator',
      'TAX_COLLECTOR_ROLE': 'Tax Collector',
      'PROJECT_MANAGER_ROLE': 'Project Manager',
      'ADMIN_HEAD_ROLE': 'Admin Head',
      'ADMIN_GOVT_ROLE': 'Admin Government',
      'TX_PAYER_ROLE': 'Transaction Payer',
      'OWNER_ROLE': 'Owner'
    };
    
    return roleMap[role] || role;
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
  
  navigateToAreas(): void {
    this.router.navigate(['/admin-govt/areas']);
  }
  
  navigateToAdminHeads(): void {
    this.router.navigate(['/admin-govt/admin-heads']);
  }
}
