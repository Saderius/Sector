export type TaskStatus = string;

export type ColumnSize = 'short' | 'medium' | 'large' | 'full';

export interface ColumnDef {
  id: string;
  title: string;
  color: string;
  size: ColumnSize;
  order: number;
  width?: number;
}

export interface BoardConfig {
  id: string;
  name: string;
  includeTags: string[];
  excludeTags: string[];
  columns?: ColumnDef[];
}

export interface Task {
  id: string; // filename or unique id
  title: string;
  status: TaskStatus;
  tags: string[];
  content: string; 
  order: number;
  archived?: boolean;
  trashed?: boolean;
  pendingExternalChanges?: Task; // Holds incoming changes from the agent
}
