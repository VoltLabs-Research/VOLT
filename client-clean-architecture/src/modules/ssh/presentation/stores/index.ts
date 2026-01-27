import { create } from 'zustand';
import { createSSHConnectionSlice } from './connection-slice';
import { createSSHExplorerSlice } from './explorer-slice';
import type { SSHConnectionSlice } from './connection-slice';
import type { SSHExplorerSlice } from './explorer-slice';

export type SSHStore = SSHConnectionSlice & SSHExplorerSlice;

export const useSSHStore = create<SSHStore>()((set, get, store) => ({
    ...createSSHConnectionSlice(set, get, store),
    ...createSSHExplorerSlice(set, get, store)
}));

export type { SSHConnectionSlice, SSHConnectionState, SSHConnectionActions } from './connection-slice';
export type { SSHExplorerSlice, SSHExplorerState, SSHExplorerActions } from './explorer-slice';

