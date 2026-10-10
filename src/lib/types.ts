// Shapes returned by the API (see SPEC §4 and server/queries.mjs).
export type Role = 'hire' | 'admin' | 'member';
export type OwnerRole = 'hire' | 'people_ops' | 'it' | 'manager' | 'buddy';
export type TaskType = 'form' | 'sign' | 'video' | 'app' | 'todo' | 'meeting' | 'it';

export interface Person { id: number; name: string; first: string; title?: string | null; photo?: string | null }
export interface User { id: number; name: string; email: string; title?: string; team?: string; photo?: string; role: Role; duty?: string | null; startDate?: string | null }
export interface AppInfo { key: string; name: string; category: string; tint: 'sky' | 'butter' | 'peach' | 'sage'; icons: string[]; open: string }

export interface Task {
  id: number; templateId: number; type: TaskType; typeLabel: string; title: string; meta: string; emoji: string;
  ownerRole: OwnerRole; ownerLabel: string; owner: Person | null; ownerId: number | null;
  dueDay: number; dueDate: string; status: 'todo' | 'done'; doneAt: string | null; ref: string | null;
  overdue: boolean; dueToday: boolean; stageId: number; stagePos: number; stageName: string; stageEmoji: string;
  data: any; app: AppInfo | null;
}

export interface Video {
  id: number; kind: 'intro' | 'app' | 'hello' | 'lesson'; title: string; durationSec: number | null;
  status: 'published' | 'needs_update' | 'missing'; still: string | null; chapters: [number, string][];
  caption: string | null; appKey: string | null; presenter: Person | null; flagged: number; url?: string | null;
}

export interface Stage {
  id: number; position: number; name: string; emoji: string; tint: string; window: string; summary: string; opens: string;
  state: 'done' | 'current' | 'upcoming'; total: number; done: number; intro: Video | null; apps: AppInfo[]; tasks: Task[];
}
