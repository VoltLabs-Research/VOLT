import type { StateCreator } from 'zustand';

export interface WindowsState {
    showTeamCreator: boolean;
}

export interface WindowsActions {
    toggleTeamCreator: () => void;
}

export type WindowsSlice = WindowsState & WindowsActions;

const initialState: WindowsState = {
    showTeamCreator: false
};

export const createWindowsSlice: StateCreator<any, [], [], WindowsSlice> = (set, get) => ({
    ...initialState,

    toggleTeamCreator() {
        set({ showTeamCreator: !get().showTeamCreator });
    }
});
