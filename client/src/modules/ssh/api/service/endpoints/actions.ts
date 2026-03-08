import { get } from '@/app/core/http/utilities/create-service';
import type { TestSSHConnectionInputDTO, TestSSHConnectionResponse } from '../../dtos/test-ssh-connection';

const endpoints = {
    testConnection: get<TestSSHConnectionInputDTO, TestSSHConnectionResponse>('/:connectionId/test')
};

export default endpoints;
