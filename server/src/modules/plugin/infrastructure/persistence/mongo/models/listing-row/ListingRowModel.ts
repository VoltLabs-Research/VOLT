import { ListingRowProps } from '@modules/plugin/domain/entities/listing-row/ListingRow';
import { ListingRowSchema } from '@modules/plugin/infrastructure/persistence/mongo/schemas/listing-row/ListingRowSchema';

import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Model, Document } from 'mongoose';

type ListingRowRelations = 'plugin' | 'team' | 'trajectory' | 'analysis';
export interface ListingRowDocument extends Persistable<ListingRowProps, ListingRowRelations>, Document { };

ListingRowSchema.index({
    plugin: 1,
    exposureId: 1,
    trajectory: 1,
    analysis: 1,
    timestep: 1
}, { unique: true });

ListingRowSchema.index({
    team: 1,
    plugin: 1,
    exposureId: 1,
    analysis: 1,
    timestep: -1
});

const ListingRowModel: Model<ListingRowDocument> = mongoose.model<ListingRowDocument>('PluginListingRow', ListingRowSchema);

export default ListingRowModel;