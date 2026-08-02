import SecretKeyUsageLog from '@modules/team/models/SecretKeyUsageLog';
import type { SecretKeyEndpointStat, SecretKeyStatusCodeStat } from '@volt/contracts/modules/team/domain';
import type { SelectQueryBuilder } from 'typeorm';

export interface SecretKeyUsageOverview{
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
}

export interface SecretKeyUsagePerKey{
    secretKeyId: string;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: Date | null;
}

export interface SecretKeyUsageRequest{
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    createdAt: Date;
}

export interface UsageCountByLabel{
    label: string;
    count: number;
}

export interface TeamUsageAnalytics{
    overview: SecretKeyUsageOverview;
    perKey: SecretKeyUsagePerKey[];
    daily: Array<{ date: string; secretKeyId: string; count: number }>;
    topEndpoints: SecretKeyEndpointStat[];
}

export interface KeyUsageAnalytics{
    overview: SecretKeyUsageOverview & { requests24h: number; requests7d: number };
    hourly: UsageCountByLabel[];
    daily: UsageCountByLabel[];
    endpoints: SecretKeyEndpointStat[];
    statusDistribution: SecretKeyStatusCodeStat[];
    peakHour: number | null;
    recentRequests: SecretKeyUsageRequest[];
}

const SUCCESS_REQUESTS = 'SUM(CASE WHEN log.statusCode >= 200 AND log.statusCode < 300 THEN 1 ELSE 0 END)';
const TOTAL_REQUESTS = 'COUNT(log.id)';
const AVG_RESPONSE_TIME = 'AVG(log.responseTime)';
const RECENT_REQUESTS_LIMIT = 50;
const TOP_ENDPOINTS_LIMIT = 10;
const UNZONED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

interface AggregatedOverviewRow{
    totalRequests: number | string | null;
    successRequests: number | string | null;
    avgResponseTime: number | string | null;
}

interface AggregatedPerKeyRow extends AggregatedOverviewRow{
    secretKeyId: string;
    lastRequestAt: Date | string | null;
}

interface AggregatedTeamDailyRow{
    date: string;
    secretKeyId: string;
    count: number | string | null;
}

interface AggregatedLabelRow{
    label: string;
    count: number | string | null;
}

interface AggregatedEndpointRow{
    method: string;
    path: string;
    count: number | string | null;
    avgResponseTime: number | string | null;
    successRequests: number | string | null;
}

interface AggregatedStatusRow{
    code: number | string | null;
    count: number | string | null;
}

interface AggregatedPeakHourRow{
    hour: string | number | null;
    count: number | string | null;
}

const isPostgres = (): boolean => (
    SecretKeyUsageLog.getRepository().manager.connection.options.type === 'postgres'
);

const utcDateExpression = (): string => (
    isPostgres() ? 'to_char(log.createdAt, \'YYYY-MM-DD\')' : 'substr(log.createdAt, 1, 10)'
);

const utcHourExpression = (): string => (
    isPostgres() ? 'to_char(log.createdAt, \'HH24\')' : 'substr(log.createdAt, 12, 2)'
);

const toNumber = (value: number | string | null | undefined): number => Number(value ?? 0);

const toDate = (value: Date | string | null | undefined): Date | null => {
    if(value === null || value === undefined) return null;
    if(value instanceof Date) return value;
    const text = String(value);
    return new Date(UNZONED_TIMESTAMP.test(text) ? `${text.replace(' ', 'T')}Z` : text);
};

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

export const successRateOf = (successRequests: number, count: number): number => (
    count === 0 ? 0 : roundToTenth((successRequests / count) * 100)
);

const scopedQuery = (scope: 'team' | 'secretKey', scopeId: string, since: Date): SelectQueryBuilder<SecretKeyUsageLog> => (
    SecretKeyUsageLog.createQueryBuilder('log')
        .where(`log.${scope} = :scopeId`, { scopeId })
        .andWhere('log.createdAt >= :since', { since })
);

