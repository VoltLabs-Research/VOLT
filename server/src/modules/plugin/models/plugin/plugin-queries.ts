
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
