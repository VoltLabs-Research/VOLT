import { IExposureMetaRepository } from '@modules/plugin/domain/ports/IExposureMetaRepository';
import ExposureMeta, { ExposureMetaProps } from '@modules/plugin/domain/entities/ExposureMeta';
import ExposureMetaModel, { ExposureMetaDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/ExposureMetaModel';
import ExposureMetaMapper from '@modules/plugin/infrastructure/persistence/mongo/mappers/ExposureMetaMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class ExposureMetaRepository
    extends MongooseBaseRepository<ExposureMeta, ExposureMetaProps, ExposureMetaDocument>
    implements IExposureMetaRepository {

    constructor() {
        super(ExposureMetaModel, new ExposureMetaMapper());
    }
};