const readOverview = async (query: SelectQueryBuilder<SecretKeyUsageLog>): Promise<SecretKeyUsageOverview> => {
    const row = await query
        .select(TOTAL_REQUESTS, 'totalRequests')
        .addSelect(SUCCESS_REQUESTS, 'successRequests')
        .addSelect(AVG_RESPONSE_TIME, 'avgResponseTime')
        .getRawOne<AggregatedOverviewRow>();

    return {
        totalRequests: toNumber(row?.totalRequests),
        successRequests: toNumber(row?.successRequests),
        avgResponseTime: toNumber(row?.avgResponseTime)
    };
};

const readRequestCount = async (query: SelectQueryBuilder<SecretKeyUsageLog>): Promise<number> => {
    const row = await query
        .select(TOTAL_REQUESTS, 'totalRequests')
        .getRawOne<Pick<AggregatedOverviewRow, 'totalRequests'>>();

    return toNumber(row?.totalRequests);
};

const readEndpoints = async (
    query: SelectQueryBuilder<SecretKeyUsageLog>,
    limit?: number
): Promise<SecretKeyEndpointStat[]> => {
    const scopedEndpoints = query
        .select('log.method', 'method')
        .addSelect('log.path', 'path')
        .addSelect(TOTAL_REQUESTS, 'count')
        .addSelect(AVG_RESPONSE_TIME, 'avgResponseTime')
        .addSelect(SUCCESS_REQUESTS, 'successRequests')
        .groupBy('log.method')
        .addGroupBy('log.path')
        .orderBy(TOTAL_REQUESTS, 'DESC');

    if(limit !== undefined) scopedEndpoints.limit(limit);

    const rows = await scopedEndpoints.getRawMany<AggregatedEndpointRow>();

    return rows.map((row) => {
        const count = toNumber(row.count);

        return {
            method: row.method,
            path: row.path,
            count,
            avgResponseTime: Math.round(toNumber(row.avgResponseTime)),
            successRate: successRateOf(toNumber(row.successRequests), count)
        };
    });
};

const readDailyLabels = async (query: SelectQueryBuilder<SecretKeyUsageLog>): Promise<AggregatedLabelRow[]> => {
    const dateExpression = utcDateExpression();

    return query
        .select(dateExpression, 'label')
        .addSelect(TOTAL_REQUESTS, 'count')
        .groupBy(dateExpression)
        .orderBy(dateExpression, 'ASC')
        .getRawMany<AggregatedLabelRow>();
};

export const logSecretKeyUsageRequest = async (
    data: Pick<SecretKeyUsageLog, 'secretKey' | 'team' | 'method' | 'path' | 'statusCode' | 'responseTime' | 'ip' | 'userAgent'>
): Promise<void> => {
    await SecretKeyUsageLog.create({ ...data }).save();
};

export const getTeamUsageAnalytics = async (teamId: string, days: number): Promise<TeamUsageAnalytics> => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const dateExpression = utcDateExpression();

    const [overview, perKeyRows, dailyRows, topEndpoints] = await Promise.all([
        readOverview(scopedQuery('team', teamId, since)),
        scopedQuery('team', teamId, since)
            .select('log.secretKey', 'secretKeyId')
            .addSelect(TOTAL_REQUESTS, 'totalRequests')
            .addSelect(SUCCESS_REQUESTS, 'successRequests')
            .addSelect(AVG_RESPONSE_TIME, 'avgResponseTime')
            .addSelect('MAX(log.createdAt)', 'lastRequestAt')
            .groupBy('log.secretKey')
            .orderBy(TOTAL_REQUESTS, 'DESC')
            .getRawMany<AggregatedPerKeyRow>(),
        scopedQuery('team', teamId, since)
            .select(dateExpression, 'date')
            .addSelect('log.secretKey', 'secretKeyId')
            .addSelect(TOTAL_REQUESTS, 'count')
            .groupBy(dateExpression)
            .addGroupBy('log.secretKey')
            .orderBy(dateExpression, 'ASC')
            .getRawMany<AggregatedTeamDailyRow>(),
        readEndpoints(scopedQuery('team', teamId, since), TOP_ENDPOINTS_LIMIT)
    ]);

    return {
        overview,
        perKey: perKeyRows.map((row) => ({
            secretKeyId: row.secretKeyId,
            totalRequests: toNumber(row.totalRequests),
            successRequests: toNumber(row.successRequests),
            avgResponseTime: toNumber(row.avgResponseTime),
            lastRequestAt: toDate(row.lastRequestAt)
        })),
        daily: dailyRows.map((row) => ({
            date: row.date,
            secretKeyId: row.secretKeyId,
            count: toNumber(row.count)
        })),
        topEndpoints
    };
};

