import { post } from '@/app/core/http/utilities/create-service';
import type { ExecutePluginInputDTO, ExecutePluginOutputDTO } from '../../../dtos/plugin/execute-plugin';

const endpoints = {
    execute: post<ExecutePluginInputDTO, ExecutePluginOutputDTO>('/:pluginId/trajectory/:trajectoryId/execute')
};

export default endpoints;
