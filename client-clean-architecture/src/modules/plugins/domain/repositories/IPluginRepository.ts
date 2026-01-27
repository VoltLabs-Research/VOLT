import type { PaginatedResponse } from '@/shared/types/api';
import type { Plugin, PluginStatus, IWorkflow } from '../entities';


export interface IPluginRepository {
    getPlugins(params?: {
        status?: PluginStatus;
        page?: number;
        limit?: number;
        search?: string
    }): Promise<PaginatedResponse<Plugin>>;
    
    getPlugin(idOrSlug: string): Promise<Plugin>;
    
    createPlugin(data: {
        slug?: string,
        workflow: IWorkflow,
        status?: PluginStatus,
        team?: string
    }): Promise<Plugin>;
    
    updatePlugin(idOrSlug: string, data: {
        slug?: string,
        workflow?: IWorkflow,
        status?: PluginStatus
    }): Promise<Plugin>;
    
    deletePlugin(idOrSlug: string): Promise<void>;
    
    executePlugin(
        pluginSlug: string,
        trajectoryId: string,
        options: {
            config: Record<string, any>;
            selectedFrameOnly?: boolean;
            timestep?: number;
        }
    ): Promise<string>;
    
    uploadBinary(
        pluginId: string,
        file: File,
        onProgress?: (progress: number) => void
    ): Promise<{ objectPath: string; fileName: string; size: number }>;

    deleteBinary(pluginId: string): Promise<void>;
    
    getNodeSchemas(): Promise<Record<string, any>>;

    getListing(
        pluginSlug: string,
        listingSlug: string,
        trajectoryId?: string,
        params?: { page?: number; limit?: number; teamId?: string; cursor?: string }
    ): Promise<any>;

    getPerFrameListing(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string | number,
        params?: { page?: number; limit?: number }
    ): Promise<any>;

    exportPlugin(idOrSlug: string): Promise<Blob>;

    importPlugin(file: File, teamId?: string): Promise<Plugin>;

    exportAnalysisResults(pluginSlug: string, analysisId: string): Promise<Blob>;

    getChartImage(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: number | string
    ): Promise<string>;

    publishPlugin(idOrSlug: string): Promise<Plugin>;

    saveWorkflow(workflow: IWorkflow, existingId?: string, teamId?: string): Promise<Plugin>;
}
