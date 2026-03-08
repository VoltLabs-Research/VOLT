import { SubListingRowProps } from '@modules/plugin/domain/entities/listing-row/SubListingRow';
import { SubListingRowSchema } from '@modules/plugin/infrastructure/persistence/mongo/schemas/listing-row/SubListingRowSchema';

import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Model, Document } from 'mongoose';

type SubListingRowRelations = 'plugin' | 'team' | 'trajectory' | 'analysis';
export interface SubListingRowDocument extends Persistable<SubListingRowProps, SubListingRowRelations>, Document {};

SubListingRowSchema.index({
    analysis: 1,
    exposureId: 1,
    timestep: 1,
    subListingName: 1,
    _id: 1
});

const SubListingRowModel: Model<SubListingRowDocument> = mongoose.model<SubListingRowDocument>(
    'PluginSubListingRow',
    SubListingRowSchema
);

export default SubListingRowModel;
