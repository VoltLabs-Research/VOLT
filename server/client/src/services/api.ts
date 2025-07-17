import axios from 'axios';

const API_BASE_URL = 'http://0.0.0.0:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000,
    headers: {
        'Content-Type': 'application/json'
    }
});

export const listFolders = async (): Promise<string[]> => {
    const response = await api.get('/dislocations');
    return response.data.simulations;
};

export const analyzeTrajectory = async (folderId: string, config: any): Promise<any> => {
    const response = await api.post(`/dislocations/trajectories/${folderId}/analyze`, config);
    return response.data;
};

export const uploadTrajectoryFiles = async (formData: FormData): Promise<any> => {
    const response = await axios.post(`${API_BASE_URL}/dislocations`, formData, {
        timeout: 300000
    });

    return response.data;
};

export const deleteFolder = async (folderId: string): Promise<void> => {
    await api.delete(`/dislocations/${folderId}`);
};