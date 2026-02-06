import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import ExposureMeta, { ExposureMetaProps } from '@modules/plugin/domain/entities/ExposureMeta';

export interface IExposureMetaRepository extends IBaseRepository<ExposureMeta, ExposureMetaProps>{

};