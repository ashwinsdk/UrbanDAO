import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './docs.html',
  styleUrl: './docs.css'
})
export class Docs {
  sections = [
    {
      title: 'Getting Started',
      content: 'Learn how to create an account and verify your identity to access UrbanDAO services.'
    },
    {
      title: 'Tax Payment',
      content: 'Step-by-step guide to paying municipal taxes through our blockchain system.'
    },
    {
      title: 'Grievance Filing',
      content: 'How to submit and track civic grievances with our transparent system.'
    },
    {
      title: 'Project Tracking',
      content: 'Guide to monitoring ongoing municipal projects, budgets, and timelines.'
    },
    {
      title: 'Technical Documentation',
      content: 'Technical details about our blockchain implementation and smart contracts.'
    }
  ];
}
