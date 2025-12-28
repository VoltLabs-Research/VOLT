import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createSSHConnectionSlice, type SSHConnectionSlice } from './connection-slice';
import { createSSHExplorerSlice, type SSHExplorerSlice } from './explorer-slice';

export const useSSHConnectionStore = create<SSHConnectionSlice>()(combineSlices(createSSHConnectionSlice));
export const useSSHExplorerStore = create<SSHExplorerSlice>()(combineSlices(createSSHExplorerSlice));

export { type SSHConnectionSlice, type SSHConnectionState, type SSHConnectionActions, type SSHConnection, type CreateSSHConnectionData, type UpdateSSHConnectionData } from './connection-slice';
export { type SSHExplorerSlice, type SSHExplorerState, type SSHExplorerActions, type SSHFileEntry } from './explorer-slice';
