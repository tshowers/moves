import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MovesAuthService } from '../../services/moves-auth.service';
import { MovesDataService } from '../../services/moves-data.service';
import { MovesNotificationService } from '../../services/moves-notification.service';
import { Dropdown } from '../../models/dropdown.model';

/**
 * Judgment-call trim of TODD's DropDownEditButtonComponent +
 * DropdownManagerComponent (638 lines together): the real
 * DropdownManagerComponent is a cross-module admin panel that can edit
 * ANY of TODD's ~16 dropdown collections (industries, survey topics,
 * knowledge-base categories...), most of which belong to other modules
 * entirely. task-edit.component.ts only ever opens it scoped to exactly
 * one of two collections - TASK_TYPES or PROJECTS - via
 * `dropdownKey="TASK_TYPES"` / `dropdownKey="PROJECTS"`. Rather than port
 * the full cross-module manager, this reimplements just that one-collection
 * add/edit/delete modal against MovesDataService's task-type/projects
 * methods, preserving the actual UX affordance task-edit uses without
 * dragging in unrelated modules' admin surface.
 */
@Component( {
  selector: 'app-drop-down-edit-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './drop-down-edit-button.component.html',
  styleUrl: './drop-down-edit-button.component.css'
} )
export class DropDownEditButtonComponent implements OnDestroy {
  @Input() dropdownKey!: 'TASK_TYPES' | 'PROJECTS' | 'TASK_STATUS';
  @Output() updated = new EventEmitter<void>();

  @ViewChild( 'overlayRef' ) overlayRef?: ElementRef<HTMLElement>;

  showModal = false;
  isAuthenticated = false;
  isLoading = false;
  newItemName = '';
  items: Dropdown[] = [];

  private authSubscription: Subscription;
  private tenantId = '';

  private get collectionName (): 'task-type' | 'projects' | 'task-status' {
    if ( this.dropdownKey === 'TASK_TYPES' ) return 'task-type';
    if ( this.dropdownKey === 'TASK_STATUS' ) return 'task-status';
    return 'projects';
  }

  get collectionLabel (): string {
    if ( this.dropdownKey === 'TASK_TYPES' ) return 'move types';
    if ( this.dropdownKey === 'TASK_STATUS' ) return 'move statuses';
    return 'projects';
  }

  constructor (
    private renderer: Renderer2,
    private authService: MovesAuthService,
    private dataService: MovesDataService,
    private notificationService: MovesNotificationService,
  ) {
    this.authSubscription = this.authService.getUser().subscribe( user => {
      this.isAuthenticated = !!user;
    } );
  }

  openModal ( event?: MouseEvent ): void {
    if ( event ) event.stopPropagation();

    if ( !this.isAuthenticated ) {
      this.notificationService.show( 'Sign in required', 'You must be logged in to edit dropdown options.', 'info' );
      return;
    }
    if ( !this.dropdownKey ) return;

    this.showModal = true;
    this.loadItems();
    setTimeout( () => {
      if ( this.overlayRef ) {
        this.renderer.appendChild( document.body, this.overlayRef.nativeElement );
      }
    } );
  }

  closeModal ( event?: MouseEvent ): void {
    if ( event ) event.stopPropagation();
    this.showModal = false;
    this.updated.emit();
  }

  onBackdropClick ( event: MouseEvent ): void {
    event.stopPropagation();
    this.closeModal();
  }

  onDialogClick ( event: MouseEvent ): void {
    event.stopPropagation();
  }

  private async loadItems (): Promise<void> {
    this.isLoading = true;
    try {
      const tenantId = await this.resolveTenantId();
      const items = this.dropdownKey === 'TASK_TYPES'
        ? await this.dataService.getTaskTypes( tenantId )
        : this.dropdownKey === 'TASK_STATUS'
          ? await this.dataService.getTaskStatuses( tenantId )
          : await this.dataService.getProjects( tenantId );
      this.items = items.slice().sort( ( a, b ) => ( a.name || '' ).localeCompare( b.name || '', undefined, { sensitivity: 'base' } ) );
    } catch {
      this.items = [];
      this.notificationService.show( 'Error', `Unable to load ${this.collectionLabel}.`, 'error' );
    } finally {
      this.isLoading = false;
    }
  }

  private async resolveTenantId (): Promise<string> {
    if ( this.tenantId ) return this.tenantId;
    const tenantId = this.authService.getTenant();
    this.tenantId = tenantId;
    return tenantId;
  }

  async addItem (): Promise<void> {
    const name = this.newItemName.trim();
    if ( !name ) return;

    try {
      const tenantId = await this.resolveTenantId();
      const id = await this.dataService.addDropdownItem( tenantId, this.collectionName, { id: '', name } );
      this.items = [...this.items, { id, name }]
        .sort( ( a, b ) => ( a.name || '' ).localeCompare( b.name || '', undefined, { sensitivity: 'base' } ) );
      this.newItemName = '';
      this.notificationService.show( 'Success', 'Item added.', 'success' );
    } catch {
      this.notificationService.show( 'Error', 'Unable to add item.', 'error' );
    }
  }

  async updateItem ( item: Dropdown ): Promise<void> {
    try {
      const tenantId = await this.resolveTenantId();
      await this.dataService.updateDropdownItem( tenantId, this.collectionName, item );
      this.notificationService.show( 'Success', 'Item updated.', 'success' );
    } catch {
      this.notificationService.show( 'Error', 'Unable to update item.', 'error' );
    }
  }

  async deleteItem ( itemId: string ): Promise<void> {
    try {
      const tenantId = await this.resolveTenantId();
      await this.dataService.deleteDropdownItem( tenantId, this.collectionName, itemId );
      this.items = this.items.filter( i => i.id !== itemId );
      this.notificationService.show( 'Success', 'Item deleted.', 'success' );
    } catch {
      this.notificationService.show( 'Error', 'Unable to delete item.', 'error' );
    }
  }

  ngOnDestroy (): void {
    this.authSubscription.unsubscribe();
    if ( this.overlayRef?.nativeElement?.parentNode === document.body ) {
      document.body.removeChild( this.overlayRef.nativeElement );
    }
  }
}
