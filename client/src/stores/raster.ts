import { create } from "zustand";
import { api } from "@/services/api";
import { createAsyncAction } from "@/utilities/asyncAction";
import type { ApiResponse } from "@/types/api";

interface AnalysisName {
  _id: string;
  name: string;
}

interface RasterState {
  trajectory: any;
  isLoading: boolean;
  isAnalysisLoading: boolean;
  analyses: Record<string, any>;       // objeto indexado por _id
  analysesNames: AnalysisName[];       // lista ligera para selects
  selectedAnalysis: string | null;     // id seleccionado
  error: string | null;

  // actions
  getRasterFrames: (id: string) => Promise<void>;
  clearRasterData: () => void;
  setSelectedAnalysis: (id: string | null) => void;
}

const initialState: RasterState = {
  trajectory: null,
  isLoading: false,
  isAnalysisLoading: false,
  analyses: {},
  analysesNames: [],
  selectedAnalysis: null,
  error: null,
};

const useRasterStore = create<RasterState>((set, get) => {
  const asyncAction = createAsyncAction(set, get);

  return {
    ...initialState,

    rasterize: (id: string) =>
      asyncAction(() => api.post<ApiResponse<any>>(`/raster/${id}/glb/`), {
        loadingKey: "isAnalysisLoading",
        onSuccess: (res) => {
          return { analyses: res.data.data.analyses };
        },
      }),

    async getRasterFrames(id: string) {
      set({ isLoading: true, error: null });

      try {
        const res = await api.get(`/raster/${id}/glb`);
        const { analyses, trajectory } = res.data.data;

        const analysesNames = Object.values(analyses).map((a: any) => ({
          _id: a._id,
          name: `${a.identificationMode}${
            a.identificationMode === "PTM" ? ` - RMSD: ${a.RMSD}` : ""
          }`,
        }));

        set({
          trajectory,
          analyses,
          analysesNames,
          isLoading: false,
          error: null,
          selectedAnalysis: analysesNames.length > 0 ? analysesNames[0]._id : null,
        });
      } catch (error) {
        console.error("Error loading raster frames:", error);
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },

    setSelectedAnalysis(id) {
      set({ selectedAnalysis: id });
    },

    clearRasterData() {
      set({
        trajectory: null,
        analyses: {},
        analysesNames: [],
        selectedAnalysis: null,
        error: null,
      });
    },
  };
});

export default useRasterStore;
