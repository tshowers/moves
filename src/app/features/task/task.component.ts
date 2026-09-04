import { Component, OnInit, OnDestroy, Output, EventEmitter, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoggerService } from '../../services/logger.service';
import { Contact } from '../../models/contact.model';
import { MovesDataService } from '../../services/moves-data.service';
import { MovesAuthService } from '../../services/moves-auth.service';
import { Observable, Subscription, from, map, switchMap, take } from 'rxjs';
import { Task, TaskType } from '../../models/task.model';
import { TimelineComponent } from '../timeline/timeline.component';
import { MovesNomenclatureService } from '../../services/moves-nomenclature.service';
import { AppendYouPipe } from '../../pipes/append-you.pipe';
import { SoundService } from '../../services/sound.service';
import { TaskChecklistComponent } from '../task-checklist/task-checklist.component';
import { MovesEmailService } from '../../services/moves-email.service';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Image } from '../../models/image.model';
import { Document } from '../../models/docuttach.model';
import { SubTaskComponent } from '../sub-task/sub-task.component';
import { HorizontalTaskTimelineComponent } from '../horizontal-task-timeline/horizontal-task-timeline.component';
import { TaskNudgeService } from '../../services/task-nudge.service';
import { TaskApiService } from '../../services/task-api.service';
import { TopDogComponent } from '../../core/top-dog/top-dog.component';
import { MovesSettingsService } from '../../services/moves-settings.service';

import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { MovesTipService } from '../../services/moves-tip.service';
import { MovesNotificationService } from '../../services/moves-notification.service';
import { Dropdown } from '../../models/dropdown.model';
import { DropDownEditButtonComponent } from '../../shared/drop-down-edit-button/drop-down-edit-button.component';
import { MovesPageActionsService } from '../../services/moves-page-actions.service';
import { PageAction } from '../../models/page-actions.models';

type TaskResourceGuidance = {
  taskId: string;
  taskTitle: string;
  missing: Array<'contact' | 'project' | 'documents' | 'description'>;
  summary: string;
};

/**
 * Near-verbatim port of features/tasks/task/task.component.ts - the one
 * live component in this app that extends TopDogComponent. Service
 * renames only (AuthService -> MovesAuthService, DataService ->
 * MovesDataService, TaskService -> TaskApiService, EmailService ->
 * MovesEmailService, NotificationService -> MovesNotificationService,
 * TipService -> MovesTipService, PageActionsService ->
 * MovesPageActionsService, NomenclatureService -> MovesNomenclatureService,
 * SettingsService -> MovesSettingsService). UserService.getLoggedInContactInfo()
 * is inlined via MovesDataService.getContactFullByIdOnce(tenantId, uid) -
 * TODD's own implementation resolves to exactly that Firestore read
 * (`tenants/{tenantId}/contacts/{uid}`, confirmed against
 * user.service.ts's findTenantContactById), so no separate UserService
 * port was needed for the one method this component calls.
 * MovesDataService's dropdown/collection reads return Promises uniformly
 * (unlike DataService's Promise/Observable split), so all five are now
 * wrapped in `from()` rather than only the two that were Promises before.
 */
@Component( {
  selector: 'app-task',
  standalone: true,
  imports: [CommonModule, RouterModule, ToddTipComponent, FormsModule, TimelineComponent, AppendYouPipe, TaskChecklistComponent, SubTaskComponent, HorizontalTaskTimelineComponent,
    BackToTopComponent,
    PreloaderComponent,
    DropDownEditButtonComponent

  ],
  templateUrl: './task.component.html',
  styleUrl: './task.component.css'
} )
export class TaskComponent extends TopDogComponent implements OnInit, OnDestroy {
  @Output() tasksChanged: EventEmitter<Task[]> = new EventEmitter<Task[]>();
  @ViewChild( TimelineComponent ) timelineComponent!: TimelineComponent;
  @ViewChild( TaskChecklistComponent ) taskChecklistomponent!: TaskChecklistComponent;


  tasksNeedingAttention: Task[] = [];
  showNudgeModal = false;

