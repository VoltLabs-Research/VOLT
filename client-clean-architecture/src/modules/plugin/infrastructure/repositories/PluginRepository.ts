import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse, RawPaginatedResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
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
        const query: Record<string, unknown> = {
            page: params.page,
            limit: params.limit
        };

        if (params.search) {
            query.q = params.search;
        }

        if (params.status) {
            query.status = params.status;
        }

        const raw = await this.client.get<RawPaginatedResponse<Plugin>>('/', query);
        return this.unwrapPaginated(raw);
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

    async delete(id: string): Promise<void> {
        await this.client.delete<ApiResponse<void>>(`/${id}`);
    }

    async execute(params: ExecutePluginInputDTO): Promise<ExecutePluginOutputDTO> {
        const { pluginSlug, trajectoryId, ...body } = params;
        const response = await this.client.post<ApiResponse<{ analysisId: string }>>(
            `/${pluginSlug}/trajectory/${trajectoryId}/execute`,
            body
        );
        return this.unwrap(response);
    }

    async exportPlugin(id: string): Promise<Blob> {
        return this.client.request<Blob>('GET', `/${id}/export`, {
            responseType: 'blob'
        });
    }

    async importPlugin(file: File): Promise<Plugin> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await this.client.request<ApiResponse<Plugin>>('POST', '/import', {
            body: formData,
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return this.unwrap(response);
    }

    async uploadBinary(params: UploadBinaryInputDTO): Promise<UploadBinaryOutputDTO> {
        const { pluginId, file, onProgress } = params;
        const formData = new FormData();
        formData.append('file', file);

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
