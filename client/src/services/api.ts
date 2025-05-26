import axios from 'axios';
import {
    AnalysisConfig,
    FileInfo,
    AnalysisRequest,
    AnalysisResult,
    ServerStatus,
    UploadResult
} from '../types';

const API_BASE_URL = 'http://0.0.0.0:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    // 5 minutes timeout for analysis
    timeout: 300000
});

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

    return response;
};

export const listFiles = async (): Promise<{ files: FileInfo[] }> => {
    const response = await api.get('/files');
    return response.data;
};

export const deleteFile = async (filename: string): Promise<{ message: string }> => {
    const response = await api.delete(`/files/${encodeURIComponent(filename)}`);
    return response.data;
};

export const getTimesteps = async (filename: string): Promise<{ timesteps: number[] }> => {
    const response = await api.get(`/analyze/${encodeURIComponent(filename)}/timesteps`);
    return response.data;
};


export const analyzeFile = async (
    filename: string,
    request: AnalysisRequest,
    onProgress?: (status: string) => void
    ): Promise<AnalysisResult> => {
    if(onProgress) onProgress('Iniciando análisis...');

    const response = await api.post(
        `/analyze/${encodeURIComponent(filename)}`,
        request
    );

    if(onProgress) onProgress('Análisis completado');
    return response.data;
};

export const getDefaultConfig = async (): Promise<AnalysisConfig> => {
    const response = await api.get('/config/defaults');
    return response.data;
};

export const getServerStatus = async (): Promise<ServerStatus> => {
    const response = await api.get('/status');
    return response.data;
};