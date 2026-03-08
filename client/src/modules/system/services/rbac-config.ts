import apiService from '../api/service';
import type { GetRBACConfigOutputDTO, RBACActionDTO, RBACResourceDTO } from '../api/dtos/get-rbac-config';
import type { RBACAction, RBACConfig, RBACResource } from '../api/entities/rbac';

const toRBACResource = (resource: RBACResourceDTO): RBACResource => ({
    key: resource.key,
    label: resource.label
});

const toRBACAction = (action: RBACActionDTO): RBACAction => ({
    key: action.key,
    label: action.label
});

const toRBACConfig = (config: GetRBACConfigOutputDTO): RBACConfig => ({
    resources: config.resources.map(toRBACResource),
    actions: config.actions.map(toRBACAction)
});

export const getRBACConfig = async (): Promise<RBACConfig> => {
    const config = await apiService.getRBACConfig({});

    return toRBACConfig(config);
};
