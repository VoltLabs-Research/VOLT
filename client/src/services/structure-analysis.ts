/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { api } from './api';

export interface StructureTypeStat {
    name: string;
    count: number;
    percentage: number;
    typeId: number;
}

export interface StructureAnalysis {
    _id: string;
    totalAtoms: number;
    timestep: number;
    analysisMethod: 'PTM' | 'CNA';
    types: StructureTypeStat[];
    identifiedStructures: number;
    unidentifiedStructures: number;
    identificationRate: number;
    trajectory: string | {
        _id: string;
        name: string;
        team?: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface StructureAnalysisQueryParams {
    analysisMethod?: string;
    timestepFrom?: number;
    timestepTo?: number;
    page?: number;
    limit?: number;
    sort?: string;
}

export interface StructureAnalysisResponse {
    status: string;
    data: StructureAnalysis;
}

export interface StructureAnalysesResponse {
    status: string;
    data: {
        analyses: StructureAnalysis[];
        totalAnalyses: number;
        page: number;
        limit: number;
    };
}

export interface StructureAnalysesByTeamResponse {
    status: string;
    data: {
        trajectories: Array<{
            _id: string;
            name: string;
            createdAt: string;
        }>;
        totalAnalyses: number;
        page: number;
        limit: number;
        analysesByTrajectory: Record<string, StructureAnalysis[]>;
    };
}

export interface StructureAnalysesByConfigResponse {
    status: string;
    data: {
        analyses: StructureAnalysis[];
    };
}

export const getStructureAnalysisByTeam = async (
    teamId: string,
    params: StructureAnalysisQueryParams = {}
): Promise<StructureAnalysesByTeamResponse> => {
    const response = await api.get(`/structure-analysis/team/${teamId}`, { params });
    return response.data;
};

export const getStructureAnalysesByTrajectory = async (
    trajectoryId: string,
    params: StructureAnalysisQueryParams = {}
): Promise<StructureAnalysesResponse> => {
    const response = await api.get(`/structure-analysis/trajectory/${trajectoryId}`, { params });
    return response.data;
};

export const getStructureAnalysesByConfig = async (
    configId: string
): Promise<StructureAnalysesByConfigResponse> => {
    const response = await api.get(`/structure-analysis/config/${configId}`);
    return response.data;
};

export const getStructureAnalysisById = async (
    analysisId: string
): Promise<StructureAnalysisResponse> => {
    const response = await api.get(`/structure-analysis/${analysisId}`);
    return response.data;
};
