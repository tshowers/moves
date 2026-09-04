import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Nomenclature } from '../models/nomenclature.model';

/**
 * TODD's real NomenclatureService (193 lines) lets a tenant relabel terms
 * across the whole app for different business verticals - CRM, LMS, LIS,
 * etc. Ported from Network's NetworkNomenclatureService: none of the
 * components pulled into this app (task-home, task-view-parent, task-edit,
 * ai-mission-list/detail, and their children) actually read any
 * nomenclature key - it's only ever injected because TopDogComponent
 * (which task.component.ts extends) requires it in its constructor and
 * resolves `currentNomenclature$` for its own readiness check. So this
 * just serves the same static default-vertical labels Network's stub
 * does, unconfigurable, rather than porting the vertical-switching
 * machinery no in-scope component uses.
 */
const DEFAULT_NOMENCLATURE: Nomenclature = {
  person: 'Contact',
  organization: 'Company',
  firstName: 'First Name',
  middleName: 'Middle Name',
  lastName: 'Last Name',
  companyName: 'Company Name',
  dbaName: 'DBA Name',
  employeeCount: 'Number of Employees',
  projects: 'Projects',
  capabilities: 'Capabilities',
  title: 'Title or Profession',
  status: 'Status',
  vip: 'VIP/Important',
  email: 'Email Address',
  phone: 'Phone Number',
  address: 'Address',
  onlinePresence: 'Online Presence',
  nickname: 'Nickname',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  gender: 'Gender',
  category: 'Category',
  timezone: 'Timezone',
  businessType: 'Business Type',
  task: 'Move',
  survey: 'Survey',
  lead: 'Lead',
  qualification: 'Qualification',
  engaged: 'Engaged',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closing: 'Closing',
  post: 'Post Sale',
  closed: 'Closed Won',
};

@Injectable( { providedIn: 'root' } )
export class MovesNomenclatureService {
  readonly currentNomenclature$: Observable<Nomenclature> = of( DEFAULT_NOMENCLATURE );

  getNomenclature ( key: keyof Nomenclature ): string {
    return DEFAULT_NOMENCLATURE[key] || '';
  }
}