  tasks: Task[] = [];
  newTaskTitle: string = '';
  newTaskDescription: string = '';
  newTaskDueDate?: string;
  editingTaskId?: string;
  images?: Image[] = [];
  documents?: Document[] = [];
  selectedTask!: Task;
  isSubTask: boolean = false;
  startDate!: any;
  timerEndTime!: any;
  timerStartTime!: any;
  private contactSubscription!: Subscription;
  private emailSubscription!: Subscription;
  showingHelp = false;


  nextId: number = 1;
  selectedContacts: string[] = [];
  userSubscription!: Subscription;

  contacts$: Observable<Contact[]> | undefined;
  taskTypes$: Observable<TaskType[]> | undefined;
  taskStatus$: Observable<Dropdown[]> | undefined;
  projects$: Observable<Dropdown[]> | undefined;
  documents$: Observable<Document[]> | undefined;
  selectedTaskType: any;
  selectedProject: any;
  selectedStatus!: string;
  selectedExistingDocument: Document | null = null;

  currentView: 'horizontalTimeline' | 'project' | 'analysis' | 'list' | 'timeline' | 'form' = 'timeline';
  loadContactsDetailsSubscription!: Subscription;
  loadContactDetailsForTaskSubscription!: Subscription;

  sender!: Contact;

  storage = getStorage();
  uploadProgress: number | null = null;
  downloadURL: string | null = null;
  processing: boolean = false;
  error: string | null = null;
  isHorizontalTime: boolean = false;
  isDisplayCheckList: boolean = true;

  taskTipText = '';
  taskResourceGuidance: TaskResourceGuidance | null = null;


  getUserSubscription!: Subscription;
  getTenantIdSubscription!: Subscription;

  constructor ( protected override authService: MovesAuthService,
    protected override settingsService: MovesSettingsService,
    protected override soundService: SoundService,
    protected override logger: LoggerService,
    protected override router: Router,
    protected override nomenclatureService: MovesNomenclatureService,
    private route: ActivatedRoute,
    private emailService: MovesEmailService,
    private taskService: TaskApiService,
    private taskNudgeService: TaskNudgeService,
    private notificationService: MovesNotificationService,
    private tipService: MovesTipService,
    private dataService: MovesDataService,
    private pageActionsService: MovesPageActionsService ) {
    super( authService, settingsService, soundService, logger, router, nomenclatureService );
  }

  override ngOnInit (): void {
    super.ngOnInit();
    this.readySubscription = this.ready$.subscribe( ( isReady ) => {
      this.logger.info( "TASK COMPONENT READY?", isReady );
      this.isLoading = true;
      if ( isReady ) this.setupTaskPage();
      this.taskTipText = this.tipService.getRandomTipText( 'tasks', 'tasks' );
    } );
  }

  override ngOnDestroy (): void {
    if ( this.loadContactsDetailsSubscription ) this.loadContactsDetailsSubscription.unsubscribe();
    if ( this.loadContactDetailsForTaskSubscription ) this.loadContactDetailsForTaskSubscription.unsubscribe();
    if ( this.contactSubscription ) this.contactSubscription.unsubscribe();
    if ( this.emailSubscription ) this.emailSubscription.unsubscribe();
    this.pageActionsService.clearPageActions( 'task-detail' );
  }

  setupTaskPage () {
    this.taskService.activeTask$.subscribe( task => {
      if ( task ) {
        this.selectedTask = task;
        const guidance = this.readTaskResourceGuidance();
        if ( guidance && String( guidance.taskId ) === String( task.id ) ) {
          this.taskResourceGuidance = guidance;
          this.editTask( task );
        }
      }
    } );

    this.userSubscription = this.authService.getUserId().pipe(
      switchMap( userId => {
        this.userId = userId;

        // Load ancillary data (contacts & dropdowns) as before
        this.contacts$ = from( this.dataService.getContacts( this.tenantId ) ).pipe(
          map( ( contacts: any[] ) => contacts.map( contact => ( {
            id: contact.id,
            firstName: contact.firstName || 'no first name',
            lastName: contact.lastName || 'no last name',
            email: contact.email
          } as Contact ) ) ),
          map( contacts => contacts.sort( ( a, b ) => a.lastName!.localeCompare( b.lastName! ) ) )
        );

        this.taskStatus$ = from( this.dataService.getTaskStatuses( this.tenantId ) ).pipe(
          map( ( taskStatus: any[] ) => taskStatus.map( status => ( {
            id: status.id,
            name: status.name
          } as Dropdown ) ) ),
          map( ( items: Dropdown[] ) =>
            items.sort( ( a, b ) =>
              a.name.localeCompare( b.name, undefined, { sensitivity: 'base' } )
            )
          )
        );

        this.taskTypes$ = from( this.dataService.getTaskTypes( this.tenantId ) ).pipe(
          map( ( taskTypes: any[] ) => taskTypes.map( taskType => ( {
            id: taskType.id,
            name: taskType.name
          } as TaskType ) ) ),
          map( ( items: TaskType[] ) =>
            items.sort( ( a, b ) =>
              a.name.localeCompare( b.name, undefined, { sensitivity: 'base' } )
            )
          )
        );

        this.projects$ = from( this.dataService.getProjects( this.tenantId ) ).pipe(
          map( ( projects: any[] ) => projects.map( project => ( {
            id: project.id,
            name: project.name
          } as Dropdown ) ) ),
          map( ( items: Dropdown[] ) =>
            items.sort( ( a, b ) =>
              a.name.localeCompare( b.name, undefined, { sensitivity: 'base' } )
            )
          )
        );

        this.documents$ = from( this.dataService.getDocuments( this.tenantId ) ).pipe(
          map( ( documents: any[] ) =>
            ( documents || [] ).map( d => d as Document )
          ),
          map( ( docs: Document[] ) =>
            docs.sort( ( a, b ) =>
              ( a.name || '' ).localeCompare( ( b.name || '' ), undefined, { sensitivity: 'base' } )
            )
          )
        );

        // Load tasks into TaskService store
        return this.taskService.loadTasks( this.userId );
      } )
    ).subscribe( {
      next: () => {
        // Subscribe to the store for render
        this.loadContactsDetailsSubscription = this.taskService.tasks$.subscribe( tasks => {
          this.tasks = tasks;
          this.loadContactDetails();
          this.checkActions();
          this.publishPageActions();
          this.isLoading = false;
        } );
      },
      error: ( e ) => {
        this.logger.error( e );
        this.isLoading = false;
      }
    } );

    this.senderInfo();
  }

  suggestTasks ( param: any ) {
    const suggested = this.taskService.suggestTasks( this.tasks, param );
    this.tasks = suggested;
    this.notificationService.show( "Suggested Tasks", `Here are ${suggested.length} suggested task(s).`, 'success' );
  }

  async checkTasks () {
    this.logger.info( "CHECK TASKS" );
    this.tasksNeedingAttention = await this.taskNudgeService.checkForTaskNudges( this.userId, this.tasks );
    this.logger.info( "TASKS CHECKED - NEEDING ATTENTION", this.tasksNeedingAttention );

    // Always keep the modal in sync with the current result set
    this.showNudgeModal = this.tasksNeedingAttention.length > 0;
  }

  onCloseNudgeModal () {
    this.showNudgeModal = false;
  }

  filterTasksDueToday () {
    const today = new Date().toISOString().split( 'T' )[0];
    const matchingTasks = this.tasks.filter( task => {
      return task.dueDate?.startsWith( today );
    } );

    this.tasks = matchingTasks;
    this.notificationService.show( "Today’s Tasks", `Found ${matchingTasks.length} task(s) due today.`, 'success' );
    this.publishPageActions();
    window.scrollTo( 0, 0 );

  }

  senderInfo (): void {
    this.getUserSubscription = this.authService.getUser().subscribe( user => {
      if ( user ) {
        this.dataService.getContactFullByIdOnce( this.tenantId, user.uid ).then( contact => {
          if ( contact ) {
            this.sender = contact;
          }
          else {
            this.logger.warn( "No Contact Returned" );
          }
        } );
      }
    } );
  }

  addOrEditTask () {
    if ( !this.newTaskTitle.trim() ) {
      return; // Prevent creating blank tasks
    }

    // If an existing document from the repository was selected,
    // attach it to this.documents (avoiding duplicates).
    if ( this.selectedExistingDocument ) {
      const exists = ( this.documents || [] ).some( d => d.src === this.selectedExistingDocument!.src );
      if ( !exists ) {
        this.documents = this.documents || [];
        this.documents.push( this.selectedExistingDocument );
      }
      this.selectedExistingDocument = null;
    }

    const taskData: Task = {
      id: this.editingTaskId,
      title: this.newTaskTitle || '',
      description: this.newTaskDescription || '',
      dueDate: this.newTaskDueDate || new Date().toISOString(),
      progress: 0,
      isEditing: false,
      isCompleted: false,
      contactIds: this.selectedContacts || [],
      status: this.selectedStatus || 'todo',
      contacts: [],
      subTasks: this.selectedTask?.subTasks || [],
      taskTypeId: this.selectedTaskType || '',
      projectId: this.selectedProject || '',
      documents: this.documents || [],
      images: this.images || [],
      startDate: this.startDate || new Date().toISOString(),
      timerEndTime: this.timerEndTime || '',
      timerStartTime: this.timerStartTime || ''
    };

    if ( !taskData.description )
      taskData.description = '';

    if ( !taskData.priority )
      taskData.priority = 'Medium';

    if ( this.editingTaskId ) {
      const task = this.tasks.find( t => t.id === this.editingTaskId );
      if ( task ) {
        Object.assign( task, taskData );
        this.taskService.updateTask( task.id, task, this.userId ).then( () => {
          this.notificationService.show( "Updated!", 'Task record: ' + task.id + ' updated. ' + task.title, 'success' );
          this.timelineComponent.updateTimeLine( this.tasks );
          this.taskChecklistomponent.updateTasks( this.tasks );
        } ).catch( error => {
          this.logger.error( error );
          this.notificationService.show( "Error!", 'Task record: ' + task.id + ' failed to update. ' + task.title, 'error' );
        } );
      }
      this.editingTaskId = undefined;
    } else {
      this.taskService.addTask( taskData, this.userId ).then( saved => {
        if ( this.timelineComponent ) this.timelineComponent.updateTimeLine( this.tasks );
        if ( this.taskChecklistomponent ) this.taskChecklistomponent.updateTasks( this.tasks );
        this.loadContactDetailsForTask( saved );
        this.notificationService.show( "Updated!", 'Task record: ' + saved.id + ' added. ' + saved.title, 'success' );
        window.scrollTo( 0, 0 );

        // Send add task email (unchanged behavior)
        this.contacts$?.pipe( take( 1 ) ).subscribe( filteredContacts => {
          const matching = filteredContacts.filter( c => taskData.contactIds?.includes( c.id ? c.id : '' ) );
          this.emailService.sendTaskEmails( 'Add', saved, matching, this.sender, this.tenantId, this.userId ).subscribe();
        } );
      } ).catch( error => {
        this.logger.error( 'Error adding Task:', error );
        this.notificationService.show( "Error!", 'Failed to add Task record:' + error, 'error' );
        setTimeout( () => {
          this.router.navigate( ['/error'] );
        }, 3000 );
      } );
    }
    this.tasksChanged.emit( this.tasks );
    this.dismissTaskResourceGuidance();
    this.resetForm();
    this.publishPageActions();
    setTimeout( () => {
      this.sortTasks();
      this.soundService.playSound( "finished" );
      window.scrollTo( 0, 0 );
    }, 1000 );
  }

  onTimeLineSelect ( task: Task ) {
    this.selectedTask = task;
    this.publishPageActions();
  }

  editTask ( task: Task ) {
    this.isSubTask = false;
    this.selectedTask = task;
    this.newTaskTitle = task.title;
    this.startDate = task.startDate || new Date().toISOString();
    this.timerEndTime = task.timerEndTime || '',
      this.timerStartTime = task.timerStartTime || '',
      this.newTaskDescription = task.description || '';
    this.newTaskDueDate = task.dueDate || new Date().toISOString();
    this.selectedContacts = task.contactIds || [];
    this.selectedTaskType = task.taskTypeId || '';
    this.selectedStatus = task.status || 'todo';
    this.selectedProject = task.projectId || '';
    this.editingTaskId = task.id;
    this.images = ( task.images ) ? task.images : [];
    this.documents = ( task.documents ) ? task.documents : [];
    this.tasksChanged.emit( this.tasks );

    if ( this.timelineComponent ) this.timelineComponent.updateTimeLine( this.tasks );

    this.switchView( 'form' );
    this.publishPageActions();
    window.scrollTo( { top: 0, behavior: 'smooth' } );
  }

