import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { DeviceService } from '../services/device.service';
import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/user-role.enum';

@Component({
  selector: 'app-mobile-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './mobile-nav.html',
  styleUrls: ['./mobile-nav.css']
})
export class MobileNav implements OnInit, OnDestroy {
  protected isMobile = false;
  protected userRole: UserRole | null = null;
  protected isAuthenticated = false;
  protected UserRole = UserRole; // Expose enum to template
  protected isDarkMode = false;
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private deviceService: DeviceService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Combine device and auth state observables
    this.subscriptions.push(
      combineLatest([
        this.deviceService.isMobile$,
        this.authService.userRole$,
        this.authService.connected$
      ]).subscribe(([isMobile, userRole, connected]) => {
        this.isMobile = isMobile;
        this.userRole = userRole;
        this.isAuthenticated = connected;
      })
    );
    
    // Check for dark mode
    this.checkDarkMode();
    
    // Listen for theme changes
    const observer = new MutationObserver(() => {
      this.checkDarkMode();
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    // Clean up observer on destroy
    this.subscriptions.push(new Subscription(() => observer.disconnect()));
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  /**
   * Toggle dark/light theme
   */
  toggleTheme(): void {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Apply theme to both document element and body
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.setAttribute('data-theme', newTheme);
    
    // Save preference
    localStorage.setItem('theme', newTheme);
    
    // Update state
    this.checkDarkMode();
  }
  
  /**
   * Check if dark mode is active
   */
  private checkDarkMode(): void {
    this.isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  }
  
  /**
   * Log out the user
   */
  logout(): void {
    this.authService.logout();
  }
  
  /**
   * Login redirect
   */
  login(): void {
    window.location.href = '/login';
  }
  
  /**
   * Register redirect
   */
  register(): void {
    window.location.href = '/register';
  }
}
