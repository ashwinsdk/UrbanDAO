import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { AdminGovtHomeComponent } from './pages/admin-govt-home/admin-govt-home.component';
import { AreaManagementComponent } from './pages/area-management/area-management.component';
import { AdminHeadManagementComponent } from './pages/admin-head-management/admin-head-management.component';

// Define routes directly in this module to avoid import issues
const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    data: { roles: ['ADMIN_GOVT_ROLE'] },
    children: [
      {
        path: '',
        component: AdminGovtHomeComponent
      },
      {
        path: 'areas',
        component: AreaManagementComponent
      },
      {
        path: 'admin-heads',
        component: AdminHeadManagementComponent
      }
    ]
  }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    AdminGovtHomeComponent,
    AreaManagementComponent,
    AdminHeadManagementComponent
  ]
})
export class AdminGovtModule { }
