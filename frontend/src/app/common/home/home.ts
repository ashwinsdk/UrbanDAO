import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  features = [
    {
      icon: 'receipt',
      title: 'Tax Payment',
      description: 'Securely pay your municipal taxes through our blockchain-powered system, ensuring transparency and immutability of records.',
      link: '/user/pay-tax'
    },
    {
      icon: 'forum',
      title: 'Grievance Filing',
      description: 'Submit and track civic grievances with our transparent system that ensures accountability from municipal authorities.',
      link: '/user/file-grievance'
    },
    {
      icon: 'construction',
      title: 'Project Tracking',
      description: 'Monitor ongoing municipal projects, their budgets, timelines, and progress updates in real-time.',
      link: '/user/view-projects'
    }
  ];
}
