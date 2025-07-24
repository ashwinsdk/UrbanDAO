import { Routes } from '@angular/router';
import { UserRole } from './auth/user-role.enum';

// --- Component Imports ---
import { TestHome } from './test-home.component';
import { About } from './common/about/about';
import { Login } from './common/login/login';
import { Register } from './common/register/register';
import { Docs } from './common/docs/docs';

// ROUTES WITHOUT AUTH GUARDS - Testing lazy loading only
export const routesNoGuards: Routes = [
    // ========================================================================
    // Public and Authentication Routes
    // ========================================================================
    {
        path: '',
        component: TestHome,
        title: 'Welcome to UrbanDAO',
    },
    {
        path: 'about',
        component: About,
        title: 'About Us - UrbanDAO',
    },
    {
        path: 'login',
        component: Login,
        title: 'Login - UrbanDAO',
    },
    {
        path: 'register',
        component: Register,
        title: 'Register - UrbanDAO',
    },
    {
        path: 'docs',
        component: Docs,
        title: 'Documentation - UrbanDAO',
    },

    // ========================================================================
    // Role-based Routes (NO AUTH GUARDS - Testing lazy loading)
    // ========================================================================
    
    /**
     * Routes for Government Admin users.
     * Lazy loading test without guards.
     */
    {
        path: 'admin-govt',
        loadChildren: () =>
            import('./adminGovt/admin-govt.routes').then((m) => m.ADMIN_GOVT_ROUTES),
    },

    /**
     * Routes for Municipal Head users.
     * Lazy loading test without guards.
     */
    {
        path: 'admin-head',
        loadChildren: () =>
            import('./adminHead/admin-head.routes').then((m) => m.ADMIN_HEAD_ROUTES),
    },

    /**
     * Routes for regular Citizen users.
     * Lazy loading test without guards.
     */
    {
        path: 'user',
        loadChildren: () => import('./user/user.routes').then((m) => m.USER_ROUTES),
    },

    // ========================================================================
    // Wildcard Route
    // ========================================================================
    {
        path: '**',
        redirectTo: '',
        pathMatch: 'full',
    },
];
