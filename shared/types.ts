export type Mode = "demo" | "live";
export type Lifetime = "short_term" | "long_term";
export type ContextKind =
  | "source_excerpt"
  | "catalog_reference"
  | "note"
  | "constraint"
  | "assumption"
  | "proposed_decision"
  | "approved_decision";
export interface SourceRef {
  gateway: string;
  operator: string;
  sessionKey: string;
  sessionId: string;
  messageId: string;
}
export interface Excerpt {
  text: string;
  author: string;
  source: SourceRef;
}
export interface ContextItem extends Excerpt {
  id: string;
  projectId: string;
  kind: ContextKind;
  hash: string;
  originalText: string | null;
  originalHash: string | null;
  capturedAt: string;
  version: number;
}
export interface Project {
  id: string;
  name: string;
  lifetime: Lifetime;
  status: "active" | "archived";
  version: number;
  contextVersion: number;
  createdAt: string;
}
export interface TaskBrief {
  objective: string;
  acceptance: string;
}
export interface Stage {
  id: string;
  projectId: string;
  position: number;
  title: string;
  briefs: TaskBrief[];
  status:
    | "draft"
    | "running"
    | "review"
    | "approved"
    | "changes"
    | "rejected"
    | "unknown";
  revision: number;
  approvedRevision: number | null;
  snapshotId: string | null;
  contextVersion: number | null;
  proposal: string;
  assumptions: string;
  missing: string;
  alternatives: string;
  reviewGeneration: number;
  launchToken: string | null;
  dependencies: DependencyRef[];
  dependencyStale: boolean;
  createdAt: string;
}
export interface DependencyRef {
  stageId: string;
  revision: number;
  reviewGeneration: number;
  snapshotId: string | null;
  digest: string;
}
export interface StartPreview {
  stage: Stage;
  contextVersion: number;
  items: ContextItem[];
  dependencies: DependencyRef[];
  token: string;
}
export interface Task {
  id: string;
  stageId: string;
  runId: string;
  sessionId: string;
  sessionKey: string;
  idempotencyKey: string;
  snapshotId: string;
  objective: string;
  acceptance: string;
  status: "running" | "completed" | "failed" | "unknown";
  output: string;
  createdAt: string;
}
export interface Snapshot {
  id: string;
  projectId: string;
  contextVersion: number;
  items: ContextItem[];
  digest: string;
  createdAt: string;
}
export interface ReviewEvent {
  id: string;
  stageId: string;
  revision: number;
  action:
    | "approve"
    | "changes"
    | "reject"
    | "revise"
    | "context_changed"
    | "reconcile";
  note: string;
  generation?: number;
  requestId?: string;
  requestDigest?: string;
  checkpoint?: Stage;
  checkpointDigest?: string;
  evidence?: Task[];
  snapshot?: Snapshot | null;
  createdAt: string;
}
export interface Message extends Excerpt {
  id: string;
  role: string;
  simulated: boolean;
  createdAt: string;
}
export interface Conversation {
  key: string;
  sessionId: string;
  title: string;
  parentKey: string | null;
  lineage: "reported" | "incomplete";
  status: string;
}
export interface MessagePage {
  pageToken?: string;
  messages: Message[];
  nextOffset: number | null;
  incomplete: boolean;
}
export interface Connection {
  mode: Mode;
  state:
    | "demo"
    | "not_paired"
    | "connecting"
    | "read_only_unverified"
    | "unsupported";
  detail: string;
  canExecute: boolean;
}
export interface WorkspaceState {
  projects: Project[];
  stages: Stage[];
  tasks: Task[];
  context: ContextItem[];
  events: ReviewEvent[];
  connection: Connection;
  conversations: Conversation[];
}
export type CatalogBehavior =
  | "read_only"
  | "writes_files"
  | "external_actions"
  | "unknown";
export type CatalogArtifactKind = "md" | "script" | "template" | "workflow";
export type ScriptLanguage = "python" | "shell" | "javascript";
export interface CatalogArtifact {
  id: string;
  kind: CatalogArtifactKind;
  language: ScriptLanguage | null;
  title: string;
  body: string;
}
export interface CatalogSkill {
  id: string;
  name: string;
  summary: string;
  behavior: CatalogBehavior;
  artifacts: CatalogArtifact[];
}
export interface CatalogPage {
  id: string;
  project: string;
  topic: string;
  title: string;
  tags: string[];
  summary: string;
  body: string;
}
export interface Catalog {
  available: true;
  synthetic: true;
  pages: CatalogPage[];
  skills: CatalogSkill[];
}
export interface CatalogUnavailable {
  available: false;
  reason: string;
}
export type CatalogRef =
  | { kind: "wiki"; pageId: string }
  | { kind: "skill"; skillId: string; artifactId: string };
export interface ProjectBundle {
  formatVersion: 1;
  exportedAt: string;
  project: Project;
  context: ContextItem[];
  stages: Stage[];
  tasks: Task[];
  snapshots: Snapshot[];
  events: ReviewEvent[];
}
