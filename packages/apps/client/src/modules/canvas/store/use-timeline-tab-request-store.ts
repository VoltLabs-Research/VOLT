import { create } from 'zustand';

// Lets code outside the timeline (running a pipeline) bring one of its tabs to the front. The timeline
// applies the request as soon as that tab exists: the Log tab only appears once an analysis is selected.
interface TimelineTabRequestState {
    requestedTab: string | null;
    requestTab: (tab: string) => void;
    clearRequest: () => void;
}

export const useTimelineTabRequestStore = create<TimelineTabRequestState>((set) => ({
    requestedTab: null,
    requestTab: (tab) => set({ requestedTab: tab }),
    clearRequest: () => set({ requestedTab: null })
}));
