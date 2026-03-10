import { createService } from '@/app/core/http/utilities/create-service';

type ServiceConfig = Parameters<typeof createService>[0];
type ServiceClients = Extract<ServiceConfig, { clients: Record<string, unknown> }>['clients'];

interface ServiceModuleConfig<TEndpoints extends Record<string, unknown>> {
    basePath?: string;
    clients?: ServiceClients;
    endpoints: TEndpoints;
}

export const defineServiceModule = <const TEndpoints extends Record<string, unknown>>(
    config: ServiceModuleConfig<TEndpoints>
) => {
    if (config.clients) {
        return createService({ clients: config.clients }, config.endpoints);
    }

    return createService(config.basePath ?? '/', config.endpoints);
};
