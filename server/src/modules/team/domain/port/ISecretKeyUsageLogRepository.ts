import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import SecretKeyUsageLog, { SecretKeyUsageLogProps } from '@modules/team/domain/entities/SecretKeyUsageLog';
import { TeamUsageMetrics, KeyUsageMetrics } from '@modules/team/application/dtos/secret-key/SecretKeyUsageTypes';

export interface LogRequestInput {
    secretKey: string;
    team: string;
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    userAgent: string;
};

export interface ISecretKeyUsageLogRepository extends IBaseRepository<SecretKeyUsageLog, SecretKeyUsageLogProps> {
    logRequest(data: LogRequestInput): Promise<void>;
    getTeamMetrics(teamId: string, days: number): Promise<TeamUsageMetrics>;
    getKeyMetrics(secretKeyId: string, days: number): Promise<KeyUsageMetrics>;
};
