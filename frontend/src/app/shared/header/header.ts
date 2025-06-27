import { Component, OnInit, Renderer2, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/user-role.enum';
import { Subscription } from 'rxjs';
import { Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header implements OnInit, OnDestroy {
  isLoggedIn = false;
  userRole: UserRole | null = null;
  UserRole = UserRole; // Expose enum to template
  isMobileMenuOpen = false;
  publicKey: string | null = null;
  isDarkMode = false;
  private subscriptions: Subscription[] = [];
  private readonly THEME_KEY = 'urbandao-theme';
  
  constructor(
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    private authService: AuthService,
    private meta: Meta
  ) {}
  
  ngOnInit(): void {
    // Load saved theme preference
    this.loadThemePreference();
    
    // Subscribe to auth service observables
    this.subscriptions.push(
      this.authService.connected$.subscribe(connected => {
        this.isLoggedIn = connected;
      })
    );
    
    this.subscriptions.push(
      this.authService.userRole$.subscribe(role => {
        this.userRole = role;
      })
    );
    
    this.subscriptions.push(
      this.authService.publicKey$.subscribe(publicKey => {
        this.publicKey = publicKey;
      })
    );
    
    // Close mobile menu when clicking outside
    this.renderer.listen('window', 'click', (e: Event) => {
      if (this.isMobileMenuOpen) {
        const target = e.target as HTMLElement;
        const navMenu = this.document.getElementById('navMenu');
        const mobileToggle = this.document.querySelector('.mobile-toggle');
        
        if (navMenu && mobileToggle && 
            !navMenu.contains(target) && 
            !mobileToggle.contains(target)) {
          this.closeMobileMenu();
        }
      }
    });
  }
  
  /**
   * Load theme preference from localStorage
   */
  private loadThemePreference(): void {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    if (savedTheme === 'dark') {
      this.isDarkMode = true;
      this.applyTheme('dark');
    } else {
      this.isDarkMode = false;
      this.applyTheme('light');
    }
  }
  
  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    const theme = this.isDarkMode ? 'dark' : 'light';
    
    // Save preference to localStorage
    localStorage.setItem(this.THEME_KEY, theme);
    
    // Apply theme to document
    this.applyTheme(theme);
  }
  
  /**
   * Apply theme to document and update meta tags
   */
  private applyTheme(theme: 'light' | 'dark'): void {
    if (theme === 'dark') {
      // Apply to both HTML and body elements for maximum compatibility
      this.document.documentElement.setAttribute('data-theme', 'dark');
      this.document.body.setAttribute('data-theme', 'dark');
      this.meta.updateTag({ name: 'theme-color', content: '#000000' });
    } else {
      this.document.documentElement.removeAttribute('data-theme');
      this.document.body.removeAttribute('data-theme');
      this.meta.updateTag({ name: 'theme-color', content: '#1976d2' });
    }
  }
  
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    const navMenu = this.document.getElementById('navMenu');
    
    if (navMenu) {
      if (this.isMobileMenuOpen) {
        this.renderer.addClass(navMenu, 'active');
        this.renderer.addClass(this.document.body, 'menu-open');
      } else {
        this.closeMobileMenu();
      }
    }
  }
  
  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    const navMenu = this.document.getElementById('navMenu');
    
    if (navMenu) {
      this.renderer.removeClass(navMenu, 'active');
      this.renderer.removeClass(this.document.body, 'menu-open');
    }
  }
  
  logout(): void {
    this.authService.logout();
    this.closeMobileMenu();
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
