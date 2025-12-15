import api from '@/api';

export const getStructureAnalysisById = async (id: string) => {
    const response = await api.get(`/structure-analysis/${id}`);
    return response.data;
};

export const getStructureAnalysisByTeam = async (teamId: string) => {
    const response = await api.get(`/structure-analysis/team/${teamId}`);
    return response.data;
};

export const getStructureAnalysesByTrajectory = async (trajectoryId: string) => {
    const response = await api.get(`/structure-analysis/trajectory/${trajectoryId}`);
    return response.data;
};

export const getStructureAnalysesByConfig = async (configId: string) => {
    const response = await api.get(`/structure-analysis/config/${configId}`);
    return response.data;
};
