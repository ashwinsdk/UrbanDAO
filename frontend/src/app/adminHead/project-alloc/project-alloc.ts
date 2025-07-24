import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserService, Project } from '../../user/user.service';
import { AdminService, AdminProject, SolanaService } from '../../shared/services';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-project-alloc',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-alloc.html',
  styleUrl: './project-alloc.css'
})
export class ProjectAlloc implements OnInit {
  // All projects
  projects: AdminProject[] = [];
  filteredProjects: AdminProject[] = [];
  
  // Currently selected project for editing
  selectedProject: AdminProject | null = null;
  
  // New project form
  newProject: AdminProject = this.createEmptyProject();
  isCreatingProject: boolean = false;
  isSubmitting: boolean = false;
  
  // Filter options
  statusFilter: string = 'all';
  searchTerm: string = '';
  
  // Modal control
  showModal: boolean = false;
  modalAction: string = '';
  modalTitle: string = '';
  modalMessage: string = '';
  
  // Loading state
  isLoading: boolean = true;
  errorMessage: string = '';
  
  // Connected wallet
  walletAddress: string | null = null;
  
  constructor(
    private userService: UserService,
    private adminService: AdminService,
    private solanaService: SolanaService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Check wallet connection first
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to access admin functions.';
      this.isLoading = false;
      return;
    }

    // Get wallet address from SolanaService (primary) or AuthService (fallback)
    this.walletAddress = this.solanaService.getPublicKey() || this.authService.getPublicKey();
    
