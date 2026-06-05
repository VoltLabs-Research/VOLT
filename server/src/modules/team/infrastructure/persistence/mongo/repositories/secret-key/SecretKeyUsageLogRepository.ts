import SecretKeyUsageLog, { SecretKeyUsageLogProps } from '@modules/team/domain/entities/secret-key/SecretKeyUsageLog';
import { ISecretKeyUsageLogRepository, LogRequestInput } from '@modules/team/domain/port/secret-key/ISecretKeyUsageLogRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import secretKeyUsageLogMapper from '@modules/team/infrastructure/persistence/mongo/mappers/secret-key/SecretKeyUsageLogMapper';
import SecretKeyUsageLogModel, { SecretKeyUsageLogDocument } from '@modules/team/infrastructure/persistence/mongo/models/secret-key/SecretKeyUsageLogModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import mongoose from 'mongoose';

import type { KeyUsageAnalytics, TeamUsageAnalytics } from '@modules/team/domain/contracts/secret-key/SecretKeyUsageAnalytics';
import type { KeyUsageMetrics, TeamUsageMetrics } from '@modules/team/domain/contracts/secret-key/SecretKeyUsageMetrics';
import type { PipelineStage } from 'mongoose';

interface TeamMetricsOverviewRow {
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
};

interface TeamMetricsPerKeyRow {
    _id: mongoose.Types.ObjectId;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: Date | null;
};

interface TeamMetricsDailyRow {
    _id: {
        date: string;
        secretKey: mongoose.Types.ObjectId;
    };
    count: number;
};

interface KeyMetricsOverviewRow extends TeamMetricsOverviewRow {
    requests24h: number;
    requests7d: number;
};

interface CountByLabelRow {
    _id: string;
    count: number;
};

interface PeakHourRow {
    _id: number;
    count: number;
};

interface StatusDistributionRow {
    code: number;
    count: number;
};

interface RecentRequestRow {
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    createdAt: Date;
};

interface TeamMetricsAggregateResult {
    overview: TeamMetricsOverviewRow[];
    perKey: TeamMetricsPerKeyRow[];
    daily: TeamMetricsDailyRow[];
    topEndpoints: TeamUsageMetrics['topEndpoints'];
};

interface KeyMetricsAggregateResult {
    overview: KeyMetricsOverviewRow[];
    hourly: CountByLabelRow[];
    daily: CountByLabelRow[];
    endpoints: KeyUsageMetrics['endpoints'];
    statusDistribution: StatusDistributionRow[];
    peakHour: PeakHourRow[];
};

interface MatchCreatedAtSinceStage {
    $match: {
        team?: mongoose.Types.ObjectId;
        secretKey?: mongoose.Types.ObjectId;
        createdAt: {
            $gte: Date;
        };
    };
};

interface AggregateOverviewDefault {
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
};

interface KeyOverviewDefault extends AggregateOverviewDefault {
    requests24h: number;
    requests7d: number;
};

const createTeamSinceMatchStage = (teamObjectId: mongoose.Types.ObjectId, since: Date): MatchCreatedAtSinceStage => {
    return {
        $match: {
            team: teamObjectId,
            createdAt: {
                $gte: since
            }
        }
    };
};

const createSecretKeySinceMatchStage = (keyObjectId: mongoose.Types.ObjectId, since: Date): MatchCreatedAtSinceStage => {
    return {
        $match: {
            secretKey: keyObjectId,
            createdAt: {
                $gte: since
            }
        }
    };
};

const createDefaultAggregateOverview = (): AggregateOverviewDefault => {
    return {
        totalRequests: 0,
        successRequests: 0,
        avgResponseTime: 0
    };
};

const createDefaultKeyOverview = (): KeyOverviewDefault => {
    return {
        totalRequests: 0,
        successRequests: 0,
        avgResponseTime: 0,
        requests24h: 0,
        requests7d: 0
    };
};

const IS_SUCCESS_STATUS = { $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] };

const COUNT_SUCCESS = { $sum: { $cond: [IS_SUCCESS_STATUS, 1, 0] } };

type FacetStage = PipelineStage.Group | PipelineStage.Sort | PipelineStage.Limit | PipelineStage.Project;

const endpointPipelineStages = (limit?: number): FacetStage[] => {
    const stages: FacetStage[] = [
        {
            $group: {
                _id: { method: '$method', path: '$path' },
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$responseTime' },
                successCount: COUNT_SUCCESS
            }
        },
        { $sort: { count: -1 } }
    ];
    if (limit !== undefined) {
        stages.push({ $limit: limit });
    }
    stages.push({
        $project: {
            _id: 0,
            method: '$_id.method',
            path: '$_id.path',
            count: 1,
            avgResponseTime: { $round: ['$avgResponseTime', 0] },
            successRate: {
                $round: [{ $multiply: [{ $divide: ['$successCount', '$count'] }, 100] }, 1]
            }
        }
    });
    return stages;
};

