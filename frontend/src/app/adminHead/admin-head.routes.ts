import { Routes } from '@angular/router';

// Component Imports
import { AdminHome } from './admin-home/admin-home';
import { EditGrievance } from './edit-grievance/edit-grievance';
import { ProjectAlloc } from './project-alloc/project-alloc';

export const ADMIN_HEAD_ROUTES: Routes = [
    {
        path: '',
        component: AdminHome,
        title: 'Municipal Head Dashboard',
    },
    {
        path: 'grievances',
        component: EditGrievance,
        title: 'Manage Grievances',
    },
    {
        path: 'grievances/:id',
        component: EditGrievance,
        title: 'Edit Grievance',
    },
    {
        path: 'projects',
        component: ProjectAlloc,
        title: 'Manage Projects',
    },
    {
        path: '**',
        redirectTo: '',
        pathMatch: 'full',
    },
]; 