import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { Contact } from '../models/contact.model';
import { Dropdown } from '../models/dropdown.model';
import { Document } from '../models/docuttach.model';

/**
 * Trimmed, Firestore-direct data layer for the standalone Moves app -
 * same pattern as Network's NetworkDataService: same collection path
 * convention as TODD's DataService.getCollectionReference
 * (`tenants/{tenantId}/<collection>`, confirmed against data.service.ts's
 * ENDPOINTS map), reimplemented from scratch rather than porting the
 * 2000+ line original. Each method exists because a specific ported
 * component needs it:
 *  - task-edit/task use CONTACTS, TASK_TYPES, TASK_STATUS, PROJECTS,
 *    DOCUMENTS dropdown/collection reads (DataService.getDropdownData /
 *    getCollectionData).
 *  - MovesDropdownEditButtonComponent needs add/update/delete against
 *    TASK_TYPES and PROJECTS (DataService.addDocument/updateDocument/
 *    deleteDocument), scoped only to Moves' own two collections rather
 *    than the full cross-module DropdownManagerComponent.
 *  - moves-pricing.component.ts reads the tenant's own contact doc for a
 *    per-tenant Moves price override (DataService.getContactFullByIdOnce).
 */
@Injectable( { providedIn: 'root' } )
export class MovesDataService {
  private get firestore () {
    return getFirestore();
  }

  private tenantCollection ( tenantId: string, name: string ) {
    return collection( this.firestore, `tenants/${tenantId}/${name}` );
  }

  /** Mirrors DataService.getCollectionData('CONTACTS', ...). */
  async getContacts ( tenantId: string ): Promise<Contact[]> {
    const snap = await getDocs( this.tenantCollection( tenantId, 'contacts' ) );
    return snap.docs.map( ( d ) => ( { ...( d.data() as any ), id: d.id } ) as Contact );
  }

  /** Mirrors DataService.getCollectionData('DOCUMENTS', ...) - read-only;
   * Docs is a sibling module owning this collection, Moves only attaches
   * existing documents to a Move. */
  async getDocuments ( tenantId: string ): Promise<Document[]> {
    const snap = await getDocs( this.tenantCollection( tenantId, 'documents' ) );
    return snap.docs.map( ( d ) => ( { ...( d.data() as any ), id: d.id } ) as Document );
  }

  /** Mirrors DataService.getDropdownData('TASK_TYPES', ...) - path 'task-type'. */
  async getTaskTypes ( tenantId: string ): Promise<Dropdown[]> {
    const snap = await getDocs( this.tenantCollection( tenantId, 'task-type' ) );
    return snap.docs.map( ( d ) => ( { ...( d.data() as any ), id: d.id } ) as Dropdown );
  }

  /** Mirrors DataService.getDropdownData('TASK_STATUS', ...) - path 'task-status'. */
  async getTaskStatuses ( tenantId: string ): Promise<Dropdown[]> {
    const snap = await getDocs( this.tenantCollection( tenantId, 'task-status' ) );
    return snap.docs.map( ( d ) => ( { ...( d.data() as any ), id: d.id } ) as Dropdown );
  }

  /** Mirrors DataService.getDropdownData('PROJECTS', ...). */
  async getProjects ( tenantId: string ): Promise<Dropdown[]> {
    const snap = await getDocs( this.tenantCollection( tenantId, 'projects' ) );
    return snap.docs.map( ( d ) => ( { ...( d.data() as any ), id: d.id } ) as Dropdown );
  }

  /** Mirrors DataService.getContactFullByIdOnce(tenantId, tenantId) - the
   * tenant's own contact record, which carries any per-tenant product
   * price overrides under company.products. */
  async getContactFullByIdOnce ( tenantId: string, contactId: string ): Promise<Contact | null> {
    if ( !contactId ) return null;
    const snap = await getDoc( doc( this.tenantCollection( tenantId, 'contacts' ), contactId ) );
    return snap.exists() ? ( { id: snap.id, ...( snap.data() as any ) } as Contact ) : null;
  }

  // --- Dropdown collection CRUD, scoped to just TASK_TYPES/PROJECTS/
  // TASK_STATUS for MovesDropdownEditButtonComponent (mirrors
  // DataService.addDocument/updateDocument/deleteDocument for those three
  // collections only). ---

  async addDropdownItem ( tenantId: string, collectionName: 'task-type' | 'projects' | 'task-status', item: Dropdown ): Promise<string> {
    const ref = this.tenantCollection( tenantId, collectionName );
    const docRef = await addDoc( ref, item );
    await updateDoc( doc( ref, docRef.id ), { id: docRef.id } );
    return docRef.id;
  }

  async updateDropdownItem ( tenantId: string, collectionName: 'task-type' | 'projects' | 'task-status', item: Dropdown ): Promise<void> {
    await setDoc( doc( this.tenantCollection( tenantId, collectionName ), item.id ), item, { merge: true } );
  }

  async deleteDropdownItem ( tenantId: string, collectionName: 'task-type' | 'projects' | 'task-status', itemId: string ): Promise<void> {
    await deleteDoc( doc( this.tenantCollection( tenantId, collectionName ), itemId ) );
  }
}
