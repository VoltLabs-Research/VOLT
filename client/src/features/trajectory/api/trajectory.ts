/**
 * Copyright(C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 **/

import type { Trajectory } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import type { GetTrajectoriesParams, FsListResponse, TrajectoryInfo } from '@/features/trajectory/types';
import VoltClient from '@/api';

const client = new VoltClient('/trajectories', { useRBAC: true });
const vfsClient = new VoltClient('/trajectory-vfs', { useRBAC: true });
const vfsOpsClient = new VoltClient('/trajectory-vfs', { useRBAC: false });
const particleFilterClient = new VoltClient('/particle-filter', { useRBAC: true });

const trajectoryApi = {
    async getAll(params: GetTrajectoriesParams): Promise<Trajectory[]> {
        const response = await client.request<ApiResponse<Trajectory[]>>('get', '/', {
            query: params
        });
        return response.data.data;
    },

    async getOne(id: string): Promise<Trajectory> {
        const response = await client.request<ApiResponse<Trajectory>>('get', `/${id}`);
        return response.data.data;
    },

    async create(formData: FormData, onProgress?: (progress: number) => void): Promise<Trajectory> {
        const response = await client.request<ApiResponse<Trajectory>>('post', '/', {
            data: formData,
            config: {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (evt) => {
                    const total = evt.total ?? 0;
                    if (total > 0 && onProgress) {
                        onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
                    }
                }
            }
        });
        return response.data.data;
    },

    async update(
        id: string,
        data: Partial<Pick<Trajectory, 'name' | 'isPublic' | 'preview'>>
    ): Promise<Trajectory> {
        const response = await client.request<ApiResponse<Trajectory>>('patch', `/${id}`, {
            data
        });
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await client.request('delete', `/${id}`);
    },

    async downloadDumps(trajectoryId: string, trajectoryName?: string): Promise<void> {
        const response = await client.request<Blob>('get', `/${trajectoryId}/download`, {
            config: { responseType: 'blob' },
            dedupe: false
        });

        const url = URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${trajectoryName || 'trajectory'}-dumps.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    async getPreview(
        trajectoryId: string,
        options?: { headers?: Record<string, string>; timeout?: number }
    ): Promise<string> {
        const cacheBuster = new URLSearchParams({
            t: Date.now().toString(),
            r: Math.random().toString(36)
        }).toString();

        const response = await client.request<ApiResponse<string>>('get', `/${trajectoryId}/preview?${cacheBuster}`, {
            config: {
                headers: options?.headers,
                timeout: options?.timeout ?? 15000
            },
            dedupe: false
        });

        return response.data.data;
    },

    async getAllPaginated(params?: GetTrajectoriesParams & { sort?: string; q?: string }): Promise<{
        data: Trajectory[];
        page: number;
        limit: number;
        total: number;
    }> {
        const response = await client.request<{
            status: string;
            data: {
                data: Trajectory[];
                page: number;
                limit: number;
                total: number;
            };
        }>('get', '/', {
            query: params
        });

        return response.data.data;
    },

    async getMetrics(): Promise<any> {
        const response = await client.request<ApiResponse<any>>('get', '/metrics');
        return response.data.data;
    },

    async getAtoms(
        trajectoryId: string,
        analysisId: string,
        params: { timestep: number; exposureId: string; page?: number; pageSize?: number }
    ): Promise<{
        data: any[];
        properties: string[];
        page: number;
        pageSize: number;
        total: number;
        hasMore: boolean;
    } | null> {
        const response = await client.request<any>('get', `/${trajectoryId}/analysis/${analysisId}`, {
            query: {
                timestep: params.timestep,
                exposureId: params.exposureId,
                page: params?.page ?? 1,
                pageSize: params?.pageSize ?? 1000
            }
        });

        const result = response.data.data;
        if (!result || result.status !== 'success') {
            return null;
        }

        return {
            data: result.data,
            properties: result.properties,
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            hasMore: result.hasMore
        };
    },

    vfs: {
        async list(params: { connectionId: string; path: string }): Promise<FsListResponse> {
            // connectionId is the trajectoryId
            const response = await vfsOpsClient.request<{ status: 'success'; data: FsListResponse }>('get', `/${params.connectionId}`, {
                query: { path: params.path }
            });

            return response.data.data;
        },

        async download(params: { connectionId: string; path: string }): Promise<Blob> {
            // Map download to /files endpoint for single file download
            // Note: If path implies a directory, we might want /archive, but usually download implies file in this context.
            const response = await vfsOpsClient.request<Blob>('get', `/${params.connectionId}/files`, {
                query: { path: params.path },
                config: {
                    responseType: 'blob'
                },
                dedupe: false
            });

            return response.data;
        },

        async getTrajectories(): Promise<TrajectoryInfo[]> {
            // usage of useRBAC: true is correct here as backend expects /:teamId/trajectories
            const response = await vfsClient.request<{ status: 'success'; data: { trajectories: TrajectoryInfo[] } }>(
                'get',
                '/trajectories'
            );

            return response.data.data.trajectories;
        }
    },

    particleFilter: {
        async getProperties(trajectoryId: string, analysisId: string | undefined, timestep: number): Promise<{ dump: string[]; perAtom: string[] }> {
            const path = analysisId
                ? `/properties/${trajectoryId}/${analysisId}`
                : `/properties/${trajectoryId}`;
            const response = await particleFilterClient.request<{ status: 'success'; data: { dump: string[]; perAtom: string[] } }>('get', path, {
                query: { timestep }
            });
            return response.data.data;
        },

        async preview(params: {
            trajectoryId: string;
            analysisId?: string;
            timestep: number;
            property: string;
            operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
            value: number;
            exposureId?: string;
        }): Promise<{ matchCount: number; totalAtoms: number }> {
            const { trajectoryId, analysisId, ...queryParams } = params;
            const path = analysisId
                ? `/preview/${trajectoryId}/${analysisId}`
                : `/preview/${trajectoryId}`;
            const response = await particleFilterClient.request<{
                status: 'success';
                data: { matchCount: number; totalAtoms: number };
            }>('get', path, {
                query: queryParams
            });
            return response.data.data;
        },

        async applyAction(params: {
            trajectoryId: string;
            analysisId?: string;
            timestep: number;
            property: string;
            operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
            value: number;
            action: 'delete' | 'highlight';
            exposureId?: string;
        }): Promise<{ fileId: string; atomsResult: number; action: string }> {
            const { trajectoryId, analysisId, timestep, action, ...bodyParams } = params;
            const path = analysisId
                ? `/${trajectoryId}/${analysisId}`
                : `/${trajectoryId}`;
            const response = await particleFilterClient.request<{
                status: 'success';
                data: { fileId: string; atomsResult: number; action: string };
            }>('post', path, {
                query: { timestep, action },
                data: bodyParams
            });
            return response.data.data;
        },

        async getFilteredGLB(trajectoryId: string, analysisId: string | undefined, fileId: string): Promise<Blob> {
            const path = analysisId
                ? `/${trajectoryId}/${analysisId}`
                : `/${trajectoryId}`;
            const response = await particleFilterClient.request<Blob>('get', path, {
                query: { fileId },
                config: { responseType: 'blob' },
                dedupe: false
            });
            return response.data;
        }
    }
};

export default trajectoryApi;
