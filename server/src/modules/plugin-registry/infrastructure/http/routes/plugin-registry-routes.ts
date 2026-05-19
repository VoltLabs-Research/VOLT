import PluginRegistryIndexService from '@modules/plugin-registry/infrastructure/services/PluginRegistryIndexService';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

const pluginRegistryIndexService = new PluginRegistryIndexService();

const ifNoneMatchIncludes = (value: string | string[] | undefined, etag: string): boolean => {
    const header = Array.isArray(value) ? value[0] : value;
    if (!header) {
        return false;
    }

    return header.split(',').map((entry) => entry.trim()).includes(etag);
};

export default createHttpModule({
    basePath: '/plugin-registry',
    protected: false,
    routes: (router) => {
        router.get('/index.json', async (request, response, next) => {
            try {
                const snapshot = await pluginRegistryIndexService.getSnapshot();

                if (ifNoneMatchIncludes(request.headers['if-none-match'], snapshot.etag)) {
                    response.status(304).end();
                    return;
                }

                response.setHeader(
                    'Cache-Control',
                    `public, max-age=${snapshot.maxAgeSeconds}, stale-while-revalidate=60`
                );
                response.setHeader('Content-Type', 'application/json; charset=utf-8');
                response.setHeader('ETag', snapshot.etag);
                response.setHeader('Last-Modified', new Date(snapshot.generatedAt).toUTCString());
                response.send(snapshot.body);
            } catch (error: unknown) {
                next(error);
            }
        });
    }
});
