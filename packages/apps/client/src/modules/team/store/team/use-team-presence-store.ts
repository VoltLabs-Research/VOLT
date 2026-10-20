import { create } from 'zustand';

interface TeamPresenceState{
    onlineUserIds: Set<string>;
    hasPresenceSnapshot: boolean;
    setPresenceSnapshot: (ids: Iterable<string>) => void;
    addOnlineUser: (id: string) => void;
    removeOnlineUser: (id: string) => void;
    reset: () => void;
}

const createInitialState = () => ({
    onlineUserIds: new Set<string>(),
    hasPresenceSnapshot: false
});

export const useTeamPresenceStore = create<TeamPresenceState>((set) => ({
    ...createInitialState(),
    setPresenceSnapshot: (ids) => set({
        onlineUserIds: new Set(ids),
        hasPresenceSnapshot: true
    }),
    addOnlineUser: (id) => set((s) => {
        const next = new Set(s.onlineUserIds);
        next.add(id);
        return { onlineUserIds: next };
    }),
    removeOnlineUser: (id) => set((s) => {
        const next = new Set(s.onlineUserIds);
        next.delete(id);
        return { onlineUserIds: next };
    }),
    reset: () => set(createInitialState())
}));
