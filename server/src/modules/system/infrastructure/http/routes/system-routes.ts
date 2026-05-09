import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';

const toLabel = (key: string): string =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase());

const RBAC_CONFIG = {
    resources: Object.entries(Resource).map(([enumKey, value]) => ({
        key: value,
        label: toLabel(enumKey)
    })),
    actions: Object.entries(Action).map(([enumKey, value]) => ({
        key: value,
        label: toLabel(enumKey)
    }))
};

export default createHttpModule({
    basePath: '/api/system',
    protected: true,
    routes: (router) => {
        router.get('/rbac', (_req, res) => {
            BaseResponse.success(res, RBAC_CONFIG);
        });
    }
});
