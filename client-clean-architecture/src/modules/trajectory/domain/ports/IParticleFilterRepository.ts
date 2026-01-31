import type {
    GetFilterPropertiesInputDTO,
    GetFilterPropertiesOutputDTO,
    PreviewFilterInputDTO,
    PreviewFilterOutputDTO,
    ApplyFilterInputDTO,
    ApplyFilterOutputDTO,
    GetFilteredGlbInputDTO
} from '../../application/dtos/particle-filter';

export default interface IParticleFilterRepository{
    getProperties(params: GetFilterPropertiesInputDTO): Promise<GetFilterPropertiesOutputDTO>;
    preview(params: PreviewFilterInputDTO): Promise<PreviewFilterOutputDTO>;
    applyAction(params: ApplyFilterInputDTO): Promise<ApplyFilterOutputDTO>;
    getFilteredGlb(params: GetFilteredGlbInputDTO): Promise<Blob>;
};