    this.loadProjects();
  }
  
  createEmptyProject(): AdminProject {
    return {
      id: '',
      name: '',
      description: '',
      status: 'Planning',
      startDate: new Date(),
      budget: 0,
      location: '',
      ward: '',
      timestamp: new Date()
    };
  }
  
  loadProjects(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Load all projects from blockchain (Admin view)
    this.adminService.getAllProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading projects:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
    });
  }
  
  applyFilters(): void {
    this.filteredProjects = this.projects.filter(project => {
      // Apply status filter
      if (this.statusFilter !== 'all' && project.status !== this.statusFilter) {
        return false;
      }
      
      // Apply search filter
      if (this.searchTerm && this.searchTerm.trim() !== '') {
        const term = this.searchTerm.toLowerCase();
        return (
          project.id.toLowerCase().includes(term) ||
          project.name.toLowerCase().includes(term) ||
          project.description.toLowerCase().includes(term) ||
          project.location.toLowerCase().includes(term) ||
          project.ward.toLowerCase().includes(term)
        );
      }
      
      return true;
    });
  }
  
  selectProject(project: AdminProject): void {
    this.selectedProject = { ...project };
    this.isCreatingProject = false;
  }
  
  clearSelection(): void {
    this.selectedProject = null;
  }
  
  startCreateProject(): void {
    this.isCreatingProject = true;
    this.selectedProject = null;
    this.newProject = this.createEmptyProject();
  }
  
  cancelCreateProject(): void {
    this.isCreatingProject = false;
    this.newProject = this.createEmptyProject();
  }
  
  saveNewProject(): void {
    if (!this.validateProject(this.newProject)) return;
    
    // Check wallet connection before creating
    if (!this.solanaService.isWalletConnected()) {
      this.errorMessage = 'Please connect your wallet to create projects.';
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    // Create project on blockchain
    this.adminService.createProject(
      this.newProject.name,
      this.newProject.description,
      this.newProject.budget,
      this.newProject.location,
      this.newProject.ward
    ).subscribe({
      next: (createdProject) => {
        console.log('Project created successfully:', createdProject);
        
        // Add to local projects list
        this.projects = [createdProject, ...this.projects];
        this.applyFilters();
        
        this.showSuccessModal('Project Created', `Project ${createdProject.name} has been created successfully on the blockchain.`);
        this.isCreatingProject = false;
        this.newProject = this.createEmptyProject();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error creating project:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isSubmitting = false;
      }
    });
  }
  
  updateProject(): void {
    if (!this.selectedProject || !this.validateProject(this.selectedProject)) return;
    
    this.modalAction = 'updateProject';
    this.modalTitle = 'Confirm Project Update';
    this.modalMessage = `Are you sure you want to update the project ${this.selectedProject.name}?`;
    this.showModal = true;
  }
  
  confirmUpdateProject(): void {
    if (!this.selectedProject) return;
    
    // In a real app, this would call an API to update the project
    // For now, we'll simulate by updating our local list
    const updatedProjects = this.projects.map(p => 
      p.id === this.selectedProject!.id ? this.selectedProject! : p
    );
    
    this.projects = updatedProjects;
    this.projectsSubject.next(updatedProjects);
    this.applyFilters();
    
    this.showSuccessModal('Project Updated', `Project ${this.selectedProject.name} has been updated successfully.`);
  }
  
  updateProjectStatus(project: Project, status: 'Planning' | 'Ongoing' | 'Done'): void {
    const updatedProject = { ...project, status, timestamp: new Date() };
    
    // In a real app, this would call an API to update the project
    // For now, we'll simulate by updating our local list
    const updatedProjects = this.projects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    );
    
    this.projects = updatedProjects;
    this.projectsSubject.next(updatedProjects);
    this.applyFilters();
    
    if (this.selectedProject?.id === project.id) {
      this.selectedProject = updatedProject;
    }
  }
  
  validateProject(project: Project): boolean {
    if (!project.name || project.name.trim() === '') {
      this.showErrorModal('Validation Error', 'Project name is required.');
      return false;
    }
    
    if (!project.description || project.description.trim() === '') {
      this.showErrorModal('Validation Error', 'Project description is required.');
      return false;
    }
    
    if (!project.location || project.location.trim() === '') {
      this.showErrorModal('Validation Error', 'Project location is required.');
      return false;
    }
    
    if (!project.ward || project.ward.trim() === '') {
      this.showErrorModal('Validation Error', 'Ward is required.');
      return false;
    }
    
    if (project.budget <= 0) {
      this.showErrorModal('Validation Error', 'Budget must be greater than zero.');
      return false;
    }
    
    return true;
  }
  
  // Simulate a BehaviorSubject for our mock data
  private get projectsSubject() {
    return {
      next: (projects: Project[]) => {
        // In a real app with a proper service, this would update the BehaviorSubject
        this.projects = projects.map(project => ({
          ...project,
          timestamp: new Date() // Add required timestamp property for AdminProject
        } as AdminProject));
      }
    };
  }
  
  showSuccessModal(title: string, message: string): void {
    this.modalAction = 'success';
    this.modalTitle = title;
    this.modalMessage = message;
    this.showModal = true;
  }
  
  showErrorModal(title: string, message: string): void {
    this.modalAction = 'error';
    this.modalTitle = title;
    this.modalMessage = message;
    this.showModal = true;
  }
  
  closeModal(): void {
    this.showModal = false;
    if (this.modalAction === 'success') {
      this.clearSelection();
    }
  }

  private getErrorMessage(error: any): string {
    if (error?.message) {
      if (error.message.includes('Wallet not connected')) {
        return 'Please connect your wallet to access admin functions.';
      }
      if (error.message.includes('Unauthorized')) {
        return 'You are not authorized to perform this action.';
      }
      if (error.message.includes('User rejected')) {
        return 'Transaction was rejected. Please try again.';
      }
      return `Error: ${error.message}`;
    }
    return 'An unexpected error occurred. Please try again.';
  }
  
  // Format date for display
  formatDate(date: Date | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Get CSS class for status badge
  getStatusClass(status: string): string {
    switch (status) {
      case 'Planning': return 'status-planning';
      case 'Ongoing': return 'status-ongoing';
      case 'Done': return 'status-done';
      default: return 'status-default';
    }
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  // Format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}
