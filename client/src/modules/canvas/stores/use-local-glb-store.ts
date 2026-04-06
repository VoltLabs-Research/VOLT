import { create } from 'zustand';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';

interface LocalGlbState {
    localGlbUrl: string | null;
    localModelWorldBounds: ModelWorldBounds | null;
    localAutoSimulationCellWorldBounds: ModelWorldBounds | null;
    setLocalGlbFile: (file: File) => void;
    setLocalModelWorldBounds: (bounds: ModelWorldBounds | null) => void;
    setLocalAutoSimulationCellWorldBounds: (bounds: ModelWorldBounds | null) => void;
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
    localModelWorldBounds: null,
    localAutoSimulationCellWorldBounds: null,
    setLocalGlbFile(file) {
        revokeLastObjectUrl();
        const nextUrl = URL.createObjectURL(file);
        lastObjectUrl = nextUrl;
        set({
            localGlbUrl: nextUrl,
            localModelWorldBounds: null,
            localAutoSimulationCellWorldBounds: null
        });
    },
    setLocalModelWorldBounds(bounds) {
        set({ localModelWorldBounds: bounds });
    },
    setLocalAutoSimulationCellWorldBounds(bounds) {
        set({ localAutoSimulationCellWorldBounds: bounds });
    },
    clearLocalGlb() {
        revokeLastObjectUrl();
        set({
            localGlbUrl: null,
            localModelWorldBounds: null,
            localAutoSimulationCellWorldBounds: null
        });
    }
}));
