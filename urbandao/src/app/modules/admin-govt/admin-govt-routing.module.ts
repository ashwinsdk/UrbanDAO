import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { AdminGovtHomeComponent } from './pages/admin-govt-home/admin-govt-home.component';
import { AreaManagementComponent } from './pages/area-management/area-management.component';
import { AdminHeadManagementComponent } from './pages/admin-head-management/admin-head-management.component';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    data: { roles: ['ADMIN_GOVT_ROLE', 'OWNER_ROLE'] },
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
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminGovtRoutingModule { }

