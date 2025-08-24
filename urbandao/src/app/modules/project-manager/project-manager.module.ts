import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Fix import path - TypeScript imports should not include the .ts extension
import { ProjectManagerRoutingModule } from './project-manager-routing.module';
import { ProjectDashboardComponent } from './pages/dashboard/project-dashboard.component';
import { ProjectFormComponent } from './pages/project-form/project-form.component';
import { ProjectDetailsComponent } from './pages/project-details/project-details.component';
import { MilestoneFormComponent } from './pages/milestone-form/milestone-form.component';
import { ProjectListComponent } from './pages/project-list/project-list.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ProjectManagerRoutingModule,
    // Add standalone components to imports
    ProjectDashboardComponent,
    ProjectFormComponent,
    ProjectDetailsComponent,
    MilestoneFormComponent,
    ProjectListComponent
  ]
})
export class ProjectManagerModule { }
