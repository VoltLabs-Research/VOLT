/**
 * Plain query functions for the Plugin model, replacing the deleted
 * PluginRepository for the one custom query it used to expose (`findByIds`)
 * that is consumed from more than one call site (both inside
 * `PluginDependencyResolverService`). ActiveRecord style: talks directly to
 * PluginModel, no repository/mapper indirection.
 */
import PluginModel, { toPluginLike, type Plugin } from '@modules/plugin/models/plugin/PluginModel';

export const findPluginsByIds = async (ids: string[]): Promise<Plugin[]> => {
    if (!ids.length) {
        return [];
    }

    const documents = await PluginModel.find({
        _id: {
            $in: ids
        }
    }).exec();

    return documents.map((document) => toPluginLike(document));
};
