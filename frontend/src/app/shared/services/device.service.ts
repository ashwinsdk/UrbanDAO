import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private readonly MOBILE_BREAKPOINT = 768;
  private isMobileSubject = new BehaviorSubject<boolean>(false);
  
  public isMobile$: Observable<boolean> = this.isMobileSubject.asObservable();
  
  constructor() {
    // Initialize on service creation
    this.checkScreenSize();
    
    // Listen for window resize events
    fromEvent(window, 'resize')
      .pipe(
        debounceTime(250), // Debounce to avoid excessive checks during resize
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.checkScreenSize();
      });
  }
  
  /**
   * Check if the screen size is mobile
   */
  private checkScreenSize(): void {
    const isMobile = window.innerWidth < this.MOBILE_BREAKPOINT;
    if (this.isMobileSubject.value !== isMobile) {
      this.isMobileSubject.next(isMobile);
    }
  }
  
  /**
   * Get current mobile state
   */
  public get isMobile(): boolean {
    return this.isMobileSubject.value;
  }
}
