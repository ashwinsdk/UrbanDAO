import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AdminHeadRoutingModule } from './admin-head-routing.module';
import { AdminHomeComponent } from './pages/admin-home/admin-home.component';
import { EditGrievanceComponent } from './pages/edit-grievance/edit-grievance.component';
import { ProjectAllocComponent } from './pages/project-alloc/project-alloc.component';
import { ManageRolesComponent } from './pages/manage-roles/manage-roles.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    AdminHeadRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    // Import standalone components
    AdminHomeComponent,
    EditGrievanceComponent,
    ProjectAllocComponent,
    ManageRolesComponent
  ]
})
export class AdminHeadModule { }
