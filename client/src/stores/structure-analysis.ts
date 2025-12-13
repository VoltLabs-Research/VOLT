/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { create } from 'zustand';
import type {
    StructureAnalysis,
    StructureAnalysisQueryParams
} from '../services/structure-analysis';
import {
    getStructureAnalysisByTeam,
    getStructureAnalysisById,
    getStructureAnalysesByConfig
} from '../services/structure-analysis';

interface StructureAnalysisState {
    loading: boolean;
    error: string | null;
    structureAnalysesByTeam: Record<string, {
        trajectories: Array<{
            _id: string;
            name: string;
            createdAt: string;
        }>;
        totalAnalyses: number;
        analysesByTrajectory: Record<string, StructureAnalysis[]>;
    }>;
    structureAnalysesByConfig: Record<string, StructureAnalysis[]>;
    currentStructureAnalysis: StructureAnalysis | null;

    // Actions
    fetchStructureAnalysesByTeam: (teamId: string, params?: StructureAnalysisQueryParams) => Promise<void>;
    fetchStructureAnalysesByConfig: (configId: string) => Promise<void>;
    fetchStructureAnalysisById: (analysisId: string) => Promise<void>;
    clearCurrentAnalysis: () => void;
    reset: () => void;
}

export const useStructureAnalysisStore = create<StructureAnalysisState>((set) => ({
    loading: false,
    error: null,
    structureAnalysesByTeam: {},
    structureAnalysesByConfig: {},
    currentStructureAnalysis: null,

    fetchStructureAnalysesByTeam: async(teamId, params = {}) => {
        try{
            set({ loading: true, error: null });
            const response = await getStructureAnalysisByTeam(teamId, params);

            set((state) => ({
                structureAnalysesByTeam: {
                    ...state.structureAnalysesByTeam,
                    [teamId]: {
                        trajectories: response.data.trajectories,
                        totalAnalyses: response.data.totalAnalyses,
                        analysesByTrajectory: response.data.analysesByTrajectory
                    }
                },
                loading: false
            }));
        }catch(error){
            console.error('Error fetching structure analyses by team:', error);
            set({
                loading: false,
                error: error instanceof Error ? error.message : 'Error al obtener análisis estructurales por equipo'
            });
        }
    },

    fetchStructureAnalysisById: async(analysisId) => {
        try{
            set({ loading: true, error: null });
            const response = await getStructureAnalysisById(analysisId);

            set({
                currentStructureAnalysis: response.data,
                loading: false
            });
        }catch(error){
            console.error('Error fetching structure analysis by ID:', error);
            set({
                loading: false,
                error: error instanceof Error ? error.message : 'Error al obtener análisis estructural'
            });
        }
    },

    fetchStructureAnalysesByConfig: async(configId) => {
        try{
            set({ loading: true, error: null });
            const response = await getStructureAnalysesByConfig(configId);

            set((state) => ({
                structureAnalysesByConfig: {
                    ...state.structureAnalysesByConfig,
                    [configId]: response.data.analyses
                },
                loading: false
            }));
        }catch(error){
            console.error('Error fetching structure analyses by config:', error);
            set({
                loading: false,
                error: error instanceof Error ? error.message : 'Error al obtener análisis estructurales por configuración'
            });
        }
    },

    clearCurrentAnalysis: () => {
        set({ currentStructureAnalysis: null });
    },

    reset: () => {
        set({
            loading: false,
            error: null,
            structureAnalysesByTeam: {},
            structureAnalysesByConfig: {},
            currentStructureAnalysis: null
        });
    }
}));
