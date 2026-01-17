import { IExposureMetaRepository } from "@/src/modules/plugin/domain/ports/IExposureMetaRepository";
import ExposureMeta, { ExposureMetaProps } from "@/src/modules/plugin/domain/entities/ExposureMeta";
import ExposureMetaModel, { ExposureMetaDocument } from "../models/ExposureMetaModel";
import ExposureMetaMapper from '../mappers/ExposureMetaMapper';
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from "tsyringe";

@injectable()
export default class ExposureMetaRepository
    extends MongooseBaseRepository<ExposureMeta, ExposureMetaProps, ExposureMetaDocument>
    implements IExposureMetaRepository {

    constructor() {
        super(ExposureMetaModel, new ExposureMetaMapper());
    }
};