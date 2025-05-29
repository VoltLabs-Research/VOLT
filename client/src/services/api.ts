import axios from 'axios';
import type {
    AnalysisConfig,
    FileInfo,
    AnalysisResult,
    ServerStatus,
    UploadResult,
    Dislocation
} from '../types/index';

const API_BASE_URL = 'http://0.0.0.0:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000
});

// Transform server response to match client interface
const transformDislocation = (serverDislocation: any): Dislocation => {
    return {
        id: String(serverDislocation.loop_index || 0),
        length: serverDislocation.total_line_length || 0,
        burgers_vector: serverDislocation.burgers || [0, 0, 0],
        line_points: serverDislocation.points || [],
        core_atoms: serverDislocation.core_atoms || [],
        type: serverDislocation.type || 'Unknown'
    };
};

const transformAnalysisResult = (serverResult: any): AnalysisResult => {
    return {
        success: serverResult.success !== false,
        timestep: serverResult.timestep,
        dislocations: (serverResult.dislocations || []).map(transformDislocation),
        analysis_metadata: serverResult.metadata || {},
        execution_time: serverResult.execution_time || 0,
        error: serverResult.error
    };
};

export const healthCheck = async (): Promise<{ message: string; version: string; status: string }> => {
    const response = await api.get('/');
    return response.data;
}

export const uploadFile = async (file: File, onProgress?: (progress: number) => void): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: ProgressEvent) => {
            if (onProgress && progressEvent.total) {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onProgress(progress);
            }
        },
    });

    return response.data;
};

export const listFiles = async (): Promise<{ files: FileInfo[] }> => {
    const response = await api.get('/files');
    return response.data;
};

export const deleteFile = async (fileId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/files/${encodeURIComponent(fileId)}`);
    return response.data;
};

export const getTimesteps = async (fileId: string): Promise<{ file_id: string; filename: string; total_timesteps: number; timesteps: number[] }> => {
    const response = await api.get(`/files/${encodeURIComponent(fileId)}/timesteps`);
    return response.data;
};

export const getTimestepPositions = async (fileId: string, timestep: number): Promise<{
    file_id: string;
    timestep: number;
    atoms_count: number;
    positions: number[][];
    atom_types: number[];
    box_bounds: number[][];
    metadata: {
        simulation_box: number[][];
        total_atoms: number;
    };
}> => {
    const response = await api.get(`/files/${encodeURIComponent(fileId)}/timesteps/${timestep}/positions`);
    return response.data;
};

export const analyzeTimestep = async (
    fileId: string,
    timestep: number,
    config: AnalysisConfig,
    onProgress?: (status: string) => void
): Promise<AnalysisResult> => {
    if(onProgress) onProgress('Iniciando análisis...');

    const response = await api.post(
        `/analyze/${encodeURIComponent(fileId)}/timesteps/${timestep}`,
        config
    );

    if(onProgress) onProgress('Análisis completado');
    return transformAnalysisResult(response.data);
};

export const analyzeAllTimesteps = async (
    fileId: string,
    config: AnalysisConfig,
    onProgress?: (status: string) => void
): Promise<{
    file_id: string;
    total_timesteps: number;
    processed: number;
    errors: number;
    results: AnalysisResult[];
}> => {
    if(onProgress) onProgress('Iniciando análisis batch...');

    const response = await api.post(
        `/analyze/${encodeURIComponent(fileId)}/all`,
        config
    );

    if(onProgress) onProgress('Análisis batch completado');
    
    // Transform the results array
    const transformedData = {
        ...response.data,
        results: (response.data.results || []).map(transformAnalysisResult)
    };
    
    return transformedData;
};

export const getDefaultConfig = async (): Promise<AnalysisConfig> => {
    const response = await api.get('/config/defaults');
    return response.data;
};

export const getServerStatus = async (): Promise<ServerStatus> => {
    const response = await api.get('/status');
    return response.data;
};