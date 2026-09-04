/**
 * Trimmed from shared/data/interfaces/project.model.ts (a large project-
 * management interface belonging to the Marketing module's
 * project-view/project-sticky-board, not ported here). task-edit.component.ts
 * only reads `id`/`name` off Project - it uses PROJECTS purely as a
 * dropdown of project names to tag a Move with.
 */
export interface Project {
  id?: string;
  name?: string;
}
