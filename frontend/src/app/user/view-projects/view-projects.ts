import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SolanaService } from '../../services/solana/solana.service';
import { Project } from '../../shared/services/blockchain.service';

@Component({
  selector: 'app-view-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-projects.html',
  styleUrl: './view-projects.css'
})
export class ViewProjects implements OnInit {
  isLoading = true;
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  selectedProject: Project | null = null;
  showProjectDetails = false;
  
  // Filter options
  statusFilter: string = 'all';
  wardFilter: string = 'all';
  searchQuery: string = '';
  
  // Wards for filter dropdown
  wards: string[] = [];
  
  constructor(
    private solanaService: SolanaService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Check wallet connection
    this.solanaService.walletState$.subscribe((walletState) => {
      if (!walletState.connected) {
        this.router.navigate(['/login']);
        return;
      }
      this.loadProjects();
    });
    
    // Load wards (hardcoded for now)
    this.wards = [
      'Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5',
      'Ward 6', 'Ward 7', 'Ward 8', 'Ward 9', 'Ward 10'
    ];
  }
  
  loadProjects(): void {
    this.isLoading = true;
    // Load projects from blockchain
    this.solanaService.getProjects().subscribe({
      next: (projects: any) => {
        this.projects = projects;
        this.applyFilters(); // Apply any active filters
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
      // Status filter
      if (this.statusFilter !== 'all' && project.status !== this.statusFilter) {
        return false;
      }
      
      // Ward filter
      if (this.wardFilter !== 'all' && project.ward && project.ward.toString() !== this.wardFilter) {
        return false;
      }
      
      // Search query (case insensitive)
      if (this.searchQuery.trim() !== '') {
        const query = this.searchQuery.toLowerCase();
        return (
          project.name.toLowerCase().includes(query) ||
          (project.details && project.details.toLowerCase().includes(query)) ||
          (project.description && project.description.toLowerCase().includes(query)) ||
          (project.location && project.location.toLowerCase().includes(query))
        );
      }
      
      return true;
    });
  }
  
  viewProjectDetails(project: Project): void {
    this.selectedProject = project;
    this.showProjectDetails = true;
  }
  
  closeProjectDetails(): void {
    this.showProjectDetails = false;
    this.selectedProject = null;
  }
  
  resetFilters(): void {
    this.statusFilter = 'all';
    this.wardFilter = 'all';
    this.searchQuery = '';
    this.applyFilters();
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
  
  // Format date for display
  formatDate(date: Date | null | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  // Helper method to get current date
  getCurrentDate(): Date {
    return new Date();
  }
  
  // Helper method to calculate a date 30 days after project start
  getProgressUpdateDate(startDate: Date | undefined): Date {
    if (!startDate) return new Date();
    const date = new Date(startDate);
    date.setDate(date.getDate() + 30);
    return date;
  }
  
  // Calculate project progress percentage
  calculateProgress(project: Project): number {
    if (project.status === 'Done') return 100;
    if (project.status === 'Planning') return 10;
    
    // For ongoing projects, calculate based on start date and estimated end date
    if (project.endDate && project.startDate) {
      const total = project.endDate.getTime() - project.startDate.getTime();
      const elapsed = Date.now() - project.startDate.getTime();
      const progress = Math.min(Math.max(Math.floor((elapsed / total) * 100), 10), 90);
      return progress;
    }
    
    return 50; // Default for ongoing projects without end date
  }
  
  // Get status class for styling
  getStatusClass(status: string): string {
    switch (status) {
      case 'Planning': return 'status-planning';
      case 'Ongoing': return 'status-ongoing';
      case 'Done': return 'status-done';
      default: return '';
    }
  }
}
