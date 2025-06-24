import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectAlloc } from './project-alloc';

describe('ProjectAlloc', () => {
  let component: ProjectAlloc;
  let fixture: ComponentFixture<ProjectAlloc>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectAlloc]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectAlloc);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
