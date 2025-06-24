import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GovtHome } from './govt-home';

describe('GovtHome', () => {
  let component: GovtHome;
  let fixture: ComponentFixture<GovtHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GovtHome]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GovtHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
