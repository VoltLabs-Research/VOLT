import ExposureMeta, { ExposureMetaProps } from '@modules/plugin/domain/entities/ExposureMeta';
import { ExposureMetaDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/ExposureMetaModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class ExposureMetaMapper extends BaseMapper<ExposureMeta, ExposureMetaProps, ExposureMetaDocument>{
    constructor(){
        super(ExposureMeta, [
            'plugin',
            'trajectory',
            'analysis'
        ]);
    }
};

export default ExposureMetaMapper;