  toggleProgressEdit ( task: Task ) {
    task.isEditing = !task.isEditing;
  }

  updateProgress ( task: Task, progress: number ) {
    task.progress = progress;
    task.isEditing = false;
    if ( progress === 100 ) {
      task.isCompleted = true;
    } else {
      task.isCompleted = false;
    }
    this.tasksChanged.emit( this.tasks );
    this.timelineComponent.updateTimeLine( this.tasks );
    if ( !task.description )
      task.description = '';

    if ( !task.priority )
      task.priority = 'Medium';

    this.taskService.updateTask( task.id, task, this.userId ).then( () => {
      this.notificationService.show( "Updated!", 'Task record: ' + task.id + ' updated. ' + task.title, 'success' );
      this.publishPageActions();
    } );

    setTimeout( () => this.sortTasks(), 1000 );
  }

  updateTask ( task: Task ) {
    this.taskService.updateTask( task.id, task, this.userId ).then( () => {
      this.notificationService.show( 'Task Update', `Task '${task.title}' updated.`, 'success' );
      this.tasksChanged.emit( this.tasks );
      if ( this.timelineComponent ) this.timelineComponent.updateTimeLine( this.tasks );
      if ( this.taskChecklistomponent ) this.taskChecklistomponent.updateTasks( this.tasks );
      this.publishPageActions();
    } ).catch( error => {
      this.logger.error( 'Task update failed', error );
      this.notificationService.show( 'Error!', `Failed to update task '${task.title}'.`, 'error' );
    } );
  }

  completeTask ( task: Task ) {
    task.progress = 100;
    task.isCompleted = true;
    if ( !task.description )
      task.description = '';

    if ( !task.priority )
      task.priority = 'Medium';

    this.taskService.updateTask( task.id, task, this.userId ).then( () => {
      this.notificationService.show( "Updated!", 'Task record: ' + task.id + ' updated. ' + task.title, 'success' );
      window.scrollTo( 0, 0 );
    } );
    this.tasksChanged.emit( this.tasks );
    this.timelineComponent.updateTimeLine( this.tasks );
    setTimeout( () => this.sortTasks(), 1000 );
  }

  resetForm () {
    this.isSubTask = false;

    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskDueDate = undefined;
    this.selectedContacts = [];
    this.selectedTaskType = '';
    this.selectedProject = '';
    this.editingTaskId = undefined;
    this.selectedStatus = 'todo';
    this.startDate = undefined,
      this.timerEndTime = undefined,
      this.timerStartTime = undefined,

      this.documents = [];
    this.images = [];
    this.selectedExistingDocument = null;
    this.downloadURL = null;
    this.publishPageActions();
  }

  dismissTaskResourceGuidance () {
    this.taskResourceGuidance = null;
    sessionStorage.removeItem( 'task-resource-guidance' );
  }

  deleteTask ( taskId: string ) {
    const confirmation = confirm( "Are you sure you want to delete this task?" );
    if ( confirmation ) {
      this.tasks = this.tasks.filter( t => t.id !== taskId );
      this.taskService.deleteTask( taskId, this.userId ).then( () => {
        this.notificationService.show( "Deleted!", 'Task ' + taskId + ' deleted.', 'error' );
      } );
      this.tasksChanged.emit( this.tasks );
      this.timelineComponent.updateTimeLine( this.tasks );
      this.isSubTask = false;
      this.publishPageActions();
    }
  }

  sortTasks () {
    this.tasks.sort( ( a, b ) => {
      if ( a.isCompleted && !b.isCompleted ) {
        return 1;
      } else if ( !a.isCompleted && b.isCompleted ) {
        return -1;
      } else {
        return 0;
      }
    } );
  }

