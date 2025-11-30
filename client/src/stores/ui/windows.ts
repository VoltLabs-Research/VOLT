import { create } from 'zustand';

const initialState = {
    showTeamCreator: false,
    showSSHFileExplorer: false
};

const useWindowsStore = create<any>((set, get) => {
    return {
        ...initialState,

        toggleTeamCreator() {
            set({ showTeamCreator: !get().showTeamCreator });
        },

        toggleSSHFileExplorer() {
            set({ showSSHFileExplorer: !get().showSSHFileExplorer });
        }
    };
});

export default useWindowsStore;