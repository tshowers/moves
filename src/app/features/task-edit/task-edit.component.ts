import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { getStorage } from 'firebase/storage';
import { AppUser, Contact } from '../../models/contact.model';
import { Document } from '../../models/docuttach.model';
import { Image } from '../../models/image.model';
import { Project } from '../../models/project.model';
import { Task, TaskType } from '../../models/task.model';
import { MovesAssistantSignalService } from '../../services/moves-assistant-signal.service';
import { AppendYouPipe } from '../../pipes/append-you.pipe';

import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { Dropdown } from '../../models/dropdown.model';
import { DropDownEditButtonComponent } from '../../shared/drop-down-edit-button/drop-down-edit-button.component';
import { catchError, combineLatest, firstValueFrom, from, map, of, Subscription, take, timeout } from 'rxjs';
import { MovesAuthService } from '../../services/moves-auth.service';
import { MovesDataService } from '../../services/moves-data.service';
import { MoveLimits, TaskApiService } from '../../services/task-api.service';
import { AiMissionApiService } from '../../services/ai-mission-api.service';
import { LoggerService } from '../../services/logger.service';
import { MovesNotificationService } from '../../services/moves-notification.service';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { RelativeTimePipe } from '../../pipes/relative-time.pipe';
import { MovesAdminService } from '../../services/moves-admin.service';


/**
 * Near-verbatim port of features/tasks/task-edit/task-edit.component.ts -
 * this app's `/move` (create) and `/move/:id` (edit) routes. Service
 * renames only (AuthService -> MovesAuthService, DataService ->
 * MovesDataService, TaskService -> TaskApiService, AIMissionService ->
 * AiMissionApiService, ToddAssistantBusService ->
 * MovesAssistantSignalService, NotificationService ->
 * MovesNotificationService, AdminControlService -> MovesAdminService).
 * MovesDataService's dropdown/collection reads all return Promises (see
 * moves-data.service.ts's doc comment), so contactsRequest/taskTypesRequest/
 * projectsRequest/documentsRequest are now all wrapped in `from()`.
 *
 * Note ported as-is, not fixed: `selectedExistingDocument` (bound to the
 * "attach an existing document" dropdown) is never actually pushed into
 * `attachedDocuments` anywhere in the original component either - a
 * pre-existing gap in the source, not introduced by this port. Real file
 * upload lives in task.component.ts (ported separately, and does use
 * Storage for real), not here - this component's own `storage`/
 * `uploadProgress`/`selectedFile` fields are declared but never wired to
 * an `<input type="file">` in the source template.
 */
