import { create } from 'zustand';
import { createContainerSlice } from './slice';
import type { ContainerSlice } from './slice';

export const useContainerStore = create<ContainerSlice>()((set, get, store) => ({
    ...createContainerSlice(set, get, store)
}));

export type { ContainerSlice, ContainerState, ContainerActions } from './slice';
export default useContainerStore;
