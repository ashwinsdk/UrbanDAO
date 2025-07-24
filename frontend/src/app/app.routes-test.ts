import { Routes } from '@angular/router';
import { TestHome } from './test-home.component';

// SIMPLIFIED TEST ROUTES - NO GUARDS, NO LAZY LOADING
export const testRoutes: Routes = [
    {
        path: '',
        component: TestHome,
        title: 'Welcome to UrbanDAO Test',
    },
    {
        path: '**',
        redirectTo: '',
        pathMatch: 'full',
    },
];
