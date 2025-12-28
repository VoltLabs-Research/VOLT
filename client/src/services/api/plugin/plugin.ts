import type { AxiosRequestConfig } from 'axios';
import type { IWorkflow, PluginStatus } from '@/types/plugin';
import type { GetPluginsResponse, IPluginRecord, GetPluginResponse, ValidateWorkflowResponse, ExecutePluginResponse } from './types';
import VoltClient from '@/api';

const client = new VoltClient('/plugins', { useRBAC: true });

const pluginApi = {
    async getPlugins(params?: {
        status?: PluginStatus;
        page?: number;
        limit?: number;
        search?: string
    }): Promise<GetPluginsResponse> {
        const response = await client.request<GetPluginsResponse>('get', '/', {
            query: params
        });
        return response.data;
    },

    async getPublishedPlugins(): Promise<IPluginRecord[]> {
        const response = await pluginApi.getPlugins({ status: 'published' as PluginStatus });
        return response.data;
    },

    async getAvailableArguments(pluginSlug: string): Promise<any> {
        const response = await client.request<{ status: string; data: any }>('get', `/${pluginSlug}/arguments`);
        return response.data.data;
    },

    async getFile(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: number,
        filename: string
    ): Promise<ArrayBuffer> {
        const response = await client.request<ArrayBuffer>(
            'get',
            `/file/${trajectoryId}/${analysisId}/${exposureId}/${timestep}/${filename}`,
            {
                config: { responseType: 'arraybuffer' as AxiosRequestConfig['responseType'] },
                dedupe: false
            }
        );
        return response.data;
    },

    async getExposureData(
        _pluginId: string,
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: number
    ): Promise<ArrayBuffer> {
        const response = await client.request<ArrayBuffer>(
            'get',
            `/file/${trajectoryId}/${analysisId}/${exposureId}/${timestep}/file.msgpack`,
            {
                config: { responseType: 'arraybuffer' as AxiosRequestConfig['responseType'] },
                dedupe: false
            }
        );
        return response.data;
    },

    async getPlugin(idOrSlug: string): Promise<IPluginRecord> {
        const response = await client.request<GetPluginResponse>('get', `/${idOrSlug}`);
        return response.data.data;
    },

    async createPlugin(data: {
        slug?: string,
        workflow: IWorkflow,
        status?: PluginStatus,
        team?: string
    }): Promise<IPluginRecord> {
        const response = await client.request<GetPluginResponse>('post', '/', { data });
        return response.data.data;
    },

    async updatePlugin(idOrSlug: string, data: {
        slug?: string,
        workflow?: IWorkflow,
        status?: PluginStatus
    }): Promise<IPluginRecord> {
        const response = await client.request<GetPluginResponse>('patch', `/${idOrSlug}`, { data });
        return response.data.data;
    },

    async deletePlugin(idOrSlug: string): Promise<void> {
        await client.request('delete', `/${idOrSlug}`);
    },

    async validateWorkflow(workflow: IWorkflow): Promise<ValidateWorkflowResponse['data']> {
        const response = await client.request<ValidateWorkflowResponse>('patch', '/validate', { data: { workflow } });
        return response.data.data;
    },

    async publishPlugin(idOrSlug: string): Promise<IPluginRecord> {
        const response = await pluginApi.updatePlugin(idOrSlug, { status: 'published' as PluginStatus });
        return response as any;
    },

    async executePlugin(
        pluginSlug: string,
        trajectoryId: string,
        config: Record<string, any>,
        timestep?: number
    ): Promise<string> {
        const response = await client.request<ExecutePluginResponse>(
            'post',
            `/${pluginSlug}/trajectory/${trajectoryId}/execute`,
            { data: { config, timestep } }
        );
        return response.data.data.analysisId;
    },

    async saveWorkflow(workflow: IWorkflow, existingId?: string, teamId?: string): Promise<IPluginRecord> {
        if (existingId) {
            return pluginApi.updatePlugin(existingId, { workflow });
        }
        return pluginApi.createPlugin({ workflow, team: teamId });
    },

    async uploadBinary(
        pluginId: string,
        file: File,
        onProgress?: (progess: number) => void
    ): Promise<{ objectPath: string; fileName: string; size: number }> {
        const formData = new FormData();
        formData.append('binary', file);

        const response = await client.request<{
            status: string;
            data: { objectPath: string; fileName: string; size: number };
        }>('patch', `/${pluginId}/binary`, {
            data: formData,
            config: {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                    }
                }
            }
        });

        return response.data.data;
    },

    async deleteBinary(pluginId: string): Promise<void> {
        await client.request('delete', `/${pluginId}/binary`);
    },

    async getNodeSchemas(): Promise<Record<string, any>> {
        const response = await client.request<{ status: string; data: Record<string, any> }>('get', '/schemas');
        return response.data.data;
    },

    async getListing(
        pluginSlug: string,
        listingSlug: string,
        trajectoryId?: string,
        params?: { page?: number; limit?: number; teamId?: string }
    ): Promise<any> {
        const path = trajectoryId
            ? `/listing/${pluginSlug}/${listingSlug}/${trajectoryId}`
            : `/listing/${pluginSlug}/${listingSlug}`;

        const response = await client.request<{ status: string; data: any }>('get', path, {
            query: params
        });

        return response.data.data;
    },

    async getPerFrameListing(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string | number,
        params?: { page?: number; limit?: number }
    ): Promise<any> {
        const response = await client.request<{ status: string; data: any }>(
            'get',
            `/per-frame-listing/${trajectoryId}/${analysisId}/${exposureId}/${timestep}`,
            { query: params }
        );

        return response.data.data;
    },

    async executeModifier(
        pluginSlug: string,
        modifierSlug: string,
        trajectoryId: string,
        payload: { config: Record<string, any>; selectedFrameOnly?: boolean; timestep?: number }
    ): Promise<string> {
        const response = await client.request<{ status: string; data: { analysisId: string } }>(
            'post',
            `/${pluginSlug}/modifier/${modifierSlug}/trajectory/${trajectoryId}`,
            { data: payload }
        );
        return response.data.data.analysisId;
    },

    async exportPlugin(idOrSlug: string): Promise<Blob> {
        const response = await client.request<Blob>('get', `/${idOrSlug}/export`, {
            config: { responseType: 'blob' as AxiosRequestConfig['responseType'] },
            dedupe: false
        });
        return response.data;
    },

    async importPlugin(file: File, teamId?: string): Promise<IPluginRecord> {
        const formData = new FormData();
        formData.append('plugin', file);
        if (teamId) {
            formData.append('teamId', teamId);
        }

        const response = await client.request<GetPluginResponse>('post', '/import', {
            data: formData,
            config: { headers: { 'Content-Type': 'multipart/form-data' } }
        });

        return response.data.data;
    }
};

export default pluginApi;
