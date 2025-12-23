import { create } from 'zustand';

const initialState = {
    showTeamCreator: false
};

const useWindowsStore = create<any>((set, get) => {
    return {
        ...initialState,

        toggleTeamCreator() {
            set({ showTeamCreator: !get().showTeamCreator });
        },
    };
});

export default useWindowsStore;