  loadContactDetails () {
    // Use the existing contacts$ observable to avoid per-task network calls.
    this.contacts$?.pipe( take( 1 ) ).subscribe( ( allContacts: Contact[] ) => {
      const byId = new Map( ( allContacts || [] ).filter( c => !!c?.id ).map( c => [c.id as string, c] ) );
      this.tasks.forEach( task => {
        const ids = task.contactIds || [];
        task.contacts = ids.map( id => byId.get( id! ) ).filter( Boolean ) as Contact[];
      } );
    } );
  }

  loadContactDetailsForTask ( task: Task ) {
    const ids = task.contactIds || [];
    if ( !ids.length ) return;

    this.contacts$?.pipe( take( 1 ) ).subscribe( ( allContacts: Contact[] ) => {
      const byId = new Map( ( allContacts || [] ).filter( c => !!c?.id ).map( c => [c.id as string, c] ) );
      task.contacts = ids.map( id => byId.get( id! ) ).filter( Boolean ) as Contact[];
    } );
  }

  switchView ( view: 'analysis' | 'list' | 'timeline' | 'form' ) {
    if ( this.taskChecklistomponent ) {
      this.soundService.playSound( "click" );
      this.taskChecklistomponent.updateTasks( this.tasks );
    }
    this.currentView = view;

    this.isDisplayCheckList = ( view === 'list' ) ? false : true;
    this.publishPageActions();

  }



  formatPhoneNumber ( phoneNumber: string ): string {
    const cleaned = phoneNumber.replace( /\D+/g, '' );
    if ( cleaned.length === 10 ) {
      return `${cleaned.slice( 0, 3 )}.${cleaned.slice( 3, 6 )}.${cleaned.slice( 6 )}`;
    } else {
      return phoneNumber;
    }
  }

  onFileSelect ( event: Event ) {
    const input = event.target as HTMLInputElement;
    if ( input.files && input.files.length > 0 ) {
      this.uploadFile( input.files[0] );
    }
  }

