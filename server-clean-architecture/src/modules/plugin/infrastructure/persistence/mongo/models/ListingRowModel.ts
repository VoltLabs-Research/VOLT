import mongoose, { Model } from 'mongoose';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';
import { ListingRowProps } from '@/src/modules/plugin/domain/entities/ListingRow';
import { ListingRowSchema } from '../schemas/ListingRowSchema';

type ListingRowRelations = 'plugin' | 'team' | 'trajectory' | 'analysis';
export interface ListingRowDocument extends Persistable<ListingRowProps, ListingRowRelations>, Document{};

ListingRowSchema.index({
    plugin: 1,
    listingSlug: 1,
    trajectory: 1,
    analysis: 1,
    timestep: 1
}, { unique: true });

const ListingRowModel: Model<ListingRowDocument> = mongoose.model<ListingRowDocument>('PluginListingRow', ListingRowSchema);

export default ListingRowModel;