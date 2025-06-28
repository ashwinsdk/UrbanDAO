import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';

// Shared components
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { MobileNav } from './shared/mobile-nav/mobile-nav';

// Services
import { DeviceService } from './shared/services/device.service';
import { AuthService } from './auth/auth.service';
import { UserRole } from './auth/user-role.enum';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, Header, Footer, MobileNav],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected title = 'UrbanDAO';
  protected showHeaderFooter = true;
  protected showMobileNav = false;
  protected isMobile = false;
  protected isAuthenticated = false;
  protected userRole: UserRole | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private deviceService: DeviceService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // Combine device service and auth service observables
    this.subscriptions.push(
      combineLatest([
        this.deviceService.isMobile$,
        this.authService.connected$,
        this.authService.userRole$,
        this.router.events.pipe(filter(event => event instanceof NavigationEnd))
      ]).subscribe(([isMobile, isAuthenticated, userRole, event]) => {
        this.isMobile = isMobile;
        this.isAuthenticated = isAuthenticated;
        this.userRole = userRole;

        // Cast event to NavigationEnd to access urlAfterRedirects
        const navigationEvent = event as NavigationEnd;
        this.updateLayoutVisibility(navigationEvent.urlAfterRedirects);
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Update layout visibility based on route, device, and authentication state
   */
  private updateLayoutVisibility(url: string = this.router.url): void {
    // Get current route data to check if header/footer should be hidden
    const currentRoute = this.router.routerState.snapshot.root.firstChild;
    const hideHeaderFooter = currentRoute?.data?.['hideHeaderFooter'] === true;
    const authRoutes = ['/login', '/register'];
    const isAuthRoute = authRoutes.some(route => url.startsWith(route));

    // Completely hide header/footer on auth routes or when explicitly hidden
    this.showHeaderFooter = !isAuthRoute && !hideHeaderFooter;

    // Hide mobile nav on auth routes
    this.showMobileNav = this.isMobile && !isAuthRoute;

    // Add/remove body class for mobile nav spacing
    if (this.isMobile && !isAuthRoute) {
      document.body.classList.add('has-mobile-nav');
    } else {
      document.body.classList.remove('has-mobile-nav');
    }

    // Add/remove body class for auth pages to ensure full height
    if (isAuthRoute) {
      document.body.classList.add('auth-page');
    } else {
      document.body.classList.remove('auth-page');
    }
  }
}
