import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { Observable, from, map } from 'rxjs';

import { AppUser } from '../models/contact.model';

/**
 * Trimmed, Firestore-direct port of just the two AdminControlService
 * methods task-edit.component.ts uses for its "assign to" member picker:
 * getTenantMembers$ (every `users` doc with companyId==tenantId) and
 * getTenantOwnerUser$ (the tenant's own contact doc, treated as the
 * owner). Same field mapping as admin-control.service.ts's private
 * toTenantMember/toTenantOwnerUser helpers, not the full 1000+ line
 * AdminControlService (invites, grading weights, Cypress test-mode state,
 * etc. that task-edit never touches).
 */
@Injectable( { providedIn: 'root' } )
export class MovesAdminService {
  private get firestore () {
    return getFirestore();
  }

  getTenantMembers$ ( tenantId: string ): Observable<AppUser[]> {
    const normalizedTenantId = ( tenantId || '' ).trim();
    if ( !normalizedTenantId ) {
      return new Observable<AppUser[]>( ( observer ) => {
        observer.next( [] );
        observer.complete();
      } );
    }

    const q = query( collection( this.firestore, 'users' ), where( 'companyId', '==', normalizedTenantId ) );
    return from( getDocs( q ) ).pipe(
      map( ( snap ) => snap.docs.map( ( d ) => this.toTenantMember( { id: d.id, ...( d.data() as any ) } ) ) ),
    );
  }

  getTenantOwnerUser$ ( tenantId: string ): Observable<AppUser | null> {
    const normalizedTenantId = ( tenantId || '' ).trim();
    if ( !normalizedTenantId ) {
      return new Observable<AppUser | null>( ( observer ) => {
        observer.next( null );
        observer.complete();
      } );
    }

    const ref = doc( this.firestore, `tenants/${normalizedTenantId}/contacts/${normalizedTenantId}` );
    return from( getDoc( ref ) ).pipe(
      map( ( snap ) => this.toTenantOwnerUser( snap.exists() ? ( snap.data() as any ) : null, normalizedTenantId ) ),
    );
  }

  private toTenantMember ( user: AppUser ): AppUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName || user.email,
      role: user.role,
      companyId: user.companyId,
      status: user.status,
      isTenantOwner: !!user.isTenantOwner,
    };
  }

  private toTenantOwnerUser ( contact: any | null, tenantId: string ): AppUser | null {
    if ( !contact ) return null;

    const email = String(
      contact.email || contact.emailAddresses?.[0]?.emailAddress || ''
    ).trim().toLowerCase();

    if ( !email ) return null;

    const displayName = String(
      contact.displayName || [contact.firstName, contact.lastName].filter( Boolean ).join( ' ' ) || email
    ).trim();

    return {
      id: String( contact.id || contact.uid || contact.loginID || tenantId ).trim(),
      email,
      displayName,
      role: 'admin',
      companyId: tenantId,
      status: 'active',
      isTenantOwner: true,
    };
  }
}
