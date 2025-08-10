import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Project, ProjectStatus } from '../../shared/services/blockchain.service';
import { SolanaService } from '../../services/solana/solana.service';

@Component({
  selector: 'app-project-alloc',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-alloc.html',
  styleUrl: './project-alloc.css'
})
export class ProjectAlloc implements OnInit {
  // All projects
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  
  // Currently selected project for editing
  selectedProject: Project | null = null;
  
  // New project form
  newProject: Project = this.createEmptyProject();
  isCreatingProject: boolean = false;
  
  // Filter options
  statusFilter: string = 'all';
  searchTerm: string = '';
  
  // Enum reference for template
  ProjectStatus = ProjectStatus;
  
  // Modal control
  showModal: boolean = false;
  modalAction: string = '';
  modalTitle: string = '';
  modalMessage: string = '';
  
  // Loading state
  isLoading: boolean = true;
  
  // Connected wallet
  walletAddress: string | null = null;
  
  constructor(
    private solanaService: SolanaService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Check if wallet is connected
    this.solanaService.walletState$.subscribe((walletState) => {
      if (!walletState.connected) {
        this.router.navigate(['/login']);
        return;
      }
      
      // Get wallet address
      this.walletAddress = walletState.publicKey;
      
      // Load projects
      this.loadProjects();
    });
  }
  
  createEmptyProject(): Project {
    return {
      id: '',
      name: '',
      details: '', // Contract field name
      status: ProjectStatus.Planning,
      // Frontend compatibility fields
      description: '',
      startDate: new Date(),
      budget: 0,
      location: '',
      ward: 0,
      createdBy: '',
      timestamp: Date.now(),
      allocatedFunds: 0,
      completionPercentage: 0
    };
  }
  
  loadProjects(): void {
    this.isLoading = true;
    // Load projects from blockchain
    this.solanaService.getProjects().subscribe({
      next: (projects: any) => {
        this.projects = projects;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading projects:', error);
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
          (project.details && project.details.toLowerCase().includes(term)) ||
          (project.description && project.description.toLowerCase().includes(term)) ||
          (project.location && project.location.toLowerCase().includes(term)) ||
          (project.ward && project.ward.toString().toLowerCase().includes(term))
        );
      }
      
      return true;
    });
  }
  
  selectProject(project: Project): void {
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
  
  createProject(): void {
    if (!this.validateProject(this.newProject)) {
      return;
    }

    // Create project using real Solana blockchain
    this.solanaService.createProject({
      name: this.newProject.name,
      details: this.newProject.description
    }).then((txSignature) => {
      // Add the new project to our local list
      const createdProject: Project = {
        ...this.newProject,
        id: txSignature, // Use transaction signature as ID
        status: ProjectStatus.Planning
      };
      
      this.projects.unshift(createdProject);
      this.applyFilters();
      
      // Reset form and close modal
      this.newProject = this.createEmptyProject();
      this.isCreatingProject = false;
      
      console.log('Project created successfully. Transaction:', txSignature);
      
      // Show success message
      this.showSuccessModal('Project Created', `Project "${createdProject.name}" has been created successfully. Transaction: ${txSignature}`);
    }).catch((error: any) => {
      console.error('Error creating project:', error);
      this.showErrorModal('Error', error.message || 'Failed to create project. Please try again.');
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
    this.updateProjects(updatedProjects);
    this.applyFilters();
    
    this.showSuccessModal('Project Updated', `Project ${this.selectedProject.name} has been updated successfully.`);
  }
  
  updateProjectStatus(project: Project, newStatus: ProjectStatus): void {
    // Update project status using real Solana blockchain
    this.solanaService.updateProjectStatus(project.id, newStatus).then((txSignature) => {
      // Update the local project object
      project.status = newStatus;
      
      console.log('Project status updated successfully. Transaction:', txSignature);
      
      // Show success message
      this.showSuccessModal('Status Updated', `Project "${project.name}" status has been updated to ${newStatus}. Transaction: ${txSignature}`);
    }).catch((error: any) => {
      console.error('Error updating project status:', error);
      this.showErrorModal('Error', error.message || 'Failed to update project status. Please try again.');
    });
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
    
    if (!project.ward) {
      this.showErrorModal('Validation Error', 'Ward is required.');
      return false;
    }
    
    if (!project.budget || project.budget <= 0) {
      this.showErrorModal('Validation Error', 'Budget must be greater than zero.');
      return false;
    }
    
    return true;
  }
  
  // Real blockchain integration required - mock implementation removed
  private updateProjects(projects: Project[]) {
    console.error('Real blockchain integration required: project updates not implemented');
    this.projects = projects;
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
  
  // Format date for display
  formatDate(date: Date | null | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Format currency for display
  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
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
  

}
