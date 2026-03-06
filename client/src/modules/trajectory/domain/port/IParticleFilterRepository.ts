import type {
    GetFilterPropertiesInputDTO,
    GetFilterPropertiesOutputDTO,
    PreviewFilterInputDTO,
    PreviewFilterOutputDTO,
    ApplyFilterInputDTO,
    ApplyFilterOutputDTO,
    GetUniqueValuesInputDTO,
    GetUniqueValuesOutputDTO
} from '../../application/dtos/particle-filter';

export default interface IParticleFilterRepository{
    getProperties(params: GetFilterPropertiesInputDTO): Promise<GetFilterPropertiesOutputDTO>;
    preview(params: PreviewFilterInputDTO): Promise<PreviewFilterOutputDTO>;
    applyAction(params: ApplyFilterInputDTO): Promise<ApplyFilterOutputDTO>;
    getUniqueValues(params: GetUniqueValuesInputDTO): Promise<GetUniqueValuesOutputDTO>;
};
