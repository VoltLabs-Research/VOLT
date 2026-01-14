import mongoose, { Model } from 'mongoose';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';
import { ExposureMetaProps } from '@/src/modules/plugin/domain/entities/ExposureMeta';
import { ExposureMetaSchema } from '../schemas/ExposureSchema';

type ExposureMetaRelations = 'plugin' | 'trajectory' | 'analysis';
export interface ExposureMetaDocument extends Persistable<ExposureMetaProps, ExposureMetaRelations>, Document{};

ExposureMetaSchema.index(
    { analysis: 1, exposureId: 1, timestep: 1 },
    { unique: true }
);

ExposureMetaSchema.index(
    { analysis: 1, timestep: 1 },
    { name: 'analysis_timestep_idx' }
);

ExposureMetaSchema.index(
    { analysis: 1, exposureId: 1, timestep: 1 },
    { name: 'analysis_exposure_timestep_idx' }
);

const ExposureMetaModel: Model<ExposureMetaDocument> = mongoose.model<ExposureMetaDocument>('PluginExposureMeta', ExposureMetaSchema);

export default ExposureMetaModel;