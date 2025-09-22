import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRole } from '../../../../core/models/role.model';

@Component({
  selector: 'app-edit-grievance',
  templateUrl: './edit-grievance.component.html',
  styleUrls: ['./edit-grievance.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule
  ]
})
export class EditGrievanceComponent implements OnInit {
  // View state variables
  loading = true;
  loadingAction = false;
  error: string | null = null;
  success: string | null = null;
  
  // Data containers
  grievanceId: string | null = null;
  areaId: string | null = null;
  userAddress: string | null = null;
  grievance: any = null;
  grievances: any[] = [];
  projectManagers: Array<{ address: string; name?: string }> = [];
  
  // Detail view content
  grievanceTitle: string = '';
  grievanceDescription: string = '';
  actionForm: FormGroup;
  
  // Filters for list view
  statusFilter: string = 'all';
  sortBy: string = 'newest';
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contractService: ContractService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.actionForm = this.fb.group({
      action: ['', Validators.required],
      feedback: ['', [Validators.required, Validators.minLength(10)]],
      projectManagerAddress: [''],
      priorityLevel: [1, [Validators.required, Validators.min(1), Validators.max(5)]]
    });
  }

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        
        // Get the grievance ID from the route parameter if it exists
        this.route.paramMap.subscribe(params => {
          const id = params.get('id');
          if (id) {
            this.grievanceId = id;
            this.loadGrievanceDetails(id);
          } else {
            this.loadAdminAreaId();
          }
        });
      }
    });
  }

  async loadAdminAreaId(): Promise<void> {
    try {
      this.loading = true;
      // Get area ID managed by this admin
      this.areaId = await this.contractService.getAdminAreaId(this.userAddress);
      
      if (!this.areaId) {
        this.error = 'You are not assigned to any area. Please contact the system administrator.';
        this.loading = false;
        return;
      }
      
      // Load all grievances for this area
      await this.loadAllGrievances();
      // Load available project managers for this area
      await this.loadProjectManagers();
      this.loading = false;
    } catch (error: any) {
      console.error('Error loading admin area ID:', error);
      this.error = error.message || 'Failed to load grievance data. Please try again.';
      this.loading = false;
    }
  }

  async loadAllGrievances(): Promise<void> {
    if (!this.areaId) return;
    
    try {
      // Get all grievances for this area
      const grievanceIds = await this.contractService.getGrievancesByArea(this.areaId);
      
      this.grievances = [];
      
      for (const id of grievanceIds) {
        const grievance = await this.contractService.getGrievance(id);
        if (grievance) {
          // Prefer already-resolved text from service; fallback to IPFS; fallback to CID
          let title = grievance.titleText;
          try {
            if (!title && grievance.titleHash) {
              title = await this.contractService.getIPFSContent(grievance.titleHash);
            }
          } catch {}
          title = title || grievance.title || 'Unknown Grievance';

          this.grievances.push({
            id: grievance.id,
            title,
            status: grievance.status,
            citizenAddress: grievance.citizenAddress || grievance.citizen,
            severityLevel: grievance.severityLevel,
            createdAt: new Date(grievance.createdAt * 1000),
            lastUpdated: new Date(grievance.lastUpdated * 1000),
            area: grievance.area
          });
        }
      }
      
      // Sort by default
      this.sortGrievances();
    } catch (error: any) {
      console.error('Error loading grievances:', error);
      this.error = error.message || 'Failed to load grievances. Please try again.';
    }
  }

  async loadGrievanceDetails(id: string): Promise<void> {
    try {
      this.loading = true;
      
      // Get grievance details from contract
      const grievance = await this.contractService.getGrievance(id);
      
      if (!grievance) {
        this.error = `Grievance #${id} not found.`;
        this.loading = false;
        return;
      }
      
      // Use resolved fields first, then IPFS, then CID fallbacks
      let title = grievance.titleText;
      let description = grievance.descriptionText;
      try {
        if (!title && grievance.titleHash) title = await this.contractService.getIPFSContent(grievance.titleHash);
      } catch {}
      try {
        if (!description && grievance.descriptionHash) description = await this.contractService.getIPFSContent(grievance.descriptionHash);
      } catch {}
      this.grievance = {
        ...grievance,
        title: title || grievance.title || 'Unknown Grievance',
        description: description || grievance.description || 'No description available.',
        createdAt: new Date(grievance.createdAt * 1000),
        lastUpdated: new Date(grievance.lastUpdated * 1000)
      };
      this.grievanceTitle = this.grievance.title || '';
      this.grievanceDescription = this.grievance.description || '';
      // Determine areaId for this admin head and load managers for dropdown
      if (!this.areaId && this.userAddress) {
        this.areaId = await this.contractService.getAdminAreaId(this.userAddress);
      }
      if (this.areaId) {
        await this.loadProjectManagers();
        // If there's only one PM, preselect
        if (this.projectManagers.length === 1) {
          this.actionForm.get('projectManagerAddress')?.setValue(this.projectManagers[0].address);
        }
      }
      
      // Set form values based on current status
      if (grievance.status === 'VALIDATED') {
        // For validated grievances, admin can either escalate to project or reject
        this.actionForm.get('action')?.setValue('escalate_to_project');
      } else {
        this.actionForm.get('action')?.setValue('');
      }
      
      this.error = null;
      this.loading = false;
    } catch (error: any) {
      console.error('Error loading grievance details:', error);
      this.error = error.message || `Failed to load grievance #${id}. Please try again.`;
      this.loading = false;
    }
  }

  changeActionType(event: any): void {
    const action = event.target.value;
    
    if (action === 'escalate_to_project') {
      // Enable project manager field and priority
      this.actionForm.get('projectManagerAddress')?.setValidators([Validators.required]);
      this.actionForm.get('priorityLevel')?.setValidators([Validators.required, Validators.min(1), Validators.max(5)]);
      // If not loaded yet, try to load managers for dropdown
      if (this.projectManagers.length === 0 && this.areaId) {
        this.loadProjectManagers();
      }
      // Auto-select sole manager
      if (this.projectManagers.length === 1) {
        this.actionForm.get('projectManagerAddress')?.setValue(this.projectManagers[0].address);
      }
    } else {
      // Disable project manager field for other actions
      this.actionForm.get('projectManagerAddress')?.clearValidators();
      this.actionForm.get('priorityLevel')?.clearValidators();
    }
    
    this.actionForm.get('projectManagerAddress')?.updateValueAndValidity();
    this.actionForm.get('priorityLevel')?.updateValueAndValidity();
  }

  async submitAction(): Promise<void> {
    if (this.actionForm.invalid) {
      return;
    }
    
    const action = this.actionForm.value.action;
    const feedback = this.actionForm.value.feedback;
    
    try {
      this.loadingAction = true;
      this.success = null;
      this.error = null;
      
      switch (action) {
        case 'escalate_to_project':
          await this.escalateToProject(
            this.actionForm.value.projectManagerAddress,
            this.actionForm.value.priorityLevel,
            feedback
          );
          break;
          
        case 'reject':
          await this.rejectGrievance(feedback);
          break;
          
        default:
          throw new Error('Invalid action selected');
      }
      
      // Reload grievance details after action
      await this.loadGrievanceDetails(this.grievanceId!);
      
      this.success = 'Grievance successfully updated!';
      this.actionForm.reset();
    } catch (error: any) {
      console.error('Error processing grievance action:', error);
      this.error = error.message || 'Failed to process grievance action. Please try again.';
    } finally {
      this.loadingAction = false;
    }
  }

  async escalateToProject(projectManagerAddress: string, priorityLevel: number, feedback: string): Promise<void> {
    if (!this.grievanceId) return;
    
    // Verify the project manager address has the correct role
    const hasRole = await this.contractService.hasRole(UserRole.PROJECT_MANAGER_ROLE, projectManagerAddress);
    
    if (!hasRole) {
      throw new Error('The specified address does not have the Project Manager role.');
    }
    
    // Create IPFS record for the feedback
    const feedbackIpfsHash = await this.contractService.uploadToIPFS(feedback);
    
    // Call the contract to escalate grievance to project
    await this.contractService.escalateGrievanceToProject(
      this.grievanceId,
      `Project from Grievance #${this.grievanceId}`,  // Project name
      feedback || `Project created from Grievance #${this.grievanceId}`,  // Project description
      "0.01",  // Minimal non-zero budget in ETH to satisfy contract
      "0",  // Initial funding in ETH
      projectManagerAddress  // Project manager address
    );
  }

  private async loadProjectManagers(): Promise<void> {
    try {
      if (!this.areaId) return;
      this.projectManagers = await this.contractService.getRoleHoldersByArea(this.areaId, UserRole.PROJECT_MANAGER_ROLE);
    } catch (e) {
      console.warn('Failed to load project managers', e);
      this.projectManagers = [];
    }
  }

  async rejectGrievance(feedback: string): Promise<void> {
    if (!this.grievanceId) return;
    
    // Create IPFS record for the feedback
    const feedbackIpfsHash = await this.contractService.uploadToIPFS(feedback);
    
    // Call the contract to reject grievance
    await this.contractService.rejectGrievance(this.grievanceId, feedbackIpfsHash);
  }

  filterGrievances(status: string): void {
    this.statusFilter = status;
    // No need to call backend again, just filter the already loaded grievances
  }

  sortGrievances(option: string = this.sortBy): void {
    this.sortBy = option;
    
    switch (option) {
      case 'newest':
        this.grievances.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
        
      case 'oldest':
        this.grievances.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
        
      case 'severity_high':
        this.grievances.sort((a, b) => b.severityLevel - a.severityLevel);
        break;
        
      case 'severity_low':
        this.grievances.sort((a, b) => a.severityLevel - b.severityLevel);
        break;
        
      case 'recently_updated':
        this.grievances.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
        break;
    }
  }

  get filteredGrievances(): any[] {
    if (this.statusFilter === 'all') {
      return this.grievances;
    }
    
    return this.grievances.filter(g => g.status.toLowerCase() === this.statusFilter.toLowerCase());
  }

  navigateToGrievance(id: string): void {
    this.router.navigate(['/admin-head/grievances', id]);
  }

  navigateBack(): void {
    if (this.grievanceId) {
      this.router.navigate(['/admin-head/grievances']);
    } else {
      this.router.navigate(['/admin-head']);
    }
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
