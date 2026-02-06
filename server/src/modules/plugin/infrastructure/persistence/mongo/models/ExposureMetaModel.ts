import mongoose, { Model, Document } from 'mongoose';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { ExposureMetaProps } from '@modules/plugin/domain/entities/ExposureMeta';
import { ExposureMetaSchema } from '@modules/plugin/infrastructure/persistence/mongo/schemas/ExposureSchema';

type ExposureMetaRelations = 'plugin' | 'trajectory' | 'analysis';
export interface ExposureMetaDocument extends Persistable<ExposureMetaProps, ExposureMetaRelations>, Document { };

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