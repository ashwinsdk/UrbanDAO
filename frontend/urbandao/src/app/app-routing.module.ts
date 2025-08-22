import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { RegistrationStatusComponent } from './pages/registration-status/registration-status.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './core/models/role.model';

const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'registration-status',
    component: RegistrationStatusComponent
  },
  {
    path: 'citizen',
    loadChildren: () => import('./modules/citizen/citizen.module').then(m => m.CitizenModule),
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.CITIZEN_ROLE] }
  },
  {
    path: 'validator',
    loadChildren: () => import('./modules/validator/validator.module').then(m => m.ValidatorModule),
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.VALIDATOR_ROLE] }
  },
  {
    path: 'tax-collector',
    loadChildren: () => import('./modules/tax-collector/tax-collector.module').then(m => m.TaxCollectorModule),
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.TAX_COLLECTOR_ROLE] }
  },
  {
    path: 'project-manager',
    loadChildren: () => import('./modules/project-manager/project-manager.module').then(m => m.ProjectManagerModule),
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.PROJECT_MANAGER_ROLE] }
  },
  {
    path: 'admin-head',
    loadChildren: () => import('./modules/admin-head/admin-head.module').then(m => m.AdminHeadModule),
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.ADMIN_HEAD_ROLE] }
  },
  {
    path: 'admin-govt',
    loadChildren: () => import('./modules/admin-govt/admin-govt.module').then(m => m.AdminGovtModule),
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.ADMIN_GOVT_ROLE] }
  },
  {
    path: '**',
    redirectTo: ''
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
