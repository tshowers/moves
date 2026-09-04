import { Injectable } from '@angular/core';
import { Task, EmployeeActionNoteEntry } from '../models/task.model';
import { LoggerService } from './logger.service';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

export interface MoveLimits {
  isPaidUser: boolean;
  currentCount: number;
  freeMoveLimit: number;
  remainingFreeMoves: number;
  canCreateMove: boolean;
}

/**
 * Near-verbatim port of services/task.service.ts (336 lines, pure
 * HttpClient against `${backendURL}/moves`, no Firestore/framework
 * coupling) - only rename is TaskService -> TaskApiService and the
 * import of EmployeeActionNoteEntry moves from features/employees/
 * models/employee.models to task.model.ts, where it's now inlined (see
 * task.model.ts's doc comment). Backend endpoints unchanged - see
 * todd-backend/functions/movesRoutes.js + moves/moves.service.js.
 */
@Injectable( {
  providedIn: 'root'
} )
export class TaskApiService {

  private readonly baseUrl = `${environment.backendURL}/moves`;

  private tasksSubject = new BehaviorSubject<Task[]>( [] );
  tasks$ = this.tasksSubject.asObservable();

  private activeTaskSubject = new BehaviorSubject<Task | null>( null );
  activeTask$ = this.activeTaskSubject.asObservable();

  constructor (
    private http: HttpClient,
    private logger: LoggerService
  ) { }

