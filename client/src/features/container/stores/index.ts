import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createContainerSlice, type ContainerSlice } from './slice';

export const useContainerStore = create<ContainerSlice>()(combineSlices(createContainerSlice));

export { type ContainerSlice, type ContainerState, type ContainerActions } from './slice';
export type { Container } from '@/types/models';
export default useContainerStore;
