import ExposureMeta, { ExposureMetaProps } from "@/src/modules/plugin/domain/entities/ExposureMeta";
import { ExposureMetaDocument } from "../models/ExposureMetaModel";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";

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