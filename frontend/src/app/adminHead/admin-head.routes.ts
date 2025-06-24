import { Routes } from '@angular/router';

// Component Imports
import { AdminHome } from './admin-home/admin-home';
import { EditGrievance } from './edit-grievance/edit-grievance';
import { ProjectAlloc } from './project-alloc/project-alloc';

export const ADMIN_HEAD_ROUTES: Routes = [
    {
        path: '',
        component: AdminHome,
        title: 'Department Head Dashboard',
    },
    {
        path: 'edit-grievance/:id', // Assuming you'd edit a specific grievance
        component: EditGrievance,
        title: 'Edit Grievance',
    },
    {
        path: 'allocate-project',
        component: ProjectAlloc,
        title: 'Allocate Project',
    },
    {
        path: '**',
        redirectTo: '',
        pathMatch: 'full',
    },
]; 