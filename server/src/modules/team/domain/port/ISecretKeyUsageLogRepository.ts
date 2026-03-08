import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import SecretKeyUsageLog, { SecretKeyUsageLogProps } from '@modules/team/domain/entities/SecretKeyUsageLog';
import type { KeyUsageAnalytics, TeamUsageAnalytics } from '@modules/team/domain/contracts/SecretKeyUsageAnalytics';

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
    getTeamUsageAnalytics(teamId: string, days: number): Promise<TeamUsageAnalytics>;
    getKeyUsageAnalytics(secretKeyId: string, days: number): Promise<KeyUsageAnalytics>;
};
