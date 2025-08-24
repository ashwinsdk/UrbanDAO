import { Routes } from '@angular/router';

export const CITIZEN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dashboard/citizen-dashboard.component')
      .then(m => m.CitizenDashboardComponent)
  },
  {
    path: 'grievances',
    loadComponent: () => import('./pages/grievances/grievances.component')
      .then(m => m.GrievancesComponent)
  },
  {
    path: 'grievances/new',
    loadComponent: () => import('./pages/new-grievance/new-grievance.component')
      .then(m => m.NewGrievanceComponent)
  },
  {
    path: 'grievances/:id',
    loadComponent: () => import('./pages/grievance-detail/grievance-detail.component')
      .then(m => m.GrievanceDetailComponent)
  },
  {
    path: 'taxes',
    loadComponent: () => import('./pages/taxes/citizen-taxes.component')
      .then(m => m.CitizenTaxesComponent)
  },
  {
    path: 'projects',
    loadComponent: () => import('./pages/projects/citizen-projects.component')
      .then(m => m.CitizenProjectsComponent)
  }
];
