import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ProjectDashboardComponent } from './pages/dashboard/project-dashboard.component';
import { ProjectFormComponent } from './pages/project-form/project-form.component';
import { ProjectDetailsComponent } from './pages/project-details/project-details.component';
import { MilestoneFormComponent } from './pages/milestone-form/milestone-form.component';
import { ProjectListComponent } from './pages/project-list/project-list.component';

const routes: Routes = [
  {
    path: '',
    component: ProjectDashboardComponent
  },
  {
    path: 'projects',
    component: ProjectListComponent
  },
  {
    path: 'project/new',
    component: ProjectFormComponent
  },
  {
    path: 'project/:id',
    component: ProjectDetailsComponent
  },
  {
    path: 'project/:id/milestone',
    component: MilestoneFormComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectManagerRoutingModule { }
