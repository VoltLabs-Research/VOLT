import { create } from 'zustand';
import type { AtomData } from '@/modules/trajectory/application/dtos/trajectory/GetAtomsDTO';

interface AtomsState {
    rows: AtomData[];
    properties: string[];
    isLoading: boolean;
    error: string | null;
};

interface AtomsActions {
    setRows: (rows: AtomData[]) => void;
    appendRows: (rows: AtomData[]) => void;
    setProperties: (properties: string[]) => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

type AtomsStore = AtomsState & AtomsActions;

const initialState: AtomsState = {
    rows: [],
    properties: [],
    isLoading: false,
    error: null
};

const useAtomsStore = create<AtomsStore>((set) => ({
    ...initialState,

    setRows: (rows) => set({ rows }),

    appendRows: (rows) => set((state) => ({
        rows: [...state.rows, ...rows]
    })),

    setProperties: (properties) => set({ properties }),

    setLoading: (value) => set({ isLoading: value }),

    setError: (error) => set({ error }),

    reset: () => set(initialState)
}));

export default useAtomsStore;

