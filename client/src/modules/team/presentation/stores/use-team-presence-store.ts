import { create } from 'zustand';

interface TeamPresenceState{
    onlineUserIds: Set<string>;
    setOnlineUserIds: (ids: Set<string>) => void;
    addOnlineUser: (id: string) => void;
    removeOnlineUser: (id: string) => void;
};

export const useTeamPresenceStore = create<TeamPresenceState>((set) => ({
    onlineUserIds: new Set(),
    setOnlineUserIds: (ids) => set({ onlineUserIds: ids }),
    addOnlineUser: (id) => set((s) => {
        const next = new Set(s.onlineUserIds);
        next.add(id);
        return { onlineUserIds: next };
    }),
    removeOnlineUser: (id) => set((s) => {
        const next = new Set(s.onlineUserIds);
        next.delete(id);
        return { onlineUserIds: next };
    })
}));
