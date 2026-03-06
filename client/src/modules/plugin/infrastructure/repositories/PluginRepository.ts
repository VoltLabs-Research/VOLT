import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import { buildFileFormData } from '@/shared/utils/file';
import type IPluginRepository from '../../domain/port/IPluginRepository';
import type { Plugin } from '../../domain/entities';
import type {
    GetPluginsInputDTO,
    GetPluginsOutputDTO,
    GetPluginInputDTO,
    GetPluginOutputDTO,
    CreatePluginInputDTO,
    CreatePluginOutputDTO,
    UpdatePluginInputDTO,
    UpdatePluginOutputDTO,
    ExecutePluginInputDTO,
    ExecutePluginOutputDTO,
    UploadBinaryInputDTO,
    UploadBinaryOutputDTO
} from '../../application/dtos';

@injectable()
export default class PluginRepository extends BaseRepository implements IPluginRepository {
    constructor() {
        super('/plugin', { useRBAC: true });
    }

    async getAll(params: GetPluginsInputDTO): Promise<GetPluginsOutputDTO> {
        return this.getAllPaginated('/', params);
    }

    async getById(params: GetPluginInputDTO): Promise<GetPluginOutputDTO> {
        const response = await this.client.get<ApiResponse<Plugin>>(`/${params.id}`);
        return this.unwrap(response);
    }

    async create(data: CreatePluginInputDTO): Promise<CreatePluginOutputDTO> {
        const response = await this.client.post<ApiResponse<Plugin>>('/', data);
        return this.unwrap(response);
    }

    async update(params: UpdatePluginInputDTO): Promise<UpdatePluginOutputDTO> {
        const { id, ...data } = params;
        const response = await this.client.patch<ApiResponse<Plugin>>(`/${id}`, data);
        return this.unwrap(response);
    }

    async clone(pluginId: string, teamId: string): Promise<Plugin> {
        const response = await this.client.post<ApiResponse<{ plugin: Plugin }>>(`/${pluginId}/clone`, { teamId });
        return this.unwrap(response).plugin;
    }

    async delete(id: string): Promise<void> {
        await this.client.delete<ApiResponse<void>>(`/${id}`);
    }

    async execute(params: ExecutePluginInputDTO): Promise<ExecutePluginOutputDTO> {
        const { pluginId, trajectoryId, ...body } = params;
        const response = await this.client.post<ApiResponse<{ analysisId: string }>>(
            `/${pluginId}/trajectory/${trajectoryId}/execute`,
            body
        );
        return this.unwrap(response);
    }

    async exportPlugin(id: string): Promise<Blob> {
        return this.client.request<Blob>('GET', `/${id}/export`, {
            responseType: 'blob'
        });
    }

    async exportAnalysisResults(pluginId: string, analysisId: string): Promise<Blob> {
        return this.client.request<Blob>('GET', `/${pluginId}/analysis/${analysisId}/export-results`, {
            responseType: 'blob'
        });
    }

    async importPlugin(file: File): Promise<Plugin> {
        const formData = buildFileFormData([{ name: 'file', file }]);

        const response = await this.client.request<ApiResponse<Plugin>>('POST', '/import', {
            body: formData,
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return this.unwrap(response);
    }

    async uploadBinary(params: UploadBinaryInputDTO): Promise<UploadBinaryOutputDTO> {
        const { pluginId, file, onProgress } = params;
        const formData = buildFileFormData([{ name: 'file', file }]);

        const response = await this.client.request<ApiResponse<UploadBinaryOutputDTO>>(
            'PATCH',
            `/${pluginId}/binary`,
            {
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: onProgress ? (e) => {
                    if (e.total) {
                        onProgress(e.loaded / e.total);
                    }
                } : undefined
            }
        );
        return this.unwrap(response);
    }

    async deleteBinary(pluginId: string): Promise<void> {
        await this.client.delete<ApiResponse<void>>(`/${pluginId}/binary`);
    }
};
