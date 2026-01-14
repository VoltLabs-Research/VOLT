import { IBaseRepository } from "@/src/shared/domain/ports/IBaseRepository";
import ExposureMeta, { ExposureMetaProps } from "../entities/ExposureMeta";

export interface IExposureMetaRepository extends IBaseRepository<ExposureMeta, ExposureMetaProps>{

};