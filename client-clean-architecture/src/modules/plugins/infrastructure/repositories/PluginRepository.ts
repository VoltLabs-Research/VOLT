import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api';
import type { IPluginRepository } from '../../domain/repositories/IPluginRepository';
import type { Plugin, PluginStatus, IWorkflow } from '../../domain/entities';

export class PluginRepository extends BaseRepository implements IPluginRepository {
    constructor() {
        super('/plugin', { useRBAC: true });
    }

    async getPlugins(params?: {
        status?: PluginStatus;
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<PaginatedResponse<Plugin>> {
        return this.get<PaginatedResponse<Plugin>>('/', { query: params });
    }

    async getPlugin(idOrSlug: string): Promise<Plugin> {
        return this.get<Plugin>(`/${idOrSlug}`);
    }

    async createPlugin(data: {
        slug?: string;
        workflow: IWorkflow;
        status?: PluginStatus;
        team?: string;
    }): Promise<Plugin> {
        return this.post<Plugin>('/', data);
    }

    async updatePlugin(idOrSlug: string, data: {
        slug?: string;
        workflow?: IWorkflow;
        status?: PluginStatus;
    }): Promise<Plugin> {
        return this.patch<Plugin>(`/${idOrSlug}`, data);
    }

    async deletePlugin(idOrSlug: string): Promise<void> {
        await this.delete(`/${idOrSlug}`);
    }

    async executePlugin(
        pluginSlug: string,
        trajectoryId: string,
        options: {
            config: Record<string, any>;
            selectedFrameOnly?: boolean;
            timestep?: number;
        }
    ): Promise<string> {
        const response = await this.client.request<ApiResponse<{ jobId: string }>>('post', `/${pluginSlug}/execute`, {
            data: { trajectoryId, ...options }
        });
        return response.data.data.jobId;
    }

    async uploadBinary(
        pluginId: string,
        file: File,
        onProgress?: (progress: number) => void
    ): Promise<{ objectPath: string; fileName: string; size: number }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await this.client.request<ApiResponse<{ objectPath: string; fileName: string; size: number }>>('post', `/${pluginId}/binary`, {
            data: formData,
            config: {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (evt) => {
                    const total = evt.total ?? 0;
                    if (total > 0 && onProgress) {
                        onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
                    }
                }
            }
        });
        return response.data.data;
    }

    async deleteBinary(pluginId: string): Promise<void> {
        await this.delete(`/${pluginId}/binary`);
    }

    async getNodeSchemas(): Promise<Record<string, any>> {
        return this.get<Record<string, any>>('/schemas/nodes');
    }

    async getListing(
        pluginSlug: string,
        listingSlug: string,
        trajectoryId?: string,
        params?: { page?: number; limit?: number; teamId?: string; cursor?: string }
    ): Promise<any> {
        const path = trajectoryId
            ? `/listing/${pluginSlug}/${listingSlug}/${trajectoryId}`
            : `/listing/${pluginSlug}/${listingSlug}`;

        return this.get<any>(path, { query: params });
    }

    async getPerFrameListing(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string | number,
        params?: { page?: number; limit?: number }
    ): Promise<any> {
        return this.get<any>(`/per-frame-listing/${trajectoryId}/${analysisId}/${exposureId}/${timestep}`, { query: params });
    }

    async exportPlugin(idOrSlug: string): Promise<Blob> {
        const response = await this.client.request<Blob>('get', `/${idOrSlug}/export`, {
            config: { responseType: 'blob' },
            dedupe: false
        });
        return response.data;
    }

    async importPlugin(file: File, teamId?: string): Promise<Plugin> {
        const formData = new FormData();
        formData.append('file', file);
        if (teamId) {
            formData.append('teamId', teamId);
        }

        const response = await this.client.request<ApiResponse<Plugin>>('post', '/import', {
            data: formData,
            config: { headers: { 'Content-Type': 'multipart/form-data' } }
        });
        return response.data.data;
    }

    async exportAnalysisResults(pluginSlug: string, analysisId: string): Promise<Blob> {
        return this.get<Blob>(`/${pluginSlug}/analysis/${analysisId}/export-results`, {
            config: { responseType: 'blob' },
            dedupe: false
        });
    }

    async getChartImage(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: number | string
    ): Promise<string> {
        const response = await this.client.request<Blob>(
            'get',
            `/chart/${trajectoryId}/${analysisId}/${exposureId}/${timestep}`,
            {
                config: { responseType: 'blob' },
                dedupe: false
            }
        );
        return URL.createObjectURL(response.data);
    }

    async publishPlugin(idOrSlug: string): Promise<Plugin> {
        return this.updatePlugin(idOrSlug, { status: 'published' as PluginStatus });
    }

    async saveWorkflow(workflow: IWorkflow, existingId?: string, teamId?: string): Promise<Plugin> {
        if (existingId) {
            return this.updatePlugin(existingId, { workflow });
        }
        return this.createPlugin({ workflow, team: teamId });
    }

    async getFile(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: number | string,
        filename: string
    ): Promise<ArrayBuffer> {
        const response = await this.client.request<ArrayBuffer>(
            'get',
            `/file/${trajectoryId}/${analysisId}/${exposureId}/${timestep}/${filename}`,
            {
                config: { responseType: 'arraybuffer' },
                dedupe: false
            }
        );
        return response.data;
    }
}

export const pluginRepository = new PluginRepository();
