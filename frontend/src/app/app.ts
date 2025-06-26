import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

// Shared components
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'UrbanDAO';
  protected showHeaderFooter = true;

  constructor(private router: Router) {
    // Check if we should hide header/footer on specific routes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Hide header/footer on login and register pages
      const hideOnRoutes = ['/login', '/register'];
      this.showHeaderFooter = !hideOnRoutes.some(route => 
        event.urlAfterRedirects.startsWith(route));
    });
  }
}
