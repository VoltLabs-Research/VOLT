import type {
    RasterMetadata,
    RasterFrameData,
    ColorCodingPayload,
    ColorCodingStats,
    ColorCodingProperties
} from '../entities';


export interface IRasterRepository {
    generateGLB(id: string): Promise<any>;
    getMetadata(id: string): Promise<RasterMetadata>;
    getFrameData(
        trajectoryId: string,
        timestep: number,
        analysisId: string,
        model: string
    ): Promise<RasterFrameData>;

    // Color Coding methods
    applyColorCoding(
        trajectoryId: string,
        analysisId: string | undefined,
        timestep: number,
        payload: ColorCodingPayload
    ): Promise<void>;
    
    getColorCodingStats(
        trajectoryId: string,
        analysisId: string | undefined,
        params?: { timestep?: number; property?: string; type?: string; exposureId?: string }
    ): Promise<ColorCodingStats>;
    
    getColorCodingProperties(
        trajectoryId: string,
        analysisId: string | undefined,
        timestep: number
    ): Promise<ColorCodingProperties>;
}
