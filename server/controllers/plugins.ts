import { Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime';
import PluginRegistry from '@/services/plugins/plugins-registry';

export const getManifests = catchAsync(async (req: Request, res: Response) => {
    const registry = new PluginRegistry();
    const manifests = await registry.getManifests();
    const pluginIds = Object.keys(manifests);

    return res.status(200).json({
        status: 'success',
        data: {
            manifests,
            pluginIds
        }
    });
});