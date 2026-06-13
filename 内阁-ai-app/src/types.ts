/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ViewType = 'selection' | 'new-session' | 'meeting' | 'columns' | 'settings' | 'tools' | 'folder-reader' | 'image-studio' | 'issue-report' | 'auto-debate';
export type VisualModeType = 'cabinet' | 'un';

export interface CabinetMember {
  id: string;
  name: string;
  avatar: string;
  type: 'model' | 'tool' | 'custom';
  selected: boolean;
  role: 'pm' | 'sg' | 'none';
  ministry: 'rites' | 'personnel' | 'revenue' | 'war' | 'works' | 'punishments' | 'archive' | 'none';
  badge: string;
  desc?: string;
  // Phase 1 new fields
  nickname?: string;
  providerId?: string;
  modelId?: string;
  apiProfileId?: string;
  localToolId?: string;
  skillId?: string;
  systemPrompt?: string;
  avatarType?: 'url' | 'initial' | 'provider';
  enabled?: boolean;
  isDefault?: boolean;
  // Local tool extensions
  isLocal?: boolean;
  localUrl?: string;
  localType?: string;
  capabilities?: string[];
  lastChecked?: string;
  errorReason?: string;
  authorized?: boolean;
  roleContext?: 'pm' | 'execution' | 'censor' | 'none';
}

export interface ChatMessage {
  id: string;
  sender: string;
  avatar: string;
  content: string;
  isUser: boolean;
  roleLabel?: string;
  ministerId?: string;
  citations?: string[];
  timestamp?: string;
  isRoundDivider?: boolean;
  roundNumber?: number;
}

export interface ColumnDetail {
  id: string;
  ministerName: string;
  avatar: string;
  ministry: string;
  logs: string[];
}

export interface VerdictOption {
  id: string;
  title: string;
  badge: string;
  description: string;
  icon: string;
}

export interface HistorySession {
  id: string;
  title: string;
  timestamp: string;
  mode: VisualModeType;
  members: CabinetMember[];
  messages: ChatMessage[];
}

export interface ApiConfiguration {
  openai: string;
  anthropic: string;
  deepseek: string;
}

export interface ToolStatus {
  codex: 'available' | 'unavailable' | 'not_detected';
  claudeCode: 'available' | 'unavailable' | 'not_detected';
  trae: 'available' | 'unavailable' | 'not_detected';
}
