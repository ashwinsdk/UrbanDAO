import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="footer">
      <div class="footer-container">
        <div class="footer-content">
          <div class="footer-logo">
            <img src="/assets/urbanDOA.png" alt="UrbanDAO Logo" height="30" />
          </div>
          <div class="footer-links">
            <div class="links-group">
              <h4>UrbanDAO</h4>
              <ul>
                <li><a routerLink="/">Home</a></li>
                <li><a routerLink="/about">About</a></li>
                <li><a routerLink="/docs">Documentation</a></li>
              </ul>
            </div>
            <div class="links-group">
              <h4>Resources</h4>
              <ul>
                <li><a href="https://sepolia.etherscan.io" target="_blank">Sepolia Explorer</a></li>
                <li><a href="https://ethereum.org" target="_blank">Ethereum</a></li>
              </ul>
            </div>
            <div class="links-group">
              <h4>Legal</h4>
              <ul>
                <li><a routerLink="/privacy">Privacy Policy</a></li>
                <li><a routerLink="/terms">Terms of Use</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© {{ currentYear }} UrbanDAO. All rights reserved.</p>
          <p>Built on Ethereum Sepolia</p>
        </div>
      </div>
    </footer>
  `,
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}