@Component( {
  selector: 'app-task-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppendYouPipe, DropDownEditButtonComponent, PreloaderComponent, ClickSoundDirective, CockpitBrowseModeBannerComponent, RelativeTimePipe],
  templateUrl: './task-edit.component.html',
  styleUrl: './task-edit.component.css'
} )
export class TaskEditComponent implements OnInit, OnChanges, OnDestroy {
  @Input() userId = '';
  @Input() selectedTask: Task | null = null;
  contacts: Contact[] = [];
  authorizedAssignees: AppUser[] = [];
  taskTypes: TaskType[] = [];
  projects: Project[] = [];
  documents: Document[] = [];
  readonly taskStatusOptions = [
    { value: 'not-started', label: 'Not started' },
    { value: 'in-progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'on-hold', label: 'On hold' },
    { value: 'cancelled', label: 'Cancelled' }
  ] as const;
  taskStatuses: string[] = this.taskStatusOptions.map( option => option.value );

  @Output() saveAction = new EventEmitter<Task>();
  @Output() deleteAction = new EventEmitter<string>();
  @Output() cancelAction = new EventEmitter<void>();

  userSubscription!: Subscription;
  lookupSubscription!: Subscription;
  routeSubscription!: Subscription;
  querySubscription!: Subscription;
  private signalSubscription!: Subscription;
  private firebaseSubscription!: Subscription;

  parentTaskIdFromRoute = '';
  childTasks: Task[] = [];

  isLoading: boolean = false;

  storage = getStorage();
  public uid!: string;

  newTaskTitle = '';
  newTaskDescription = '';
  newTaskDueDate = '';
  editingTaskId?: string;
  images: Image[] = [];
  attachedDocuments: Document[] = [];
  isSubTask = false;
  startDate = '';
  timerEndTime = '';
  timerStartTime = '';
  selectedContacts: Contact[] = [];
  selectedAssigneeId = '';
  selectedTaskType = '';
  selectedProject = '';
  selectedStatus = 'not-started';
  selectedExistingDocument = '';
  uploadProgress: number | null = null;
  downloadURL: string | null = null;
  processing = false;
  error: string | null = null;
  selectedFile: File | null = null;
  toddSignalState: 'idle' | 'listening' | 'thinking' | 'ready' = 'idle';
  moveLimits: MoveLimits | null = null;

  // AI Mission fields (additive — defaults keep existing behaviour unchanged)
  isAIMission = false;
  missionObjective = '';
  missionSuccessCriteria = '';
  missionContextText = '';

  // Notes thread with Maya - only meaningful for Moves she created from her
  // daily plan (selectedTask.notesLog is empty/absent otherwise).
  newNoteText = '';
  isSavingNote = false;
  noteError: string | null = null;

  constructor ( private authService: MovesAuthService,
    private dataService: MovesDataService,
    private taskService: TaskApiService,
    private aiMissionService: AiMissionApiService,
    private assistantBus: MovesAssistantSignalService,
    private route: ActivatedRoute,
    private router: Router,
    private logger: LoggerService,
    private notificationService: MovesNotificationService,
    private adminControlService: MovesAdminService
  ) { }

  public hasAuthenticatedUser (): boolean {
    return !!this.uid && !!this.userId;
  }

  async addNote (): Promise<void> {
    const text = this.newNoteText.trim();
    if ( !text || !this.selectedTask?.id || this.isSavingNote ) return;

    this.isSavingNote = true;
    this.noteError = null;

    try {
      const notesLog = await this.taskService.addTaskNote( this.selectedTask.id, text );
      this.selectedTask = { ...this.selectedTask, notesLog };
      this.newNoteText = '';
    } catch ( error: any ) {
      this.noteError = error?.error?.message || error?.message || 'Unable to save that note.';
    } finally {
      this.isSavingNote = false;
    }
  }

  public canSave (): boolean {
    if ( this.isLoading ) return false;
    if ( !this.userId || this.userId === 'user not logged in' ) return false;
    if ( !this.editingTaskId && this.moveLimits && !this.moveLimits.isPaidUser && !this.moveLimits.canCreateMove ) return false;
    return !!this.newTaskTitle.trim();
  }

  private validateBeforeSave (): string | null {
    if ( !this.userId || this.userId === 'user not logged in' ) {
      return 'You can explore Moves freely. Log in to save your move.';
    }

    if ( !this.newTaskTitle.trim() ) {
      return 'Add a title before saving this move.';
    }

    if ( !this.editingTaskId && this.moveLimits && !this.moveLimits.isPaidUser && !this.moveLimits.canCreateMove ) {
      return 'You have used all 10 free moves. Upgrade to keep creating moves.';
    }

    return null;
  }

  public get moveLimitMessage (): string {
    const limit = this.moveLimits;
    if ( !limit || limit.isPaidUser ) return '';
    if ( limit.currentCount <= 0 ) return `${ limit.freeMoveLimit } free moves available`;
    if ( limit.remainingFreeMoves <= 0 ) return 'You have used all 10 free moves. Upgrade to keep creating moves.';
    return `${ limit.remainingFreeMoves } of ${ limit.freeMoveLimit } free moves left`;
  }

  private async loadMoveLimits (): Promise<void> {
    if ( !this.userId || this.userId === 'user not logged in' || this.editingTaskId ) {
      this.moveLimits = null;
      this.publishPageContext();
      return;
    }

    try {
      this.moveLimits = await this.taskService.getLimits();
    } catch ( error ) {
      this.logger.warn( 'Unable to load move limits', error );
      this.moveLimits = null;
    }

    this.publishPageContext();
  }

  private getSaveErrorMessage ( error: any ): string {
    const backendMessage = String(
      error?.error?.message
      || error?.error?.error
      || error?.message
      || ''
    ).trim();

    if ( backendMessage ) {
      return backendMessage;
    }

    if ( error?.status === 400 ) {
      return 'The move could not be saved because some data is invalid. Review the form and try again.';
    }

    if ( error?.status === 401 || error?.status === 403 ) {
      return 'You do not have permission to save this move.';
    }

    return 'Unable to save move.';
  }

  private normalizeTaskStatus ( value: string | null | undefined ): string {
    const normalized = String( value || '' ).trim().toLowerCase();

    switch ( normalized ) {
      case 'new':
      case 'not started':
      case 'not-started':
        return 'not-started';
      case 'in progress':
      case 'in-progress':
        return 'in-progress';
      case 'complete':
      case 'completed':
        return 'completed';
      case 'hold':
      case 'on hold':
      case 'on-hold':
        return 'on-hold';
      case 'canceled':
      case 'cancelled':
        return 'cancelled';
      default:
        return 'not-started';
    }
  }

  private normalizeTaskPriority ( value: string | null | undefined ): 'low' | 'medium' | 'high' | 'urgent' {
    const normalized = String( value || '' ).trim().toLowerCase();

    switch ( normalized ) {
      case 'low':
        return 'low';
      case 'high':
        return 'high';
      case 'urgent':
        return 'urgent';
      case 'medium':
      default:
        return 'medium';
    }
  }

  private optionalStringOrUndefined ( value: string | null | undefined ): string | undefined {
    const trimmed = String( value || '' ).trim();
    return trimmed ? trimmed : undefined;
  }

  private toDateTimeLocalValue ( value: string | null | undefined ): string {
    const raw = String( value || '' ).trim();
    if ( !raw ) return '';

    const localPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
    if ( localPattern.test( raw ) ) {
      return raw.slice( 0, 16 );
    }

    const parsed = new Date( raw );
    if ( Number.isNaN( parsed.getTime() ) ) {
      return '';
    }

    const year = parsed.getFullYear();
    const month = String( parsed.getMonth() + 1 ).padStart( 2, '0' );
    const day = String( parsed.getDate() ).padStart( 2, '0' );
    const hours = String( parsed.getHours() ).padStart( 2, '0' );
    const minutes = String( parsed.getMinutes() ).padStart( 2, '0' );

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private getSelectedContactIds (): string[] {
    return ( this.selectedContacts || [] )
      .map( ( contact: any ) => typeof contact === 'string' ? contact : contact?.id )
      .filter( Boolean ) as string[];
  }

  private getSelectedContactObjects (): Contact[] {
    const ids = new Set( this.getSelectedContactIds() );
    return this.contacts.filter( contact => !!contact.id && ids.has( String( contact.id ) ) );
  }

  ngOnInit (): void {

    this.isLoading = true;

    // Pre-hydrate from active task set by the cockpit before SPA navigation.
    // Guarded by route id match to avoid hydrating from a stale active task.
    const routeTaskId = this.route.snapshot.paramMap.get( 'id' );
    this.taskService.activeTask$.pipe( take( 1 ) ).subscribe( activeTask => {
      if ( activeTask && activeTask.id && activeTask.id === routeTaskId ) {
        this.hydrateFormFromTask( activeTask );
      }
    } );

    this.setupPage();

    this.signalSubscription = this.assistantBus.signalState$
      .subscribe( state => {
        this.toddSignalState = state;
      } );

    this.firebaseSubscription = this.authService.getUser().subscribe( firebaseUser => {
      if ( firebaseUser ) {
        this.uid = firebaseUser.uid;
      } else {
        this.uid = '';
      }
      void this.loadMoveLimits();
      this.publishPageContext();
    } );

  }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['selectedTask'] ) {
      this.hydrateFormFromTask( this.selectedTask );
      this.publishPageContext();
    }
  }

