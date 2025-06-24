import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewGrievance } from './view-grievance';

describe('ViewGrievance', () => {
  let component: ViewGrievance;
  let fixture: ComponentFixture<ViewGrievance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewGrievance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewGrievance);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
