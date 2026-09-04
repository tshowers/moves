import { Contact } from './contact.model';
import { Image } from './image.model';
import { Document } from './docuttach.model';

/** Ported from shared/data/interfaces/ta-date.model.ts's TaTime - used for Task.timeToComplete. */
export interface TaTime {
  hour: number;
  minute: number;
  second: number;
}

/**
 * Trimmed from shared/data/interfaces/state.model.ts's State interface,
 * which Task extends in the monorepo - only the fields Task actually
 * inherits and uses (dateAdded/lastUpdated/userId bookkeeping), not
 * State's full cross-module surface (social-media bookmark counts, payout
 * profile flags, etc. that no Move ever has).
 */
export interface TaskState {
  id?: string;
  dateAdded?: { seconds: number } | string;
  userId?: string;
  lastUpdated?: string;
  lastUpdatedBy?: string;
  deleted?: boolean;
}

/** Ported from features/employees/models/employee.models.ts - Maya's
 * status/blocker notes interleaved with human replies on a Move. */
export interface EmployeeActionNoteEntry {
  at: string;
  author: 'maya' | 'user';
  authorLabel?: string;
  text: string;
}

export interface Task extends TaskState {
  id?: string;

  title: string;
  description?: string;

  taskTypeId?: string;
  projectId?: string;
  parentTaskId?: string;

  dueDate: string;
  startDate?: string;
  timerStartTime?: string;
  timerEndTime?: string;

  progress: number;
  priority?: string;
  status?: string;

  isEditing?: boolean;
  isCompleted?: boolean;
  needsAttention?: boolean;
  superseded?: boolean;
  supersededAt?: string;
  supersededReason?: string;

  contactIds?: string[];
  contacts?: Contact[];

  images?: Image[];
  documents?: Document[];
  subTasks?: Task[];

  extensionDays?: number;
  timeToComplete?: TaTime;
  url?: string;

  createdAt?: string;
  updatedAt?: string;
  ownerId?: string;
  /** Tenant member responsible for the move. Contacts remain related records. */
  assigneeId?: string;
  tenantId?: string;
  source?: string;
  createdByTodd?: boolean;
  toddSourceActionKey?: string;
  employeeId?: string;
  employeeType?: string;
  executionLane?: string;
  taskKind?: string;
  plannedForDate?: string;
  // Mirrored outward from the source employee-action's notesLog (Maya's
  // status/blocker notes interleaved with human replies). Human replies
  // go through TaskApiService.addTaskNote, a dedicated append endpoint,
  // not written to directly.
  notesLog?: EmployeeActionNoteEntry[];
  blocked?: boolean;
}

export interface TaskType {
  id: string;
  name: string;
}
