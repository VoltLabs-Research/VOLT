import { paginated, get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Plugin } from '../../../entities/plugin';
import type { GetPluginsInputDTO } from '../../../dtos/plugin/get-plugins';
import type { GetPluginInputDTO } from '../../../dtos/plugin/get-plugin';
import type { CreatePluginInputDTO } from '../../../dtos/plugin/create-plugin';
import type { UpdatePluginInputDTO } from '../../../dtos/plugin/update-plugin';
import type { DeletePluginInputDTO } from '../../../dtos/plugin/delete-plugin';
import type { ClonePluginInputDTO } from '../../../dtos/plugin/clone-plugin';

const endpoints = {
    getAll: paginated<GetPluginsInputDTO, PaginatedResponse<Plugin>>('/'),
    getById: get<GetPluginInputDTO, Plugin>('/:_id'),
    create: post<CreatePluginInputDTO, Plugin>('/', {
        unwrap: { field: 'plugin' }
    }),
    update: patch<UpdatePluginInputDTO, Plugin>('/:_id'),
    clone: post<ClonePluginInputDTO, Plugin>('/:pluginId/clone', {
        unwrap: { field: 'plugin' }
    }),
    delete: del<DeletePluginInputDTO>('/:_id')
};

export default endpoints;
