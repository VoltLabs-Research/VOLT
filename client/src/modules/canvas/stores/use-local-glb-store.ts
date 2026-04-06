import { create } from 'zustand';

interface LocalGlbState {
    localGlbUrl: string | null;
    setLocalGlbFile: (file: File) => void;
    clearLocalGlb: () => void;
};

let lastObjectUrl: string | null = null;

const revokeLastObjectUrl = () => {
    if (!lastObjectUrl) {
        return;
    }

    URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = null;
};

export const useLocalGlbStore = create<LocalGlbState>((set) => ({
    localGlbUrl: null,
    setLocalGlbFile(file) {
        revokeLastObjectUrl();
        const nextUrl = URL.createObjectURL(file);
        lastObjectUrl = nextUrl;
        set({ localGlbUrl: nextUrl });
    },
    clearLocalGlb() {
        revokeLastObjectUrl();
        set({ localGlbUrl: null });
    }
}));

