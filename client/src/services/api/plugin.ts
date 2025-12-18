import api from '@/api';
import type { IWorkflow, PluginStatus } from '@/types/plugin';

export interface IPluginRecord {
    _id: string;
    slug: string;
    workflow: IWorkflow;
    status: PluginStatus;
    validated: boolean;
    validationErrors: string[];
    createdAt: string;
    updatedAt: string;
};

export interface GetPluginsResponse {
    status: string;
    data: IPluginRecord[];
    page?: { current: number; total: number };
    results?: { skipped: number; total: number; paginated: number };
};

export interface GetPluginResponse {
    status: string;
    data: IPluginRecord;
};

export interface ValidateWorkflowResponse {
    status: string;
    data: {
        valid: boolean;
        errors: string;
    }
};

export interface ExecutePluginResponse {
    status: string;
    data: {
        analysisId: string
    };
};

const pluginApi = {
    /**
     * Get all plugins with optional filtering
     */
    getPlugins: async (params?: {
        status?: PluginStatus;
        page?: number;
        limit?: number;
        search?: string
    }): Promise<GetPluginResponse> => {
        const response = await api.get<GetPluginResponse>('/plugins', { params });
        return response.data;
    },

    /**
     * Get available arguments for a plugin
     */
    getAvailableArguments: async (pluginSlug: string): Promise<any> => {
        const response = await api.get<any>(`/plugins/${pluginSlug}/arguments`);
        return response.data.data;
    },

    /**
     * Get plugin file data(MessagePack)
     */
    getFile: async (trajectoryId: string, analysisId: string, exposureId: string, timestep: number, filename: string): Promise<ArrayBuffer> => {
        const response = await api.get(
            `/plugins/file/${trajectoryId}/${analysisId}/${exposureId}/${timestep}/${filename}`,
            { responseType: 'arraybuffer' }
        );
        return response.data;
    },

    /**
     * Get exposure data(MessagePack)
     */
    getExposureData: async (pluginId: string, trajectoryId: string, analysisId: string, exposureId: string, timestep: number): Promise<ArrayBuffer> => {
        const response = await api.get(
            `/plugins/${pluginId}/trajectory/${trajectoryId}/analysis/${analysisId}/exposure/${exposureId}/timestep/${timestep}/file.msgpack`,
            { responseType: 'arraybuffer' }
        );
        return response.data;
    },

    /**
     * Get a single plugin by ID or slug
     */
    getPlugin: async (idOrSlug: string): Promise<IPluginRecord> => {
        const response = await api.get<GetPluginResponse>(`/plugins/${idOrSlug}`);
        return response.data.data;
    },

    /**
     * Create a new plugin
     */
    createPlugin: async (data: {
        slug?: string,
        workflow: IWorkflow,
        status?: PluginStatus,
        team?: string
    }): Promise<IPluginRecord> => {
        const response = await api.post<GetPluginResponse>('/plugins', data);
        return response.data.data;
    },

    /**
     * Update an existing plugin
     */
    updatePlugin: async (idOrSlug: string, data: {
        slug?: string,
        workflow?: IWorkflow,
        status?: PluginStatus
    }): Promise<IPluginRecord> => {
        const response = await api.put<GetPluginResponse>(`/plugins/${idOrSlug}`, data);
        return response.data.data;
    },

    /**
     * Delete a plugin
     */
    deletePlugin: async (idOrSlug: string): Promise<void> => {
        await api.delete(`/plugins/${idOrSlug}`);
    },

    /**
     * Validate a workflow without saving
     */
    validateWorkflow: async (workflow: IWorkflow): Promise<ValidateWorkflowResponse['data']> => {
        const response = await api.post<ValidateWorkflowResponse>('/plugins/validate', { workflow });
        return response.data.data;
    },

    /**
     * Publish a plugin(change status from draft to published)
     */
    publishPlugin: async (idOrSlug: string): Promise<IPluginRecord> => {
        const response = await api.post<GetPluginResponse>(`/plugins/${idOrSlug}/publish`);
        return response.data.data;
    },

    /**
     * Execute a plugin on a trajectory
     */
    executePlugin: async (
        pluginSlug: string,
        trajectoryId: string,
        config: Record<string, any>,
        timestep?: number
    ): Promise<string> => {
        const response = await api.post<ExecutePluginResponse>(
            `/plugins/${pluginSlug}/trajectory/${trajectoryId}/execute`,
            { config, timestep });
        return response.data.data.analysisId;
    },

    /**
     * Save or update a workflow
     */
    saveWorkflow: async (
        workflow: IWorkflow,
        existingId?: string,
        teamId?: string
    ): Promise<IPluginRecord> => {
        if (existingId) {
            return pluginApi.updatePlugin(existingId, { workflow });
        }
        return pluginApi.createPlugin({ workflow, team: teamId });
    },

    /**
     * Upload a binary file for a plugin
     */
    uploadBinary: async (
        pluginId: string,
        file: File,
        onProgress?: (progess: number) => void
    ): Promise<{ objectPath: string; fileName: string; size: number }> => {
        const formData = new FormData();
        formData.append('binary', file);

        const response = await api.post<{
            status: string;
            data: { objectPath: string; fileName: string; size: number };
        }>(`/plugins/${pluginId}/binary`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                }
            }
        });

        return response.data.data;
    },

    /**
     * Delete a binary file from plugin
     */
    /**
     * Delete a binary file from plugin
     */
    deleteBinary: async (pluginId: string): Promise<void> => {
        await api.delete(`/plugins/${pluginId}/binary`);
    },

    /**
     * Get node output schemas for template autocomplete
     */
    getNodeSchemas: async (): Promise<Record<string, any>> => {
        const response = await api.get<{ status: string; data: Record<string, any> }>('/plugins/schemas');
        return response.data.data;
    },

    /**
     * Get plugin listing data
     */
    getListing: async (
        pluginId: string,
        listingKey: string,
        trajectoryId?: string,
        params?: { page?: number; limit?: number; teamId?: string }
    ): Promise<any> => {
        const url = trajectoryId
            ? `/plugins/listing/${pluginId}/${listingKey}/${trajectoryId}`
            : `/plugins/listing/${pluginId}/${listingKey}`;
        const response = await api.get<{ status: string; data: any }>(url, { params });
        return response.data.data;
    },

    /**
     * Get per-frame listing data
     */
    getPerFrameListing: async (
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string | number,
        params?: { page?: number; limit?: number }
    ): Promise<any> => {
        const response = await api.get<{ status: string; data: any }>(
            `/plugins/per-frame-listing/${trajectoryId}/${analysisId}/${exposureId}/${timestep}`,
            { params }
        );
        return response.data.data;
    },

    /**
     * Execute a modifier on a trajectory
     */
    executeModifier: async (
        pluginId: string,
        modifierId: string,
        trajectoryId: string,
        payload: { config: Record<string, any>; timestep?: number }
    ): Promise<string> => {
        const response = await api.post<{ status: string; data: { analysisId: string } }>(
            `/plugins/${pluginId}/modifier/${modifierId}/trajectory/${trajectoryId}`,
            payload
        );
        return response.data.data.analysisId;
    }
};

export default pluginApi;
