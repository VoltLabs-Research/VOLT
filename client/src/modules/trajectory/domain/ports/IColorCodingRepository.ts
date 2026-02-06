import type {
    ApplyColorCodingInputDTO,
    GetColorCodingPropertiesInputDTO,
    ColorCodingProperties,
    GetColorCodingStatsInputDTO,
    ColorCodingStats
} from '../../application/dtos/color-coding';

export default interface IColorCodingRepository {
    getProperties(params: GetColorCodingPropertiesInputDTO): Promise<ColorCodingProperties>;
    getStats(params: GetColorCodingStatsInputDTO): Promise<ColorCodingStats>;
    apply(params: ApplyColorCodingInputDTO): Promise<void>;
}
