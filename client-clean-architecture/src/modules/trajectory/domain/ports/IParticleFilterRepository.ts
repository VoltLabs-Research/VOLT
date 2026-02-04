import type {
    GetFilterPropertiesInputDTO,
    GetFilterPropertiesOutputDTO,
    PreviewFilterInputDTO,
    PreviewFilterOutputDTO,
    ApplyFilterInputDTO,
    ApplyFilterOutputDTO,
    GetFilteredGlbInputDTO,
    GetUniqueValuesInputDTO,
    GetUniqueValuesOutputDTO
} from '../../application/dtos/particle-filter';

export default interface IParticleFilterRepository{
    getProperties(params: GetFilterPropertiesInputDTO): Promise<GetFilterPropertiesOutputDTO>;
    preview(params: PreviewFilterInputDTO): Promise<PreviewFilterOutputDTO>;
    applyAction(params: ApplyFilterInputDTO): Promise<ApplyFilterOutputDTO>;
    getFilteredGlb(params: GetFilteredGlbInputDTO): Promise<Blob>;
    getUniqueValues(params: GetUniqueValuesInputDTO): Promise<GetUniqueValuesOutputDTO>;
};
