import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/user-role.enum';
import { DeviceService } from '../services/device.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class Footer implements OnInit, OnDestroy {
  currentYear = new Date().getFullYear();
  protected isAuthenticated = false;
  protected userRole: UserRole | null = null;
  protected isMobile = false;
  protected UserRole = UserRole; // Expose enum to template
  protected isDarkMode = false;
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private authService: AuthService,
    private deviceService: DeviceService
  ) {}
  
  ngOnInit(): void {
    // Subscribe to auth service
    this.subscriptions.push(
      this.authService.connected$.subscribe(connected => {
        this.isAuthenticated = connected;
      })
    );
    
    this.subscriptions.push(
      this.authService.userRole$.subscribe(role => {
        this.userRole = role;
      })
    );
    
    // Subscribe to device service
    this.subscriptions.push(
      this.deviceService.isMobile$.subscribe(isMobile => {
        this.isMobile = isMobile;
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
}
