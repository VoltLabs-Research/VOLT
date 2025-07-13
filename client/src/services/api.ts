import axios from 'axios';

const API_BASE_URL = 'http://192.168.1.85:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000
});

export const healthCheck = async (): Promise<{ message: string; version: string; status: string }> => {
    const response = await api.get('/');
    return response.data;
};

export const listFolders = async (): Promise<string[]> => {
    const response = await api.get('/files');
    return response.data;
};

export const listFilesInFolder = async (folderId: string): Promise<any[]> => {
    const response = await api.get(`/files/${folderId}`);
    return response.data.files;
};

export const uploadFolder = async (files: FileList): Promise<any> => {
    const formData = new FormData();

    for(const file of files){
        formData.append('files', file, file.webkitRelativePath || file.name);
    }

    const response = await api.post('/files/', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });

    return response.data;
};

export const reanalyzeTimestep = async (folderId: string, timestep: number, config: any): Promise<any> => {
    const response = await api.post(`/dislocations/analyze_single_timestep/${folderId}/${timestep}`, config);
    return response.data;
};

export const analyzeFolder = async (folderId: string, config: any): Promise<any> => {
    const response = await api.post(`/dislocations/analyze/${folderId}`, config);
    return response.data;
};

export const deleteFolder = async (folderId: string): Promise<void> => {
    await api.delete(`/files/${folderId}`);
};