  private mapTaskRow ( row: any ): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      dueDate: row.dueDate || '',
      progress: row.progress ?? 0,
      status: row.status || 'not-started',
      priority: row.priority || 'medium',
      isCompleted: !!row.isCompleted,
      needsAttention: !!row.needsAttention,
      superseded: !!row.superseded,
      supersededAt: row.supersededAt || '',
      supersededReason: row.supersededReason || '',
      contactIds: row.contactIds || [],
      contacts: row.contacts || [],
      subTasks: row.subTasks || [],
      taskTypeId: row.taskTypeId || '',
      projectId: row.projectId || '',
      parentTaskId: row.parentTaskId || '',
      startDate: row.startDate || '',
      timerEndTime: row.timerEndTime || '',
      timerStartTime: row.timerStartTime || '',
      documents: row.documents || [],
      images: row.images || [],
      extensionDays: row.extensionDays ?? 0,
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || '',
      ownerId: row.ownerId || '',
      assigneeId: row.assigneeId || '',
      tenantId: row.tenantId || '',
      source: row.source || '',
      createdByTodd: !!row.createdByTodd,
      toddSourceActionKey: row.toddSourceActionKey || '',
      employeeId: row.employeeId || '',
      employeeType: row.employeeType || '',
      executionLane: row.executionLane || '',
      taskKind: row.taskKind || '',
      plannedForDate: row.plannedForDate || '',
      notesLog: Array.isArray( row.notesLog ) ? row.notesLog : [],
      url: row.url || '',
      timeToComplete: row.timeToComplete || undefined
    } as Task;
  }

  loadTasks ( _userId: string ): Observable<Task[]> {
    return this.http.get<any>( this.baseUrl ).pipe(
      map( ( res: any ) => Array.isArray( res?.tasks ) ? res.tasks.map( ( row: any ) => this.mapTaskRow( row ) ) : [] ),
      tap( list => this.setTasks( list ) )
    );
  }

  async fetchTaskById ( taskId: Task['id'], _userId: string, _taskOrTenant?: Task | string | null ): Promise<Task | null> {
    if ( !taskId ) {
      return null;
    }

    try {
      const res = await firstValueFrom( this.http.get<any>( `${this.baseUrl}/${taskId}` ) );
      const fetched = this.mapTaskRow( res?.task || res );

      if ( fetched?.id ) {
        const snapshot = this.getTasksSnapshot();
        const exists = snapshot.some( t => String( t.id ) === String( fetched.id ) );
        const next = exists
          ? snapshot.map( t => String( t.id ) === String( fetched.id ) ? fetched : t )
          : [...snapshot, fetched];

        this.setTasks( next );
        this.setActiveTask( fetched );
      }

      return fetched || null;
    } catch ( error ) {
      this.logger.error( 'Backend fetchTaskById failed', error );
      return null;
    }
  }

  async addTask ( task: Task, _userId: string, opts?: { sendEmail?: boolean; } ): Promise<Task> {
    const res = await firstValueFrom(
      this.http.post<any>( this.baseUrl, task )
    );

    const saved = this.mapTaskRow( res?.task || task );
    this.setTasks( [...this.getTasksSnapshot(), saved] );
    return saved;
  }

  async getLimits (): Promise<MoveLimits> {
    const res = await firstValueFrom( this.http.get<any>( `${this.baseUrl}/limits` ) );
    const limits = res?.limits || {};

    return {
      isPaidUser: !!limits.isPaidUser,
      currentCount: Number( limits.currentCount ) || 0,
      freeMoveLimit: Number( limits.freeMoveLimit ) || 10,
      remainingFreeMoves: Number( limits.remainingFreeMoves ) || 0,
      canCreateMove: !!limits.canCreateMove
    };
  }

  async updateTask ( taskId: Task['id'], task: Partial<Task>, _userId: string, _opts?: { sendEmail?: boolean; } ): Promise<void> {
    const res = await firstValueFrom(
      this.http.put<any>( `${this.baseUrl}/${taskId}`, task )
    );

    const saved = this.mapTaskRow( res?.task || { ...task, id: taskId } );
    const next = this.getTasksSnapshot().map( t => String( t.id ) === String( taskId ) ? saved : t );
    this.setTasks( next );
  }

  // Appends a human reply to this Move's underlying Maya action notes
  // thread - a narrow, append-only endpoint, distinct from updateTask,
  // so a reply can never accidentally clobber other task fields. See
  // moves.controller.js addTaskNote / moves.service.js addNoteToMoveSource.
  async addTaskNote ( taskId: Task['id'], text: string ): Promise<EmployeeActionNoteEntry[]> {
    const res = await firstValueFrom(
      this.http.post<any>( `${this.baseUrl}/${taskId}/notes`, { text } )
    );
    const notesLog: EmployeeActionNoteEntry[] = Array.isArray( res?.notesLog ) ? res.notesLog : [];

    const next = this.getTasksSnapshot().map( t => String( t.id ) === String( taskId ) ? { ...t, notesLog } : t );
    this.setTasks( next );
    const activeTask = this.activeTaskSubject.getValue();
    if ( activeTask && String( activeTask.id ) === String( taskId ) ) {
      this.activeTaskSubject.next( { ...activeTask, notesLog } );
    }

    return notesLog;
  }

  async deleteTask ( taskId: Task['id'], _userId: string ): Promise<void> {
    await firstValueFrom(
      this.http.delete<any>( `${this.baseUrl}/${taskId}` )
    );

    const next = this.getTasksSnapshot().filter( t => String( t.id ) !== String( taskId ) );
    this.setTasks( next );
  }

  /** Replace the current store with given array (immutable emit) */
  setTasks ( tasks: Task[] ): void {
    this.tasksSubject.next( [...tasks] );
  }

  /** Snapshot getter */
  getTasksSnapshot (): Task[] {
    return this.tasksSubject.getValue();
  }

  /** Find by id from the current in-memory snapshot only */
  getTaskById ( id: Task['id'] ): Task | undefined {
    return this.getTasksSnapshot().find( t => String( t.id ) === String( id ) );
  }

  /**
   * Sends a task status update request to the backend server with the current state of the task.
   * @param body - The payload containing the task details and status.
   * @returns Observable - An observable that will emit the response from the server.
   */
  analyzeMatches ( body: any ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/tasks/run-task-status-update`, "With this message", JSON.stringify( body ) );
    return this.http.post<any>( `${environment.backendURL}/tasks/run-task-status-update`, body );
  }


  /**
   * Filters a list of tasks based on various criteria provided via `params`.
   */
  applyFilters ( tasks: Task[], params: any, currentUserId?: string ): Task[] {
    let filtered = [...tasks];
    if ( !params.includeCompleted ) {
      filtered = filtered.filter( task => !task.isCompleted );
    }

    if ( params.isCompleted === true || params.isCompleted === 'true' ) {
      filtered = filtered.filter( task => task.isCompleted );
      this.logger.info( "FILTERED TASK by isCompleted", filtered );

    }

    if ( params.lastUpdated === 'olderThan7Days' ) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate( sevenDaysAgo.getDate() - 7 );
      const threshold = sevenDaysAgo.toISOString();

      filtered = filtered.filter( task => {
        const updated = task?.lastUpdated || task?.startDate || task?.dueDate;
        return updated && new Date( updated ) < new Date( threshold );
      } );
    }

    if ( params.dueDateBefore || params.dueDate === '<past>' ) {
      const today = new Date().toISOString().split( 'T' )[0];
      filtered = filtered.filter( task =>
        task.dueDate && task.dueDate < today && !task.isCompleted
      );
    }

    if ( params.status ) {
      filtered = filtered.filter( task =>
        task.status?.toLowerCase() === params.status.toLowerCase()
      );
    }

    if ( params.priority ) {
      const requestedPriority = params.priority.toLowerCase();
      filtered = tasks.filter( task => ( task.priority || '' ).toLowerCase() === requestedPriority );
      this.logger.info( "FILTERED TASK by priority", filtered );

    }

    if ( params.documentsAttached === true || params.documentsAttached === 'true' ) {
      filtered = filtered.filter( task =>
        Array.isArray( task.documents ) && task.documents.length > 0
      );
    }

    if ( params.progressMin !== undefined ) {
      filtered = filtered.filter( task =>
        typeof task.progress === 'number' && task.progress >= Number( params.progressMin )
      );
    }

    if ( params.attentionCheck ) {
      filtered = filtered.filter( task =>
        !task.isCompleted && task.progress &&
        ( !task.contactIds || task.contactIds.length === 0 || task.progress < 25 )
      );
    }

    if ( params.dueDate === 'today' ) {
      const today = new Date().toISOString().split( 'T' )[0];
      filtered = filtered.filter( task =>
        task.dueDate?.startsWith( today )
      );
    }

    if ( params.dueDate === 'thisWeek' ) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date( today );
      startOfWeek.setDate( today.getDate() - dayOfWeek );
      const endOfWeek = new Date( startOfWeek );
      endOfWeek.setDate( startOfWeek.getDate() + 6 );

      const start = startOfWeek.toISOString().split( 'T' )[0];
      const end = endOfWeek.toISOString().split( 'T' )[0];

      filtered = filtered.filter( task => {
        const due = task.dueDate?.split( 'T' )[0];
        return due ? ( due >= start && due <= end ) : '';
      } );

      this.logger.info( "FILTERED TASKS - Due This Week", filtered );
    }

    if ( params.assigned === 'me' && currentUserId ) {
      filtered = filtered.filter( task =>
        task.contactIds?.includes( currentUserId )
      );
    }

    return filtered;
  }

  /**
   * Filters the list of tasks based on the given parameters.
   */
  suggestTasks ( tasks: Task[], param: any ): Task[] {
    let dueDate = param.dueDate;
    if ( dueDate === 'today' || dueDate === '<today>' ) {
      dueDate = new Date().toISOString().split( 'T' )[0];
    }

    return tasks.filter( task => {
      const matchesPriority = !param.priority || task.priority === param.priority;
      const matchesDueDate = !dueDate || ( task.dueDate?.startsWith( dueDate ) );
      return matchesPriority && matchesDueDate;
    } );
  }

  setActiveTask ( task: Task | null ) {
    this.activeTaskSubject.next( task );
  }

  getActiveTask (): Task | null {
    return this.activeTaskSubject.getValue();
  }
}