export const getKeyUsageAnalytics = async (secretKeyId: string, days: number): Promise<KeyUsageAnalytics> => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hourExpression = utcHourExpression();

    const [
        overview,
        requests24h,
        requests7d,
        hourlyRows,
        dailyRows,
        endpoints,
        statusRows,
        peakHourRow,
        recentRows
    ] = await Promise.all([
        readOverview(scopedQuery('secretKey', secretKeyId, since)),
        readRequestCount(scopedQuery('secretKey', secretKeyId, since).andWhere('log.createdAt >= :last24h', { last24h })),
        readRequestCount(scopedQuery('secretKey', secretKeyId, since).andWhere('log.createdAt >= :last7d', { last7d })),
        scopedQuery('secretKey', secretKeyId, since)
            .andWhere('log.createdAt >= :last24h', { last24h })
            .select(hourExpression, 'label')
            .addSelect(TOTAL_REQUESTS, 'count')
            .groupBy(hourExpression)
            .orderBy(hourExpression, 'ASC')
            .getRawMany<AggregatedLabelRow>(),
        readDailyLabels(scopedQuery('secretKey', secretKeyId, since)),
        readEndpoints(scopedQuery('secretKey', secretKeyId, since)),
        scopedQuery('secretKey', secretKeyId, since)
            .select('log.statusCode', 'code')
            .addSelect(TOTAL_REQUESTS, 'count')
            .groupBy('log.statusCode')
            .orderBy('log.statusCode', 'ASC')
            .getRawMany<AggregatedStatusRow>(),
        scopedQuery('secretKey', secretKeyId, since)
            .andWhere('log.createdAt >= :last24h', { last24h })
            .select(hourExpression, 'hour')
            .addSelect(TOTAL_REQUESTS, 'count')
            .groupBy(hourExpression)
            .orderBy(TOTAL_REQUESTS, 'DESC')
            .limit(1)
            .getRawOne<AggregatedPeakHourRow>(),
        SecretKeyUsageLog.find({
            where: { secretKey: secretKeyId },
            order: { createdAt: 'DESC' },
            take: RECENT_REQUESTS_LIMIT
        })
    ]);

    return {
        overview: {
            ...overview,
            requests24h,
            requests7d
        },
        hourly: hourlyRows.map((row) => ({
            label: `${row.label}:00`,
            count: toNumber(row.count)
        })),
        daily: dailyRows.map((row) => ({
            label: row.label,
            count: toNumber(row.count)
        })),
        endpoints,
        statusDistribution: statusRows.map((row) => ({
            code: toNumber(row.code),
            count: toNumber(row.count)
        })),
        peakHour: peakHourRow?.hour === null || peakHourRow?.hour === undefined
            ? null
            : Number(peakHourRow.hour),
        recentRequests: recentRows.map((row) => ({
            method: row.method,
            path: row.path,
            statusCode: row.statusCode,
            responseTime: row.responseTime,
            ip: row.ip,
            createdAt: row.createdAt
        }))
    };
};
