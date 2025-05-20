// ===== Bento - Shared Type Definitions =====

export type UserRole = "admin" | "manager" | "member";

export type StepType =
  | "confirm_url"
  | "approval"
  | "auto_aggregate"
  | "confirm_value"
  | "input"
  | "webhook"
  | "ai_check"
  | "ai_generate"
  | "conditional"
  | "notification"
  | "wait"
  | "mcp_tool"
  | "trigger_workflow";

export type StepStatus = "pending" | "in_progress" | "completed" | "rejected";

export type ExecutionStatus = "pending" | "in_progress" | "completed" | "rejected";

export type ScheduleType = "daily" | "weekly" | "monthly" | "manual";

// ----- Visibility & Sharing -----
export type ToolVisibility = "private" | "department" | "company";

// ----- Department -----
export interface Department {
  id: string;
  companyId: string;
  name: string;
  parentId: string | null;  // for vertical hierarchy
  managerUids: string[];
  memberUids: string[];
  createdAt: string;
}

// ----- User -----
export interface User {
  uid: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  departmentId: string | null;
  createdAt: string;
}

// ----- Workflow Template -----
export interface StepConfig {
  // Common
  description?: string;

  // confirm_url
  url?: string;
  showAggregatedValue?: boolean;

  // approval
  approverIds?: string[];
  autoNotify?: boolean;

  // auto_aggregate
  source?: string;
  spreadsheetId?: string;
  sheetName?: string;
  aggregation?: string;
  targetColumn?: string;
  dateColumn?: string;
  dateRange?: string;

  // confirm_value
  valueLabel?: string;
  expectedRange?: string;

  // input
  fields?: InputField[];

  // ai_check
  checkType?: string;
  dataSource?: string;

  // ai_generate
  generationType?: string;
  prompt?: string;
  outputFormat?: string;

  // webhook
  method?: string;
  headers?: Record<string, string>;
  bodyTemplate?: string;

  // conditional
  condition?: string;
  trueStepId?: string;
  falseStepId?: string;

  // notification
  type?: string;
  recipientIds?: string[];
  subject?: string;
  bodyTemplateNotif?: string;

  // wait
  waitType?: string;
  duration?: string;
  datetime?: string;
  eventType?: string;

  // mcp_tool
  connectionId?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;

  // trigger_workflow
  targetWorkflowId?: string;
  passData?: boolean;
}

export interface InputField {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "email" | "tel" | "url" | "textarea" | "select" | "file" | "image";
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface WorkflowStep {
  id: string;
  order: number;
  type: StepType;
  label: string;
  config: StepConfig;
}

export interface WorkflowSchedule {
  type: ScheduleType;
  dayOfMonth?: number;
  dayOfWeek?: number;
  time: string;
}

export interface WorkflowTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string;
  schedule: WorkflowSchedule;
  assigneeIds: string[];
  approverIds: string[];
  steps: WorkflowStep[];
  visibility: ToolVisibility;
  departmentId: string | null;
  sharedDepartmentIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ----- Workflow Execution -----
export interface StepResult {
  status: StepStatus;
  result: Record<string, unknown> | null;
  completedAt: string | null;
  completedBy: string | null;
  rejectedReason?: string;
}

export interface WorkflowExecution {
  id: string;
  templateId: string;
  companyId: string;
  assigneeId: string;
  status: ExecutionStatus;
  currentStepId: string;
  startedAt: string;
  completedAt: string | null;
  steps: Record<string, StepResult>;
  template?: WorkflowTemplate;
  // Chain info: where this execution was triggered from
  sourceExecutionId?: string;
  sourceWorkflowName?: string;
  sourceAssigneeName?: string;
  sourceData?: Record<string, unknown>;
}

// ----- Chat -----
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ----- Dashboard -----
export interface DashboardSummary {
  total: number;
  completed: number;
  inProgress: number;
  rejected: number;
  pendingApprovals: number;
  completionRate: number;
}

export interface UserProgress {
  uid: string;
  name: string;
  department: string;
  total: number;
  completed: number;
  inProgress: number;
  completionRate: number;
}

// ----- Screen / Block System -----

export type BlockType =
  | "workflow_launcher"   // ワークフロー開始ボタン
  | "data_list"           // データ一覧（顧客リスト等）
  | "chart"               // グラフ（棒/円/折れ線）
  | "metric_card"         // 数値KPIカード
  | "calendar"            // カレンダー
  | "recent_activity"     // 最近のアクティビティ
  | "quick_input"         // クイック入力フォーム
  | "embed_url"           // 外部URL埋め込み
  | "ai_chat"             // AIチャットウィジェット
  | "notification_feed"   // 通知フィード
  | "text"                // 自由テキスト/メモ
  | "image";              // 画像表示

export interface BlockConfig {
  // workflow_launcher
  workflowId?: string;
  style?: "large" | "compact" | "icon";

  // data_list
  source?: string;          // "customers" | "products" | "orders" | custom collection name
  columns?: { key: string; label: string; type?: string }[];
  sortBy?: string;
  limit?: number;

  // chart
  chartType?: "bar" | "line" | "pie" | "area";
  dataSource?: string;
  xAxis?: string;
  yAxis?: string;

  // metric_card
  value?: string;           // static value or "auto"
  unit?: string;            // "円" | "件" | "%" etc.
  trend?: "up" | "down" | "flat";
  color?: string;

  // embed_url
  url?: string;
  height?: number;

  // quick_input
  fields?: InputField[];
  submitAction?: string;    // webhook URL or workflow ID

  // text
  content?: string;

  // image
  imageUrl?: string;

  // common
  description?: string;
  refreshInterval?: number; // auto-refresh in seconds
}

export interface ScreenBlock {
  id: string;
  type: BlockType;
  label: string;
  config: BlockConfig;
  width: "full" | "half" | "third"; // grid layout
  order: number;
}

export interface AppScreen {
  id: string;
  label: string;
  icon?: string;
  blocks: ScreenBlock[];
  order: number;
}

export interface UserApp {
  id: string;
  userId: string;
  companyId: string;
  name: string;
  screens: AppScreen[];
  data: Record<string, DataRecord[]>;
  visibility: ToolVisibility;
  departmentId: string | null;
  sharedDepartmentIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataRecord {
  id: string;
  [key: string]: unknown;
}

// ----- Unified Tool Item (for tools page) -----
export type ToolType = "workflow" | "app";

export interface ToolItem {
  id: string;
  type: ToolType;
  name: string;
  description: string;
  visibility: ToolVisibility;
  departmentId: string | null;
  sharedDepartmentIds: string[];
  createdBy: string;
  updatedAt: string;
  // workflow-specific
  stepCount?: number;
  scheduleType?: ScheduleType;
  // app-specific
  screenCount?: number;
  blockCount?: number;
}

export interface ChatResponse {
  reply: string;
  workflow: WorkflowTemplate | null;
  app: UserApp | null;
  conversation_id: string;
  tool_call: MCPToolCall | null;
  tool_result: MCPToolCallResult | null;
}

// ----- MCP Integration -----

export interface MCPConnection {
  id: string;
  server_name: string;
  server_url: string;
  auth_type: string;
  description: string;
  enabled: boolean;
  tools: MCPToolInfo[];
  connected_at: string;
  status: string;
  service_id: string;
}

export interface MCPToolInfo {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  connection_id: string;
}

export interface MCPService {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  auth_type: string;
  categories: string[];
  available_tools: string[];
}

export interface MCPToolCall {
  connectionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolCallResult {
  success: boolean;
  result: unknown;
  error: string | null;
  execution_time_ms: number;
}
