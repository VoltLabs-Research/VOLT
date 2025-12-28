// Auth
export { useAuthStore, default as useAuthStoreDefault } from './slices/auth';
export type { AuthSlice, AuthState, AuthActions } from './slices/auth';

// Container
export { useContainerStore } from './slices/container';
export type { ContainerSlice, ContainerState, ContainerActions } from './slices/container';

// Notification
export { useNotificationStore } from './slices/notification';
export type { NotificationSlice, NotificationState, NotificationActions } from './slices/notification';

// SSH
export { useSSHConnectionStore, useSSHExplorerStore } from './slices/ssh';
export type { SSHConnectionSlice, SSHExplorerSlice, SSHConnection, SSHFileEntry, CreateSSHConnectionData, UpdateSSHConnectionData } from './slices/ssh';

// Team
export { useTeamStore, useTeamRoleStore } from './slices/team';
export type { TeamRoleSlice, TeamRoleState, TeamRoleActions } from './slices/team';

// Trajectory
export { useTrajectoryStore, dataURLToBlob, dataURLToObjectURL } from './slices/trajectory';

// Raster
export { useRasterStore } from './slices/raster';

// Analysis
export { useAnalysisConfigStore } from './slices/analysis';
export type { ExtendedAnalysisStore } from './slices/analysis';

// Trajectory VFS
export { useTrajectoryVfsStore } from './slices/trajectory-vfs';
export type { TrajectoryVfsSlice, FsEntry } from './slices/trajectory-vfs';

// Chat
export { useChatStore, selectChatData, selectChatUI, selectChatSocket } from './slices/chat';
export type { ChatDataSlice, ChatUISlice, ChatSocketSlice } from './slices/chat';

// Plugin
export { usePluginStore, usePluginBuilderStore } from './slices/plugin';
export type { RenderableExposure, ResolvedModifier, PluginArgument, PluginState, PluginBuilderState } from './slices/plugin';

// UI
export { useUIStore } from './slices/ui';
export type {
    UISlice,
    DashboardSearchSlice, DashboardSearchState, DashboardSearchActions,
    EditorUISlice, EditorUIState, EditorUIActions, ActiveModifier,
    ToastSlice, ToastState, ToastActions, Toast, ToastType,
    WindowsSlice, WindowsState, WindowsActions
} from './slices/ui';

// Helpers
export { runRequest, extractError, combineSlices, type SliceCreator, type AsyncState, type RunRequestOptions } from './helpers';
