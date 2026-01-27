import type { SliceCreator } from '../helpers';

export interface WindowsState {
    showTeamCreator: boolean;
}

export interface WindowsActions {
    toggleTeamCreator: () => void;
}

export type WindowsSlice = WindowsState & WindowsActions;

export const initialWindowsState: WindowsState = {
    showTeamCreator: false
};

export const createWindowsSlice: SliceCreator<WindowsSlice> = (set, get) => ({
    ...initialWindowsState,

    toggleTeamCreator: () => {
        set({ showTeamCreator: !get().showTeamCreator });
    }
});
