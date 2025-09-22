import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserRole } from '../../../../core/models/role.model';

interface ProjectSummary {
  id: string;
  title: string;
  managerAddress: string;
  budget: string;
  status: string;
  completedMilestones: number;
  totalMilestones: number;
  description?: string;
}

@Component({
  selector: 'app-project-alloc',
  templateUrl: './project-alloc.component.html',
  styleUrls: ['./project-alloc.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class ProjectAllocComponent implements OnInit {
  // View state variables
  loading = true;
  loadingAction = false;
  error: string | null = null;
  success: string | null = null;
  
  // Data containers
  areaId: string | null = null;
  userAddress: string | null = null;
  projects: ProjectSummary[] = [];
  projectManagers: any[] = [];
  selectedProject: ProjectSummary | null = null;
  acceptedGrievances: any[] = [];
  
  // Form
  projectForm: FormGroup;
  
  // Filter options
  statusFilter: string = 'all';
  sortBy: string = 'newest';
  
  constructor(
    private router: Router,
    private contractService: ContractService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.projectForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      budget: ['', [Validators.required, Validators.min(0.01)]],
      totalMilestones: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
      managerAddress: ['', Validators.required],
      initialFunding: [0, [Validators.min(0)]]
    });
  }

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
      
      // Load project managers
      await this.loadProjectManagers();
      
      // Load projects
      await this.loadProjects();

      // Load accepted grievances that are not yet linked to a project
      await this.loadAcceptedGrievances();
      
      this.error = null;
      this.loading = false;
    } catch (error: any) {
      console.error('Error loading admin data:', error);
      this.error = error.message || 'Failed to load project data. Please try again.';
      this.loading = false;
    }
  }

  async loadProjects(): Promise<void> {
    if (!this.areaId) return;
    
    try {
      // Get all projects for this area
      const projectIds = await this.contractService.getProjectsByArea(this.areaId);
      
      this.projects = [];
      
      for (const id of projectIds) {
        const project = await this.contractService.getProject(Number(id));
        
        if (project) {
          // Get IPFS content for title and description
          const title = await this.contractService.getIPFSContent(project.titleHash);
          const description = await this.contractService.getIPFSContent(project.descriptionHash);
          
          // Convert wei to ETH for budget
          const budget = this.contractService.weiToEth(project.fundingGoal);

          // Map numeric status to UI-friendly text
          let statusText = 'Unknown';
          switch (Number(project.status)) {
            case 0: statusText = 'Proposed'; break;
            case 1: statusText = 'Approved'; break;
            case 2: statusText = 'Active'; break;
            case 3: statusText = 'Completed'; break;
            case 4: statusText = 'Cancelled'; break;
          }
          
          this.projects.push({
            id: String(project.id),
            title: title || 'Unnamed Project',
            managerAddress: project.manager,
            budget: budget,
            status: statusText,
            completedMilestones: Math.max(0, (project.currentMilestone || 1) - 1),
            totalMilestones: project.milestoneCount || (project.currentMilestone || 1),
            description: description
          });
        }
      }
      
      // Sort projects
      this.sortProjects();
    } catch (error: any) {
      console.error('Error loading projects:', error);
      this.error = error.message || 'Failed to load projects. Please try again.';
    }
  }

  async loadAcceptedGrievances(): Promise<void> {
    try {
      if (!this.areaId) return;
      const ids = await this.contractService.getGrievancesByStatusAndArea('accepted', this.areaId);
      const entries: any[] = [];
      for (const gid of ids) {
        try {
          const g = await this.contractService.getGrievance(String(gid));
          if (!g) continue;
          const title = g.titleText || (g.titleHash ? await this.contractService.getIPFSContent(g.titleHash) : '') || g.title || `Grievance #${gid}`;
          const linkedProjectId = Number(g.linkedProjectId || 0);
          entries.push({ id: String(gid), title, linkedProjectId });
        } catch {}
      }
      // Only those not linked to a project
      this.acceptedGrievances = entries.filter(e => !e.linkedProjectId || Number(e.linkedProjectId) === 0);
    } catch (e) {
      console.warn('Failed to load accepted grievances for escalation', e);
      this.acceptedGrievances = [];
    }
  }

  async loadProjectManagers(): Promise<void> {
    if (!this.areaId) return;
    
    try {
      // Get all project managers for this area
      this.projectManagers = await this.contractService.getRoleHoldersByArea(this.areaId, UserRole.PROJECT_MANAGER_ROLE);
    } catch (error: any) {
      console.error('Error loading project managers:', error);
    }
  }

  showCreateProjectForm(): void {
    this.selectedProject = null;
    this.projectForm.reset({
      totalMilestones: 1,
      initialFunding: 0
    });
    // Mark as dirty so the template's *ngIf on projectForm.dirty shows the form
    this.projectForm.markAsDirty();
    
    // If there's only one project manager, select them by default
    if (this.projectManagers.length === 1) {
      this.projectForm.get('managerAddress')?.setValue(this.projectManagers[0].address);
    }
  }

  startProjectFromGrievance(grievance: any): void {
    this.showCreateProjectForm();
    // Prefill title and description
    this.projectForm.get('title')?.setValue(grievance.title || `Project from Grievance #${grievance.id}`);
    this.projectForm.get('description')?.setValue(`Project created from accepted grievance #${grievance.id}`);
  }

  showProjectDetails(project: ProjectSummary): void {
    this.selectedProject = project;
  }

  filterProjects(status: string): void {
    this.statusFilter = status;
    // No need to call backend again, just filter the already loaded projects
  }

  sortProjects(option: string = this.sortBy): void {
    this.sortBy = option;
    
    switch (option) {
      case 'newest':
        this.projects.sort((a, b) => Number(b.id) - Number(a.id));
        break;
        
      case 'budget_high':
        this.projects.sort((a, b) => parseFloat(b.budget) - parseFloat(a.budget));
        break;
        
      case 'budget_low':
        this.projects.sort((a, b) => parseFloat(a.budget) - parseFloat(b.budget));
        break;
        
      case 'milestones':
        this.projects.sort((a, b) => {
          const aProgress = a.completedMilestones / a.totalMilestones;
          const bProgress = b.completedMilestones / b.totalMilestones;
          return bProgress - aProgress;
        });
        break;
    }
  }

  get filteredProjects(): ProjectSummary[] {
    if (this.statusFilter === 'all') {
      return this.projects;
    }
    
    return this.projects.filter(p => p.status.toLowerCase() === this.statusFilter.toLowerCase());
  }

  async submitProjectForm(): Promise<void> {
    if (this.projectForm.invalid) {
      return;
    }
    
    try {
      this.loadingAction = true;
      this.success = null;
      this.error = null;
      
      const formData = this.projectForm.value;
      
      // Verify the project manager address has the correct role
      const hasRole = await this.contractService.hasRole(UserRole.PROJECT_MANAGER_ROLE, formData.managerAddress);
      
      if (!hasRole) {
        throw new Error('The specified address does not have the Project Manager role.');
      }
      
      // Create IPFS records for title and description
      const titleIpfsHash = await this.contractService.uploadToIPFS(formData.title);
      const descriptionIpfsHash = await this.contractService.uploadToIPFS(formData.description);
      
      // Convert ETH to Wei for budget and initial funding
      const budgetInWei = this.contractService.ethToWei(formData.budget);
      const initialFundingInWei = this.contractService.ethToWei(formData.initialFunding || 0);
      
      // Call the contract to create project
      const result = await this.contractService.createProject(
        titleIpfsHash,
        descriptionIpfsHash,
        budgetInWei,
        formData.totalMilestones,
        formData.managerAddress,
        this.areaId!,
        initialFundingInWei
      );
      
      if (result) {
        this.success = 'Project created successfully!';
        this.projectForm.reset({
          totalMilestones: 1,
          initialFunding: 0
        });
        
        // Reload projects after creating a new one
        await this.loadProjects();
      }
    } catch (error: any) {
      console.error('Error creating project:', error);
      this.error = error.message || 'Failed to create project. Please try again.';
    } finally {
      this.loadingAction = false;
    }
  }

  closeDetails(): void {
    this.selectedProject = null;
  }
  
  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  getProgressPercentage(completed: number, total: number): number {
    if (total === 0) return 0;
    return (completed / total) * 100;
  }
}