  onDrop ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
    this.removeDragData( event );
    if ( event.dataTransfer && event.dataTransfer.files.length > 0 ) {
      this.uploadFile( event.dataTransfer.files[0] );
    }
  }

  onDragOver ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer!.dropEffect = 'copy';
  }

  onDragLeave ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
  }

  removeDragData ( event: DragEvent ) {
    if ( event.dataTransfer ) {
      event.dataTransfer.clearData();
    }
  }

  uploadFile ( file: File ) {
    const folder = this.userId ? `uploads/${this.userId}` : `uploads`;
    const storageRef = ref( this.storage, `${folder}/${file.name}` );
    const uploadTask = uploadBytesResumable( storageRef, file );
    this.processing = true;

    uploadTask.on( 'state_changed',
      ( snapshot ) => {
        this.uploadProgress = ( snapshot.bytesTransferred / snapshot.totalBytes ) * 100;
      },
      ( error ) => {
        this.error = error.message;
        this.processing = false;
        this.logger.error( 'Upload error:', error );
      },
      () => {
        getDownloadURL( uploadTask.snapshot.ref ).then( ( downloadURL ) => {
          this.downloadURL = downloadURL;
          this.processing = false;

          const uploadDate = new Date().toISOString();
          if ( file.type.startsWith( 'image/' ) ) {
            const image: Image = {
              src: downloadURL,
              alt: file.name,
            };
            this.images?.push( image );
          } else {
            const document: Document = {
              src: downloadURL,
              name: file.name,
              type: 'document',
              uploadDate: uploadDate,
            };
            this.documents?.push( document );
          }
          this.uploadProgress = null;
        } );
      }
    );
  }

  onSubTasksCreated ( subTasks: Task[] ) {
    // Handle the created subtasks
    this.selectedTask.subTasks = subTasks;
  }

  toggleTaskType () {
    window.scrollTo( { top: 0, behavior: 'smooth' } );
    this.isSubTask = !this.isSubTask;
  }

  toggleHorizontalTimeLine () {
    this.isHorizontalTime = !this.isHorizontalTime;
  }


  handleUpdateProgress ( event: { task: Task, progress: number; } ) {
    this.updateProgress( event.task, event.progress );
  }

  handleCompleteTask ( task: Task ) {
    this.completeTask( task );
  }

  handleExtendDueDate ( event: { task: Task, daysToAdd: number; } ) {
    if ( event.task.dueDate ) {
      const currentDueDate = new Date( event.task.dueDate );
      const newDueDate = new Date( currentDueDate.getTime() + ( event.daysToAdd * 24 * 60 * 60 * 1000 ) ); // user-selected days
      event.task.dueDate = newDueDate.toISOString();
      this.updateTask( event.task );
    }
  }

  suggestDelegationCandidate () {
    const candidate = this.tasks.find( task =>
      ( !task.contactIds || task.contactIds.length === 0 ) &&
      !task.isCompleted &&
      ( !task.priority || task.priority.toLowerCase() === 'low' )
    );

    if ( candidate ) {
      this.notificationService.show( "Delegation Suggestion", `Task “${candidate.title}” looks like a good one to delegate.`, 'success' );
      this.editTask( candidate ); // Optional: Pre-load it for reassignment
    } else {
      this.notificationService.show( "No Candidate Found", "Couldn’t find a delegation candidate.", 'warning' );
    }
  }

  findDuplicateTasks () {
    const titleMap = new Map<string, Task[]>();

    this.tasks.forEach( task => {
      const normalizedTitle = task.title.trim().toLowerCase();
      if ( !titleMap.has( normalizedTitle ) ) {
        titleMap.set( normalizedTitle, [] );
      }
      titleMap.get( normalizedTitle )!.push( task );
    } );

    const duplicates = Array.from( titleMap.values() ).filter( group => group.length > 1 ).flat();

    if ( duplicates.length > 0 ) {
      this.tasks = duplicates;
      this.notificationService.show( "Duplicate Tasks", `${duplicates.length} potential duplicates found.`, 'success' );
    } else {
      this.notificationService.show( "No Duplicates", "No duplicate tasks found.", 'success' );
    }
  }

  showMetrics ( param: any ) {
    if ( param.metric === 'averageProgress' ) {
      const validTasks = this.tasks.filter( task => typeof task.progress === 'number' );
      const totalProgress = validTasks.reduce( ( sum, task ) => sum + ( task.progress ?? 0 ), 0 );
      const average = validTasks.length > 0 ? ( totalProgress / validTasks.length ) : 0;
      this.notificationService.show( "Average Progress", `Your tasks are ${average.toFixed( 1 )}% complete on average.`, 'success' );
    }

    if ( param.metric === 'averageCompletionTime' ) {
      const completedTasks = this.tasks.filter( task =>
        task.progress === 100 &&
        task.startDate &&
        task.dueDate
      );

      const durations = completedTasks
        .filter( task => task.startDate && task.dueDate )
        .map( task => {
          const start = new Date( task.startDate! ).getTime();
          const end = new Date( task.dueDate! ).getTime();
          return ( end - start ) / ( 1000 * 60 * 60 * 24 ); // days
        } );

      const total = durations.reduce( ( sum, days ) => sum + days, 0 );
      const average = durations.length > 0 ? ( total / durations.length ) : 0;
      this.notificationService.show( "Average Completion Time", `Average completion time is ${average.toFixed( 1 )} day(s).`, 'success' );
    }
  }

  applyFilters ( params: any ): void {
    this.tasks = this.taskService.applyFilters( this.tasks, params, this.sender?.id );
    this.notificationService.show( "Filtered Tasks", `Showing ${this.tasks.length} task(s) based on filters.`, 'success' );
    this.publishPageActions();
  }

  checkActions () {
    const metricsParam = sessionStorage.getItem( 'task-metrics-request' );
    const suggestionParam = sessionStorage.getItem( 'task-suggested-action' );
    const delegationFlag = sessionStorage.getItem( 'task-delegation-suggestion' );
    const duplicateFlag = sessionStorage.getItem( 'task-duplicate-check' );
    const newTaskFromAssistant = sessionStorage.getItem( 'assistant-task-to-add' );

    this.logger.debug( "checkActions()" );
    this.logger.debug( "metricsParam", metricsParam );
    this.logger.debug( "suggestionParam", suggestionParam );
    this.logger.debug( "delegationFlag", delegationFlag );
    this.logger.debug( "duplicateFlag", duplicateFlag );
    this.logger.debug( "newTaskFromAssistant", newTaskFromAssistant );

    if ( metricsParam ) {
      const param = JSON.parse( metricsParam );
      sessionStorage.removeItem( 'task-metrics-request' );
      this.showMetrics( param );
      return;
    }

    if ( suggestionParam ) {
      const param = JSON.parse( suggestionParam );
      sessionStorage.removeItem( 'task-suggested-action' );
      this.suggestTasks( param );
      return;
    }

    if ( delegationFlag ) {
      sessionStorage.removeItem( 'task-delegation-suggestion' );
      this.suggestDelegationCandidate();
      return;
    }

    if ( duplicateFlag ) {
      sessionStorage.removeItem( 'task-duplicate-check' );
      this.findDuplicateTasks();
      return;
    }

    if ( newTaskFromAssistant ) {
      sessionStorage.removeItem( 'assistant-task-to-add' );


      this.addOrEditTask();
      return;
    }

    this.route.queryParams.subscribe( params => {
      const hasParams = Object.keys( params ).length > 0;
      if ( !hasParams ) {
        this.tasks = this.tasks.filter( task =>
          !task.isCompleted &&
          task.status !== 'archived' &&
          task.status !== 'stale'
        );
        this.checkTasks();
      } else {
        this.applyFilters( params );
      }
    } );
  }

  clearTaskFilters () {
    // TODD's own legacy 'tasks' route redirects to the execution board -
    // this app keeps that same destination at /moves-view (see app.routes.ts).
    this.router.navigate( ['/moves-view'], { replaceUrl: true } );
    this.publishPageActions();
  }

  showHelp () {
    this.showingHelp = true;
  }

  private readTaskResourceGuidance (): TaskResourceGuidance | null {
    try {
      const raw = sessionStorage.getItem( 'task-resource-guidance' );
      return raw ? JSON.parse( raw ) as TaskResourceGuidance : null;
    } catch {
      return null;
    }
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'task-detail',
      context: {
        pageId: 'task-detail',
        feature: 'moves',
        entityType: 'task',
        entityId: this.selectedTask?.id || this.editingTaskId || '',
        mode: this.currentView,
        extra: {
          taskCount: this.tasks.length,
          currentView: this.currentView,
          editingTaskId: this.editingTaskId || '',
          selectedTaskId: this.selectedTask?.id || '',
          hasActiveFilters: Object.keys( this.route.snapshot.queryParams || {} ).length > 0
        }
      },
      actions: this.buildPageActions()
    } );
  }

  private buildPageActions (): PageAction[] {
    const hasActiveFilters =
      Object.keys( this.route.snapshot.queryParams || {} ).length > 0;

    return [
      {
        id: 'task-detail-create',
        label: this.editingTaskId ? 'New Task' : 'Create Task',
        icon: 'fa-solid fa-square-plus',
        title: 'Create a task record.',
        kind: 'callback',
        group: 'context',
        order: 20,
        handler: () => {
          this.resetForm();
          this.switchView( 'form' );
        }
      },
      {
        id: 'task-detail-timeline',
        label: 'Timeline',
        icon: 'fa-solid fa-calendar-days',
        kind: 'callback',
        group: 'context',
        order: 30,
        disabled: () => this.currentView === 'timeline',
        handler: () => this.switchView( 'timeline' )
      },
      {
        id: 'task-detail-list',
        label: 'Task List',
        icon: 'fa-solid fa-list-check',
        kind: 'callback',
        group: 'context',
        order: 40,
        disabled: () => this.currentView === 'list',
        handler: () => this.switchView( 'list' )
      },
      {
        id: 'task-detail-clear-filters',
        label: 'Clear Filters',
        icon: 'fa-solid fa-filter-circle-xmark',
        kind: 'callback',
        group: 'context',
        order: 50,
        visible: () => hasActiveFilters,
        handler: () => this.clearTaskFilters()
      },
    ];
  }

}
