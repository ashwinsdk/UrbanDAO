import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { UserRole } from './auth/user-role.enum';

// --- Component Imports ---
import { Home } from './home/home';
import { About } from './about/about';
import { Login } from './common/login/login';
import { Register } from './common/register/register';

/**
 * --------------------------------------------------------------------------
 * HOW TO USE IN YOUR STANDALONE ANGULAR APP
 * --------------------------------------------------------------------------
 * In your `app.config.ts`, provide these routes to the application like so:
 *
 * import { ApplicationConfig } from '@angular/core';
 * import { provideRouter, withPreloading, PreloadAllModules, withInMemoryScrolling } from '@angular/router';
 * import { appRoutes } from './app.routes';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideRouter(
 *       appRoutes,
 *       withPreloading(PreloadAllModules), // Enables preloading of all lazy-loaded modules
 *       withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }) // Enables scroll position restoration
 *     ),
 *     // ... other providers
 *   ],
 * };
 * --------------------------------------------------------------------------
 */

export const appRoutes: Routes = [
    // ========================================================================
    // Public and Authentication Routes
    // ========================================================================
    {
        path: '',
        component: Home,
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
        data: { hideHeaderFooter: true },
        title: 'Login',
    },
    {
        path: 'register',
        component: Register,
        data: { hideHeaderFooter: true },
        title: 'Register',
    },

    // ========================================================================
    // Role-Protected, Lazy-Loaded Feature Routes
    // ========================================================================

    /**
     * Routes for Government Officer users.
     * Accessible only by wallets with the 'admin-govt' role.
     */
    {
        path: 'admin-govt',
        canActivate: [authGuard],
        data: {
            expectedRole: UserRole.AdminGovt,
        },
        loadChildren: () =>
            import('./adminGovt/admin-govt.routes').then((m) => m.ADMIN_GOVT_ROUTES),
    },

    /**
     * Routes for Municipal Head users.
     * Accessible only by wallets with the 'admin-head' role.
     */
    {
        path: 'admin-head',
        canActivate: [authGuard],
        data: {
            expectedRole: UserRole.AdminHead,
        },
        loadChildren: () =>
            import('./adminHead/admin-head.routes').then((m) => m.ADMIN_HEAD_ROUTES),
    },

    /**
     * Routes for regular Citizen users.
     * Accessible only by wallets with the 'user' role.
     */
    {
        path: 'user',
        canActivate: [authGuard],
        data: {
            expectedRole: UserRole.User,
        },
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