  reloadDropdowns (): void {
    if ( !this.userId || this.userId === 'user not logged in' ) {
      this.taskStatuses = this.taskStatusOptions.map( option => option.value );
      this.taskTypes = [];
      this.projects = [];
      this.publishPageContext();
      return;
    }

    const tenantId = this.authService.getTenant() || this.userId;

    const taskTypesRequest = from( this.dataService.getTaskTypes( tenantId ) ).pipe(
      map( ( taskTypes: Dropdown[] ) => taskTypes.map( taskType => ( {
        id: taskType.id,
        name: taskType.name
      } as TaskType ) ) ),
      map( ( items: TaskType[] ) =>
        items.sort( ( a, b ) =>
          a.name.localeCompare( b.name, undefined, { sensitivity: 'base' } )
        )
      )
    );

    const projectsRequest = from( this.dataService.getProjects( tenantId ) ).pipe(
      map( ( projects: Dropdown[] ) => projects.map( project => ( {
        id: project.id,
        name: project.name
      } as Project ) ) ),
      map( ( items: Project[] ) =>
        items.sort( ( a, b ) =>
          ( a.name || '' ).localeCompare( ( b.name || '' ), undefined, { sensitivity: 'base' } )
        )
      )
    );

    combineLatest( {
      taskTypes: taskTypesRequest,
      projects: projectsRequest
    } ).pipe( take( 1 ) ).subscribe( {
      next: ( result ) => {
        this.taskTypes = result.taskTypes;
        this.projects = result.projects;
        this.taskStatuses = this.taskStatusOptions.map( option => option.value );
        this.publishPageContext();
      },
      error: ( error ) => {
        this.logger.warn( 'Unable to reload dropdowns', error );
      }
    } );
  }
  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    if ( this.lookupSubscription ) this.lookupSubscription.unsubscribe();
    if ( this.routeSubscription ) this.routeSubscription.unsubscribe();
    if ( this.querySubscription ) this.querySubscription.unsubscribe();
    if ( this.signalSubscription ) this.signalSubscription.unsubscribe();
    if ( this.firebaseSubscription ) this.firebaseSubscription.unsubscribe();

  }

  private emitAssistantActivity ( action: string, meta?: Record<string, any> ): void {
    this.assistantBus.emitAssistantActivity( {
      feature: 'moves',
      page: 'task-edit',
      route: this.router.url,
      mode: this.editingTaskId ? 'edit' : 'create',
      action,
      summary: {
        isAuthenticated: this.hasAuthenticatedUser(),
        interactionMode: this.hasAuthenticatedUser() ? 'member' : 'guest',
        hasTitle: !!this.newTaskTitle,
        hasDescription: !!this.newTaskDescription,
        hasDueDate: !!this.newTaskDueDate,
        selectedContactCount: this.selectedContacts.length,
        attachedDocumentCount: this.attachedDocuments.length,
        imageCount: this.images.length,
        childTaskCount: this.childTasks.length,
        isSubTask: this.isSubTask,
        availableContacts: this.contacts.length,
        availableProjects: this.projects.length,
        availableTaskTypes: this.taskTypes.length,
        status: this.selectedStatus || 'not-started'
      },
      meta
    } );
  }

  loadParentTaskIdFromQuery (): void {
    if ( this.querySubscription ) {
      this.querySubscription.unsubscribe();
    }

    this.querySubscription = this.route.queryParamMap.subscribe( params => {
      this.parentTaskIdFromRoute = params.get( 'parentTaskId' ) || '';
      this.isSubTask = !!this.parentTaskIdFromRoute || !!this.selectedTask?.parentTaskId;
      if ( params.get( 'assignToTodd' ) === 'true' ) {
        this.isAIMission = true;
      }
      this.publishPageContext();
    } );
  }

  async loadChildTasks (): Promise<void> {
    const parentId = this.editingTaskId || '';

    if ( !this.userId || !parentId ) {
      this.childTasks = [];
      this.publishPageContext();
      this.emitAssistantActivity( 'move_child_tasks_checked', {
        parentMoveId: parentId,
        childTaskCount: this.childTasks.length
      } );
      this.emitAssistantActivity( 'move_child_tasks_checked', {
        parentMoveId: parentId,
        childTaskCount: 0
      } );
      return;
    }

    try {
      const tasks = await firstValueFrom( this.taskService.loadTasks( this.userId ).pipe( take( 1 ) ) );
      this.childTasks = ( tasks || [] )
        .filter( task => String( task.parentTaskId || '' ) === String( parentId ) )
        .sort( ( a, b ) => ( a.title || '' ).localeCompare( b.title || '', undefined, { sensitivity: 'base' } ) );
    } catch ( error ) {
      this.logger.warn( 'Unable to load child moves for parent move page', error );
      this.childTasks = [];
    }

    this.publishPageContext();
  }

  addSubTask (): void {
    const parentId = this.editingTaskId || '';
    if ( !parentId ) {
      return;
    }

    this.emitAssistantActivity( 'submove_create_started', {
      parentMoveId: parentId,
      childTaskCount: this.childTasks.length
    } );
    this.router.navigate( ['/move'], { queryParams: { parentTaskId: parentId } } );
  }

  openSubTask ( task: Task ): void {
    if ( task?.id ) {
      this.router.navigate( ['/move', task.id] );
    }
  }

  loadTaskFromRoute (): void {
    if ( this.routeSubscription ) {
      this.routeSubscription.unsubscribe();
    }

    this.logger.info( 'CHECK ID PASSED' );

    this.routeSubscription = this.route.paramMap.subscribe( async params => {
      const taskId = params.get( 'id' );
      this.logger.info( 'ID PASSED IS', taskId );

      if ( !taskId ) {
        this.resetForm();
        this.editingTaskId = undefined;
        void this.loadMoveLimits();
        this.publishPageContext();
        this.emitAssistantActivity( 'move_create_opened', {
          source: 'route_without_id'
        } );
        return;
      }

      if ( !this.userId || this.userId === 'user not logged in' ) {
        this.logger.warn( 'No userId available yet for route-based move load', this.userId );
        this.publishPageContext();
        this.emitAssistantActivity( 'move_create_opened', {
          source: 'route_waiting_for_user',
          moveId: taskId
        } );
        return;
      }

      this.isLoading = true;
      this.error = null;

      try {
        const task = await this.taskService.fetchTaskById( taskId, this.userId );
        this.logger.info( 'TASK RETRIEVED', task );

        if ( task ) {
          this.hydrateFormFromTask( task );
          this.moveLimits = null;
          await this.loadChildTasks();
          this.emitAssistantActivity( 'move_edit_opened', {
            source: 'route_with_id',
            moveId: taskId,
            childTaskCount: this.childTasks.length
          } );
          return;
        }

        this.logger.warn( 'No move found for route-based move load', {
          taskId,
          userId: this.userId
        } );
        this.resetForm();
        this.error = 'Move not found.';
        void this.loadMoveLimits();
        this.emitAssistantActivity( 'move_create_opened', {
          source: 'route_id_not_found',
          moveId: taskId
        } );
      } catch ( error ) {
        this.logger.error( 'Failed to load move from route', error );
        this.error = 'Unable to load move.';
      } finally {
        this.isLoading = false;
        this.publishPageContext();
      }
    } );
  }

  private hydrateFormFromTask ( task: Task | null ): void {
    if ( !task ) {
      this.resetForm();
      this.publishPageContext();
      return;
    }

    this.selectedTask = task;
    this.editingTaskId = task.id;
    this.newTaskTitle = task.title || '';
    this.newTaskDescription = task.description || '';
    this.newTaskDueDate = this.toDateTimeLocalValue( task.dueDate );
    this.images = task.images ? [...task.images] : [];
    this.attachedDocuments = task.documents ? [...task.documents] : [];
    this.startDate = this.toDateTimeLocalValue( task.startDate );
    this.timerEndTime = this.toDateTimeLocalValue( task.timerEndTime );
    this.timerStartTime = this.toDateTimeLocalValue( task.timerStartTime );
    this.selectedContacts = task.contacts ? [...task.contacts] : [];
    this.selectedAssigneeId = task.assigneeId || task.ownerId || this.userId;
    this.selectedTaskType = task.taskTypeId || '';
    this.selectedProject = task.projectId || '';
    this.selectedStatus = this.normalizeTaskStatus( task.status );
    this.isSubTask = !!task.parentTaskId || !!this.parentTaskIdFromRoute;
    this.selectedExistingDocument = '';
    this.uploadProgress = null;
    this.downloadURL = null;
    this.processing = false;
    this.error = null;
    this.selectedFile = null;
    this.publishPageContext();
  }

  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'moves',
      page: 'task-edit',
      route: this.router.url,
      mode: this.editingTaskId ? 'edit' : 'create',
      title: this.editingTaskId ? 'Edit Move' : 'Create Move',
      description: 'Create or edit a move and connect it to contacts, projects, and documents.',
      allowedActions: [
        'save_task',
        'cancel',
        'select_contacts',
        'select_project',
        'select_task_type',
        'attach_document'
      ],
      selectedEntityType: 'task',
      selectedEntityId: this.editingTaskId || '',
      summary: {
        isAuthenticated: !!this.userId && this.userId !== 'user not logged in',
        interactionMode: !!this.userId && this.userId !== 'user not logged in' ? 'member' : 'guest',
        hasTitle: !!this.newTaskTitle,
        hasDescription: !!this.newTaskDescription,
        hasDueDate: !!this.newTaskDueDate,
        selectedContactCount: this.selectedContacts.length,
        attachedDocumentCount: this.attachedDocuments.length,
        imageCount: this.images.length,
        childTaskCount: this.childTasks.length,
        isSubTask: this.isSubTask,
        availableContacts: this.contacts.length,
        availableProjects: this.projects.length,
        availableTaskTypes: this.taskTypes.length
      },
      dataPreview: {
        title: this.newTaskTitle || '',
        status: this.selectedStatus || 'not-started',
        taskTypeId: this.selectedTaskType || '',
        projectId: this.selectedProject || '',
        parentTaskId: this.selectedTask?.parentTaskId || this.parentTaskIdFromRoute || ''
      }
    } );
  }

  buildTaskPayload (): Task {
    return {
      id: this.editingTaskId,
      title: this.newTaskTitle,
      description: this.newTaskDescription,
      dueDate: this.newTaskDueDate,
      progress: this.selectedTask?.progress ?? 0,
      status: this.normalizeTaskStatus( this.selectedStatus ),
      priority: this.normalizeTaskPriority( this.selectedTask?.priority || 'medium' ),
      isCompleted: this.selectedTask?.isCompleted ?? false,
      needsAttention: this.selectedTask?.needsAttention ?? false,
      contactIds: this.getSelectedContactIds(),
      contacts: this.getSelectedContactObjects(),
      subTasks: this.selectedTask?.subTasks ? [...this.selectedTask.subTasks] : [],
      taskTypeId: this.optionalStringOrUndefined( this.selectedTaskType ),
      projectId: this.optionalStringOrUndefined( this.selectedProject ),
      parentTaskId: this.optionalStringOrUndefined( this.selectedTask?.parentTaskId || this.parentTaskIdFromRoute ),
      startDate: this.optionalStringOrUndefined( this.startDate ),
      timerEndTime: this.optionalStringOrUndefined( this.timerEndTime ),
      timerStartTime: this.optionalStringOrUndefined( this.timerStartTime ),
      documents: [...this.attachedDocuments],
      images: [...this.images],
      extensionDays: this.selectedTask?.extensionDays ?? 0,
      createdAt: this.selectedTask?.createdAt || '',
      updatedAt: this.selectedTask?.updatedAt || '',
      ownerId: this.selectedTask?.ownerId || '',
      assigneeId: this.selectedAssigneeId || this.userId,
      tenantId: this.selectedTask?.tenantId || '',
      url: this.selectedTask?.url || '',
      timeToComplete: this.selectedTask?.timeToComplete
    } as Task;
  }

  private buildUpdatePayload (): Partial<Task> {
    const payload = this.buildTaskPayload();

    return {
      title: payload.title,
      description: payload.description,
      dueDate: payload.dueDate,
      progress: payload.progress,
      status: payload.status,
      priority: payload.priority,
      isCompleted: payload.isCompleted,
      needsAttention: payload.needsAttention,
      contactIds: payload.contactIds,
      contacts: payload.contacts,
      subTasks: payload.subTasks,
      taskTypeId: payload.taskTypeId,
      projectId: payload.projectId,
      parentTaskId: payload.parentTaskId,
      startDate: payload.startDate,
      timerEndTime: payload.timerEndTime,
      timerStartTime: payload.timerStartTime,
      documents: payload.documents,
      images: payload.images,
      extensionDays: payload.extensionDays,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      ownerId: payload.ownerId,
      assigneeId: payload.assigneeId,
      tenantId: payload.tenantId,
      url: payload.url,
      timeToComplete: payload.timeToComplete
    };
  }

  private async saveAIMission (): Promise<void> {
    if ( !this.newTaskTitle.trim() ) {
      this.error = 'A mission title is required before saving.';
      this.notificationService.show( 'Save Notice', this.error, 'warning' );
      return;
    }
    this.error = null;
    this.isLoading = true;
    try {
      const mission = await firstValueFrom(
        this.aiMissionService.createAIMission( {
          title: this.newTaskTitle.trim(),
          objective: this.missionObjective.trim(),
          successCriteria: this.missionSuccessCriteria.trim(),
          missionContext: this.missionContextText.trim() ? { notes: this.missionContextText.trim() } : {},
          priority: 'medium',
        } )
      );
      this.isLoading = false;
      this.notificationService.show( 'AI Mission Created', 'TODD will start working on it.', 'success' );
      this.router.navigate( ['/move', mission.id, 'mission'] );
    } catch ( error ) {
      this.isLoading = false;
      this.error = this.getSaveErrorMessage( error );
      this.notificationService.show( 'Save Failed', this.error, 'error' );
    }
  }

  async onSave (): Promise<void> {
    // AI Mission path — create via AiMissionApiService, leave existing Task flow untouched
    if ( this.isAIMission && !this.editingTaskId ) {
      await this.saveAIMission();
      return;
    }

    this.publishPageContext();
    this.emitAssistantActivity( 'move_save_attempt', {
      mode: this.editingTaskId ? 'edit' : 'create'
    } );

    const validationMessage = this.validateBeforeSave();
    if ( validationMessage ) {
      this.error = validationMessage;
      this.notificationService.show( 'Save Notice', validationMessage, 'warning' );
      return;
    }

    this.error = null;
    this.isLoading = true;

    try {
      const payload = this.buildTaskPayload();

      if ( this.editingTaskId ) {
        await this.taskService.updateTask( this.editingTaskId, this.buildUpdatePayload(), this.userId );
        await this.loadChildTasks();
        this.emitAssistantActivity( 'move_saved', {
          moveId: this.editingTaskId,
          moveTitle: payload.title || '',
          status: payload.status || 'not-started'
        } );
        this.notificationService.show( 'Move Updated', 'Your move was updated successfully.', 'success' );
      } else {
        const saved = await this.taskService.addTask( payload, this.userId );
        this.editingTaskId = saved.id;
        this.hydrateFormFromTask( saved );
        await this.loadChildTasks();
        this.emitAssistantActivity( 'move_created', {
          moveId: saved?.id ? String( saved.id ) : '',
          moveTitle: saved?.title || '',
          status: saved?.status || 'not-started'
        } );
        this.notificationService.show( 'Move Saved', 'Your move was saved successfully.', 'success' );
      }

      this.isLoading = false;
      this.saveAction.emit( this.buildTaskPayload() );
    } catch ( error ) {
      this.isLoading = false;
      this.error = this.getSaveErrorMessage( error );
      this.notificationService.show( 'Save Failed', this.error, 'error' );
      console.error( 'Task save failed', error );
    }
  }

  async onDelete (): Promise<void> {
    this.publishPageContext();
    this.emitAssistantActivity( 'move_delete_attempt', {
      moveId: this.editingTaskId || '',
      childTaskCount: this.childTasks.length
    } );

    if ( !this.userId || this.userId === 'user not logged in' ) {
      this.notificationService.show( "Delete Notice", 'You can explore Moves freely. Log in to delete a move.', 'warning' );
      return;
    }

    if ( !this.editingTaskId ) {
      return;
    }

    if ( this.childTasks && this.childTasks.length > 0 ) {
      this.error = 'Delete subtasks before deleting this parent move.';
      return;
    }

    this.isLoading = true;

    try {
      const deletedId = this.editingTaskId;
      await this.taskService.deleteTask( deletedId, this.userId );
      this.emitAssistantActivity( 'move_deleted', {
        moveId: deletedId
      } );
      this.isLoading = false;
      this.resetForm();
      this.deleteAction.emit( deletedId );
      this.router.navigate( ['/moves'] );
    } catch ( error ) {
      this.isLoading = false;
      this.error = 'Unable to delete move.';
      console.error( 'Task delete failed', error );
    }
  }

  onCancel (): void {
    this.publishPageContext();
    this.cancelAction.emit();
    this.router.navigate( ['/moves-view'] );
  }

  resetForm (): void {
    this.selectedTask = null;
    this.editingTaskId = undefined;
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskDueDate = '';
    this.images = [];
    this.attachedDocuments = [];
    this.isSubTask = !!this.parentTaskIdFromRoute;
    this.startDate = '';
    this.timerEndTime = '';
    this.timerStartTime = '';
    this.selectedContacts = [];
    this.selectedAssigneeId = this.userId || '';
    this.selectedTaskType = '';
    this.selectedProject = '';
    this.selectedStatus = 'not-started';
    this.selectedExistingDocument = '';
    this.uploadProgress = null;
    this.downloadURL = null;
    this.processing = false;
    this.error = null;
    this.selectedFile = null;
    this.childTasks = [];
    this.moveLimits = null;
    this.publishPageContext();
  }

  setupPage () {
    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId;
      this.loadParentTaskIdFromQuery();

      if ( !this.userId || this.userId === 'user not logged in' ) {
        this.contacts = [];
        this.taskStatuses = this.taskStatusOptions.map( option => option.value );
        this.taskTypes = [];
        this.projects = [];
        this.documents = [];
        this.childTasks = [];
        this.isLoading = false;
        this.loadTaskFromRoute();
        void this.loadMoveLimits();
        this.publishPageContext();
        return;
      }

      if ( this.lookupSubscription ) {
        this.lookupSubscription.unsubscribe();
      }

      const tenantId = this.authService.getTenant() || this.userId;

      const contactsRequest = from( this.dataService.getContacts( tenantId ) ).pipe(
        map( ( contacts: any[] ) => contacts.map( contact => ( {
          id: contact.id,
          firstName: contact.firstName || 'no first name',
          lastName: contact.lastName || 'no last name',
          email: contact.email
        } as Contact ) ) ),
        map( contacts => contacts.sort( ( a, b ) => a.lastName!.localeCompare( b.lastName! ) ) ),
        timeout( 5000 ),
        catchError( () => of( [] as Contact[] ) )
      );

      const assigneesRequest = combineLatest( {
        members: this.adminControlService.getTenantMembers$( tenantId ).pipe(
          timeout( 5000 ),
          catchError( () => of( [] as AppUser[] ) )
        ),
        owner: this.adminControlService.getTenantOwnerUser$( tenantId ).pipe(
          timeout( 5000 ),
          catchError( () => of( null as AppUser | null ) )
        )
      } ).pipe(
        map( result => {
          const currentUser: AppUser = {
            id: this.userId,
            email: '',
            displayName: 'You',
            role: 'admin',
            status: 'active'
          };
          return [result.owner, ...result.members, currentUser]
            .filter( ( user ): user is AppUser => !!user && user.status !== 'disabled' )
            .filter( ( user, index, list ) => list.findIndex( item => item.id === user.id ) === index )
            .sort( ( a, b ) => ( a.displayName || a.email ).localeCompare( b.displayName || b.email ) );
        } ),
        catchError( () => of( [] as AppUser[] ) )
      );

      const taskTypesRequest = from( this.dataService.getTaskTypes( tenantId ) ).pipe(
        map( ( taskTypes: Dropdown[] ) => taskTypes.map( taskType => ( {
          id: taskType.id,
          name: taskType.name
        } as TaskType ) ) ),
        map( ( items: TaskType[] ) =>
          items.sort( ( a, b ) =>
            a.name.localeCompare( b.name, undefined, { sensitivity: 'base' } )
          )
        ),
        timeout( 5000 ),
        catchError( () => of( [] as TaskType[] ) )
      );

      const projectsRequest = from( this.dataService.getProjects( tenantId ) ).pipe(
        map( ( projects: Dropdown[] ) => projects.map( project => ( {
          id: project.id,
          name: project.name
        } as Project ) ) ),
        map( ( items: Project[] ) =>
          items.sort( ( a, b ) =>
            ( a.name || '' ).localeCompare( ( b.name || '' ), undefined, { sensitivity: 'base' } )
          )
        ),
        timeout( 5000 ),
        catchError( () => of( [] as Project[] ) )
      );

      const documentsRequest = from( this.dataService.getDocuments( tenantId ) ).pipe(
        map( ( documents: any[] ) =>
          ( documents || [] ).map( d => d as Document )
        ),
        map( ( docs: Document[] ) =>
          docs.sort( ( a, b ) =>
            ( a.name || '' ).localeCompare( ( b.name || '' ), undefined, { sensitivity: 'base' } )
          )
        ),
        timeout( 5000 ),
        catchError( () => of( [] as Document[] ) )
      );

      this.lookupSubscription = combineLatest( {
        contacts: contactsRequest,
        assignees: assigneesRequest,
        taskTypes: taskTypesRequest,
        projects: projectsRequest,
        documents: documentsRequest
      } ).pipe( take( 1 ) ).subscribe( {
        next: ( result ) => {
          this.contacts = result.contacts;
          this.authorizedAssignees = result.assignees;
          if ( !this.selectedAssigneeId ) this.selectedAssigneeId = this.userId;
          this.taskStatuses = this.taskStatusOptions.map( option => option.value );
          this.taskTypes = result.taskTypes;
          this.projects = result.projects;
          this.documents = result.documents;
          this.isLoading = false;
          this.loadTaskFromRoute();
          void this.loadMoveLimits();
          this.publishPageContext();
        },
        error: () => {
          this.isLoading = false;
          this.loadTaskFromRoute();
          void this.loadMoveLimits();
          this.publishPageContext();
        }
      } );
    } );
  }
}
