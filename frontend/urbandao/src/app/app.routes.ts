import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AboutComponent } from './pages/about/about.component';
import { DocsComponent } from './pages/docs/docs.component';
import { LoginComponent } from './pages/login/login.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'about',
    component: AboutComponent
  },
  {
    path: 'docs',
    component: DocsComponent
  },
  {
    path: 'login',
    component: LoginComponent
  },
  // Catch-all route for 404
  {
    path: '**',
    component: NotFoundComponent
  }
];
