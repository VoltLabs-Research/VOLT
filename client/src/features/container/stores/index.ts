import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createContainerSlice, type ContainerSlice } from '@/features/container/stores/slice';

export const useContainerStore = create<ContainerSlice>()(combineSlices(createContainerSlice));

export { type ContainerSlice, type ContainerState, type ContainerActions } from '@/features/container/stores/slice';
export type { Container } from '@/types/models';
export default useContainerStore;
