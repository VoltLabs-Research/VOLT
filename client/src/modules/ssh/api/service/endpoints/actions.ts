import { post } from '@/app/core/http/utilities/create-service';
import type { TestSSHConnectionInputDTO, TestSSHConnectionResponse } from '../../dtos/test-ssh-connection';

const endpoints = {
    testConnection: post<TestSSHConnectionInputDTO, TestSSHConnectionResponse>('/:sshConnectionId/connection-tests')
};

export default endpoints;
