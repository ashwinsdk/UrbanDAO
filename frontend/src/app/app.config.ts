import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

// Back to working routes while implementing mock service fix
// import { appRoutes } from './app.routes';
import { testRoutes as appRoutes } from './app.routes-test';
// import { routesNoGuards as appRoutes } from './app.routes-noguards';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes)
  ]
};