@Singleton(TEAM_TOKENS.SecretKeyUsageLogRepository)
export default class SecretKeyUsageLogRepository
    extends MongooseBaseRepository<SecretKeyUsageLog, SecretKeyUsageLogProps, SecretKeyUsageLogDocument>
    implements ISecretKeyUsageLogRepository {

    constructor() {
        super(SecretKeyUsageLogModel, secretKeyUsageLogMapper);
    }

    async logRequest(data: LogRequestInput): Promise<void> {
        const payload: SecretKeyUsageLogProps = {
            ...data,
            createdAt: new Date()
        };

        await this.create(payload);
    }

    async getTeamUsageAnalytics(teamId: string, days: number): Promise<TeamUsageAnalytics> {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const teamObjectId = new mongoose.Types.ObjectId(teamId);

        const [result] = await this.model.aggregate<TeamMetricsAggregateResult>([
            createTeamSinceMatchStage(teamObjectId, since),
            {
                $facet: {
                    overview: [
                        {
                            $group: {
                                _id: null,
                                totalRequests: { $sum: 1 },
                                successRequests: COUNT_SUCCESS,
                                avgResponseTime: { $avg: '$responseTime' }
                            }
                        }
                    ],
                    perKey: [
                        {
                            $group: {
                                _id: '$secretKey',
                                totalRequests: { $sum: 1 },
                                successRequests: COUNT_SUCCESS,
                                avgResponseTime: { $avg: '$responseTime' },
                                lastRequestAt: { $max: '$createdAt' }
                            }
                        },
                        { $sort: { totalRequests: -1 } }
                    ],
                    daily: [
                        {
                            $group: {
                                _id: {
                                    date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                                    secretKey: '$secretKey'
                                },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { '_id.date': 1 } }
                    ],
                    topEndpoints: endpointPipelineStages(10)
                }
            }
        ]);

        const overview = result.overview[0] || createDefaultAggregateOverview();

        return {
            overview,
            perKey: result.perKey.map((pk) => ({
                secretKeyId: pk._id.toString(),
                totalRequests: pk.totalRequests,
                successRequests: pk.successRequests,
                avgResponseTime: pk.avgResponseTime || 0,
                lastRequestAt: pk.lastRequestAt || null
            })),
            daily: result.daily.map((row) => ({
                date: row._id.date,
                secretKeyId: row._id.secretKey.toString(),
                count: row.count
            })),
            topEndpoints: result.topEndpoints
        };
    }

    async getKeyUsageAnalytics(secretKeyId: string, days: number): Promise<KeyUsageAnalytics> {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const keyObjectId = new mongoose.Types.ObjectId(secretKeyId);

        const [result] = await this.model.aggregate<KeyMetricsAggregateResult>([
            createSecretKeySinceMatchStage(keyObjectId, since),
            {
                $facet: {
                    overview: [
                        {
                            $group: {
                                _id: null,
                                totalRequests: { $sum: 1 },
                                successRequests: COUNT_SUCCESS,
                                avgResponseTime: { $avg: '$responseTime' },
                                requests24h: {
                                    $sum: { $cond: [{ $gte: ['$createdAt', last24h] }, 1, 0] }
                                },
                                requests7d: {
                                    $sum: { $cond: [{ $gte: ['$createdAt', last7d] }, 1, 0] }
                                }
                            }
                        }
                    ],
                    hourly: [
                        { $match: { createdAt: { $gte: last24h } } },
                        {
                            $group: {
                                _id: { $dateToString: { format: '%H:00', date: '$createdAt' } },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    daily: [
                        {
                            $group: {
                                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    endpoints: endpointPipelineStages(),
                    statusDistribution: [
                        {
                            $group: {
                                _id: '$statusCode',
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } },
                        { $project: { _id: 0, code: '$_id', count: 1 } }
                    ],
                    peakHour: [
                        { $match: { createdAt: { $gte: last24h } } },
                        {
                            $group: {
                                _id: { $hour: '$createdAt' },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 1 }
                    ]
                }
            }
        ]);

        const overview = result.overview[0] || createDefaultKeyOverview();

        const recentDocs = await this.model
            .find({ secretKey: keyObjectId })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('method path statusCode responseTime ip createdAt')
            .lean<RecentRequestRow[]>();

        return {
            overview,
            hourly: result.hourly.map((hour) => ({
                label: hour._id,
                count: hour.count
            })),
            daily: result.daily.map((day) => ({
                label: day._id,
                count: day.count
            })),
            endpoints: result.endpoints,
            statusDistribution: result.statusDistribution,
            peakHour: result.peakHour[0]?._id ?? null,
            recentRequests: recentDocs.map((doc) => ({
                method: doc.method,
                path: doc.path,
                statusCode: doc.statusCode,
                responseTime: doc.responseTime,
                ip: doc.ip,
                createdAt: doc.createdAt
            }))
        };
    }
};
