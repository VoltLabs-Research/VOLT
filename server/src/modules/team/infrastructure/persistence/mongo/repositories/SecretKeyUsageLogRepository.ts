import mongoose from 'mongoose';
import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import SecretKeyUsageLog, { SecretKeyUsageLogProps } from '@modules/team/domain/entities/SecretKeyUsageLog';
import {
    ISecretKeyUsageLogRepository,
    LogRequestInput,
    TeamUsageMetrics,
    KeyUsageMetrics
} from '@modules/team/domain/ports/ISecretKeyUsageLogRepository';
import SecretKeyUsageLogModel, { SecretKeyUsageLogDocument } from '@modules/team/infrastructure/persistence/mongo/models/SecretKeyUsageLogModel';
import secretKeyUsageLogMapper from '@modules/team/infrastructure/persistence/mongo/mappers/SecretKeyUsageLogMapper';

@injectable()
export default class SecretKeyUsageLogRepository
    extends MongooseBaseRepository<SecretKeyUsageLog, SecretKeyUsageLogProps, SecretKeyUsageLogDocument>
    implements ISecretKeyUsageLogRepository {

    constructor() {
        super(SecretKeyUsageLogModel, secretKeyUsageLogMapper);
    }

    async logRequest(data: LogRequestInput): Promise<void> {
        await this.model.create({
            secretKey: data.secretKey,
            team: data.team,
            method: data.method,
            path: data.path,
            statusCode: data.statusCode,
            responseTime: data.responseTime,
            ip: data.ip,
            userAgent: data.userAgent
        });
    }

    async getTeamMetrics(teamId: string, days: number): Promise<TeamUsageMetrics> {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const teamObjectId = new mongoose.Types.ObjectId(teamId);

        const [result] = await this.model.aggregate([
            { $match: { team: teamObjectId, createdAt: { $gte: since } } },
            {
                $facet: {
                    overview: [
                        {
                            $group: {
                                _id: null,
                                totalRequests: { $sum: 1 },
                                successRequests: {
                                    $sum: { $cond: [{ $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] }, 1, 0] }
                                },
                                avgResponseTime: { $avg: '$responseTime' }
                            }
                        }
                    ],
                    perKey: [
                        {
                            $group: {
                                _id: '$secretKey',
                                totalRequests: { $sum: 1 },
                                successRequests: {
                                    $sum: { $cond: [{ $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] }, 1, 0] }
                                },
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
                    topEndpoints: [
                        {
                            $group: {
                                _id: { method: '$method', path: '$path' },
                                count: { $sum: 1 },
                                avgResponseTime: { $avg: '$responseTime' },
                                successCount: {
                                    $sum: { $cond: [{ $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] }, 1, 0] }
                                }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 10 },
                        {
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
                        }
                    ]
                }
            }
        ]);

        const overview = result.overview[0] || { totalRequests: 0, successRequests: 0, avgResponseTime: 0 };
        const successRate = overview.totalRequests > 0
            ? Math.round((overview.successRequests / overview.totalRequests) * 1000) / 10
            : 0;

        const dateSet = new Set<string>();
        const keyDayMap: Record<string, Record<string, number>> = {};

        for (const row of result.daily) {
            const date = row._id.date;
            const keyId = row._id.secretKey.toString();
            dateSet.add(date);
            if (!keyDayMap[keyId]) keyDayMap[keyId] = {};
            keyDayMap[keyId][date] = row.count;
        }

        const labels = Array.from(dateSet).sort();
        const byKey: Record<string, number[]> = {};
        const total = labels.map(() => 0);

        for (const [keyId, dayMap] of Object.entries(keyDayMap)) {
            byKey[keyId] = labels.map((label, i) => {
                const count = dayMap[label] || 0;
                total[i] += count;
                return count;
            });
        }

        return {
            overview: {
                totalRequests: overview.totalRequests,
                successRate,
                avgResponseTime: Math.round(overview.avgResponseTime || 0)
            },
            perKey: result.perKey.map((pk: any) => ({
                _id: pk._id.toString(),
                totalRequests: pk.totalRequests,
                successRequests: pk.successRequests,
                avgResponseTime: Math.round(pk.avgResponseTime || 0),
                lastRequestAt: pk.lastRequestAt || null
            })),
            daily: { labels, total, byKey },
            topEndpoints: result.topEndpoints
        };
    }

    async getKeyMetrics(secretKeyId: string, days: number): Promise<KeyUsageMetrics> {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const keyObjectId = new mongoose.Types.ObjectId(secretKeyId);

        const [result] = await this.model.aggregate([
            { $match: { secretKey: keyObjectId, createdAt: { $gte: since } } },
            {
                $facet: {
                    overview: [
                        {
                            $group: {
                                _id: null,
                                totalRequests: { $sum: 1 },
                                successRequests: {
                                    $sum: { $cond: [{ $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] }, 1, 0] }
                                },
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
                    endpoints: [
                        {
                            $group: {
                                _id: { method: '$method', path: '$path' },
                                count: { $sum: 1 },
                                avgResponseTime: { $avg: '$responseTime' },
                                successCount: {
                                    $sum: { $cond: [{ $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] }, 1, 0] }
                                }
                            }
                        },
                        { $sort: { count: -1 } },
                        {
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
                        }
                    ],
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

        const ov = result.overview[0] || { totalRequests: 0, successRequests: 0, avgResponseTime: 0, requests24h: 0, requests7d: 0 };
        const successRate = ov.totalRequests > 0
            ? Math.round((ov.successRequests / ov.totalRequests) * 1000) / 10
            : 0;

        const peakHourRaw = result.peakHour[0]?._id;
        const peakHour = peakHourRaw !== undefined
            ? `${String(peakHourRaw).padStart(2, '0')}:00`
            : '--:--';

        const recentDocs = await this.model
            .find({ secretKey: keyObjectId })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('method path statusCode responseTime ip createdAt')
            .lean();

        return {
            stats: {
                totalRequests: ov.totalRequests,
                requests24h: ov.requests24h,
                requests7d: ov.requests7d,
                successRate,
                avgResponseTime: Math.round(ov.avgResponseTime || 0),
                peakHour
            },
            hourly: {
                labels: result.hourly.map((h: any) => h._id),
                data: result.hourly.map((h: any) => h.count)
            },
            daily: {
                labels: result.daily.map((d: any) => d._id),
                data: result.daily.map((d: any) => d.count)
            },
            endpoints: result.endpoints,
            statusDistribution: result.statusDistribution,
            recentRequests: recentDocs.map((doc: any) => ({
                method: doc.method,
                path: doc.path,
                statusCode: doc.statusCode,
                responseTime: doc.responseTime,
                ip: doc.ip,
                createdAt: doc.createdAt
            }))
        };
    }
}
