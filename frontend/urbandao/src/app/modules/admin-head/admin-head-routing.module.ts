import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminHomeComponent } from './pages/admin-home/admin-home.component';
import { EditGrievanceComponent } from './pages/edit-grievance/edit-grievance.component';
import { ProjectAllocComponent } from './pages/project-alloc/project-alloc.component';
import { ManageRolesComponent } from './pages/manage-roles/manage-roles.component';
import { roleGuard } from '../../core/guards/role.guard';
import { authGuard } from '../../core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: AdminHomeComponent,
    canActivate: [() => authGuard(), (route) => roleGuard(route)],
    data: { roles: ['ADMIN_HEAD_ROLE'] }
  },
  {
    path: 'grievances',
    component: EditGrievanceComponent,
    canActivate: [() => authGuard(), (route) => roleGuard(route)],
    data: { roles: ['ADMIN_HEAD_ROLE'] }
  },
  {
    path: 'grievances/:id',
    component: EditGrievanceComponent,
    canActivate: [() => authGuard(), (route) => roleGuard(route)],
    data: { roles: ['ADMIN_HEAD_ROLE'] }
  },
  {
    path: 'projects',
    component: ProjectAllocComponent,
    canActivate: [() => authGuard(), (route) => roleGuard(route)],
    data: { roles: ['ADMIN_HEAD_ROLE'] }
  },
  {
    path: 'manage-roles',
    component: ManageRolesComponent,
    canActivate: [() => authGuard(), (route) => roleGuard(route)],
    data: { roles: ['ADMIN_HEAD_ROLE'] }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminHeadRoutingModule { }
