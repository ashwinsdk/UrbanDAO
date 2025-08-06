import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, Project } from '../user.service';
import { AuthService } from '../../auth/auth.service';

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
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.loadProjects();
    this.wards = this.userService.getWards();
  }
  
  loadProjects(): void {
    this.isLoading = true;
    this.userService.getProjects().subscribe(projects => {
      this.projects = projects;
      this.applyFilters(); // Apply any active filters
      this.isLoading = false;
    });
  }
  
  applyFilters(): void {
    this.filteredProjects = this.projects.filter(project => {
      // Status filter
      if (this.statusFilter !== 'all' && project.status !== this.statusFilter) {
        return false;
      }
      
      // Ward filter
      if (this.wardFilter !== 'all' && project.ward.toString() !== this.wardFilter) {
        return false;
      }
      
      // Search query (case insensitive)
      if (this.searchQuery.trim() !== '') {
        const query = this.searchQuery.toLowerCase();
        return (
          project.name.toLowerCase().includes(query) ||
          project.description.toLowerCase().includes(query) ||
          project.location.toLowerCase().includes(query)
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
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  }
  
  // Format date for display
  formatDate(date: Date | null): string {
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
  getProgressUpdateDate(startDate: Date): Date {
    const date = new Date(startDate);
    date.setDate(date.getDate() + 30);
    return date;
  }
  
  // Calculate project progress percentage
  calculateProgress(project: Project): number {
    if (project.status === 'Done') return 100;
    if (project.status === 'Planning') return 10;
    
    // For ongoing projects, calculate based on start date and estimated end date
    if (project.endDate) {
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
