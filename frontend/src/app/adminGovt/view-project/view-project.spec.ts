import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewProject } from './view-project';

describe('ViewProject', () => {
  let component: ViewProject;
  let fixture: ComponentFixture<ViewProject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewProject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewProject);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
