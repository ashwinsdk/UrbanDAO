import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignHead } from './assign-head';

describe('AssignHead', () => {
  let component: AssignHead;
  let fixture: ComponentFixture<AssignHead>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignHead]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignHead);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
