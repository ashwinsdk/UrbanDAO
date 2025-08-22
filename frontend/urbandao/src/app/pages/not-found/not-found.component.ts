import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="not-found-container">
      <div class="not-found-content">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you are looking for does not exist or has been moved.</p>
        <a routerLink="/" class="home-button">Return Home</a>
      </div>
    </div>
  `,
  styles: [`
    .not-found-container {
      height: 70vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 1rem;
    }
    
    .not-found-content {
      max-width: 500px;
    }
    
    h1 {
      font-size: 8rem;
      margin: 0;
      color: #a259d9;
      line-height: 1;
    }
    
    h2 {
      font-size: 2rem;
      margin-bottom: 1.5rem;
      color: #333;
    }
    
    p {
      font-size: 1.2rem;
      margin-bottom: 2rem;
      color: #666;
    }
    
    .home-button {
      display: inline-block;
      background-color: #a259d9;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 600;
      transition: background-color 0.3s;
    }
    
    .home-button:hover {
      background-color: #8a42c2;
    }
  `]
})
export class NotFoundComponent {
  // Component logic here
}
