import { IPluginBinaryCacheService } from '@modules/plugin/domain/port/plugin/IPluginBinaryCacheService';

import { injectable, singleton } from 'tsyringe';

@singleton()
@injectable()
export default class PluginBinaryCacheService implements IPluginBinaryCacheService{
    async evictByPluginId(_pluginId: string): Promise<void>{
        // no-op: plugin binaries live in MinIO; the local cache has been removed.
    }
};
