import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

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
          // Get IPFS content for title
          const title = await this.contractService.getIPFSContent(grievance.titleHash);
          
          this.grievances.push({
            id: grievance.id,
            title: title || 'Unknown Grievance',
            status: grievance.status,
            citizenAddress: grievance.citizen,
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
      
      // Get IPFS content
      const title = await this.contractService.getIPFSContent(grievance.titleHash);
      const description = await this.contractService.getIPFSContent(grievance.descriptionHash);
      
      this.grievance = {
        ...grievance,
        title: title || 'Unknown Grievance',
        description: description || 'No description available.',
        createdAt: new Date(grievance.createdAt * 1000),
        lastUpdated: new Date(grievance.lastUpdated * 1000)
      };
      
      this.grievanceTitle = title || '';
      this.grievanceDescription = description || '';
      
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
    const hasRole = await this.contractService.hasRole('PROJECT_MANAGER_ROLE', projectManagerAddress);
    
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
      "0",  // Budget in ETH
      "0",  // Initial funding in ETH
      projectManagerAddress  // Project manager address
    );
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
