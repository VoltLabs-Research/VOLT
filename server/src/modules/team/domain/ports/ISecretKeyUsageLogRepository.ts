import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import SecretKeyUsageLog, { SecretKeyUsageLogProps } from '@modules/team/domain/entities/SecretKeyUsageLog';

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

export interface EndpointStat {
    method: string;
    path: string;
    count: number;
    avgResponseTime: number;
    successRate: number;
};

export interface StatusCodeStat {
    code: number;
    count: number;
};

export interface PerKeyMetric {
    _id: string;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: Date | null;
};

export interface TeamUsageMetrics {
    overview: {
        totalRequests: number;
        successRate: number;
        avgResponseTime: number;
    };
    perKey: PerKeyMetric[];
    daily: {
        labels: string[];
        total: number[];
        byKey: Record<string, number[]>;
    };
    topEndpoints: EndpointStat[];
};

export interface KeyUsageMetrics {
    stats: {
        totalRequests: number;
        requests24h: number;
        requests7d: number;
        successRate: number;
        avgResponseTime: number;
        peakHour: string;
    };
    hourly: {
        labels: string[];
        data: number[];
    };
    daily: {
        labels: string[];
        data: number[];
    };
    endpoints: EndpointStat[];
    statusDistribution: StatusCodeStat[];
    recentRequests: {
        method: string;
        path: string;
        statusCode: number;
        responseTime: number;
        ip: string;
        createdAt: Date;
    }[];
};

export interface ISecretKeyUsageLogRepository extends IBaseRepository<SecretKeyUsageLog, SecretKeyUsageLogProps> {
    logRequest(data: LogRequestInput): Promise<void>;
    getTeamMetrics(teamId: string, days: number): Promise<TeamUsageMetrics>;
    getKeyMetrics(secretKeyId: string, days: number): Promise<KeyUsageMetrics>;
};
