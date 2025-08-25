import Trajectory from '@/models/trajectory';
import StructureAnalysis from '@/models/structure-analysis';
import Dislocation from '@/models/dislocations';

export const getMetricsByTeamId = async (teamId: string) => {
    const now = new Date();
    const tz = process.env.TZ || 'UTC';
    const weeks = 12;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const trajectories = await Trajectory.find({ team: { $in: [teamId] } }).select('_id createdAt');
    const trajectoryIds = trajectories.map(({ _id }) => _id);
    
    const totals = await Promise.all([
        Trajectory.countDocuments({ team: { $in: [teamId] } }),
        StructureAnalysis.countDocuments({ trajectory: { $in: trajectoryIds } }),
        Dislocation.aggregate([
            { $match: { trajectory: { $in: trajectoryIds } } },
            { $group: { _id: null, total: { $sum: '$totalSegments' } } }
        ])
    ]);

    const totalTrajectories = totals[0] || 0;
    const totalStructAnalyses = totals[1] || 0;
    const totalDislocations = (totals[2][0]?.total as number) || 0;

    const [currTrajectory, prevTrajectory] = await Promise.all([
        Trajectory.countDocuments({ team: { $in: [teamId] }, createdAt: { $gte: monthStart, $lt: now } }),
        Trajectory.countDocuments({ team: { $in: [teamId] }, createdAt: { $gte: prevMonthStart, $lt: monthStart } })
    ]);

    const [currStruct, prevStruct] = await Promise.all([
        StructureAnalysis.countDocuments({ trajectory: { $in: trajectoryIds }, createdAt: { $gte: monthStart, $lt: now } }),
        StructureAnalysis.countDocuments({ trajectory: { $in: trajectoryIds }, createdAt: { $gte: prevMonthStart, $lt: monthStart } })
    ]);

    const currDislocationsAgg = await Dislocation.aggregate([
        { $match: { trajectory: { $in: trajectoryIds }, createdAt: { $gte: monthStart, $lt: now } } },
        { $group: { _id: null, total: { $sum: '$totalSegments' } } }
    ]);

    const prevDislocationsAgg = await Dislocation.aggregate([
        { $match: { trajectory: { $in: trajectoryIds }, createdAt: { $gte: prevMonthStart, $lt: monthStart } } },
        { $group: { _id: null, total: { $sum: '$totalSegments' } } }
    ]);

    const dislCurr = (currDislocationsAgg[0]?.total as number) || 0;
    const dislPrev = (prevDislocationsAgg[0]?.total as number) || 0;

    const pct = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : Math.round(((c - p) / p) * 100);
    const lastMonth = {
        trajectories: pct(currTrajectory, prevTrajectory),
        structureAnalysis: pct(currStruct, prevStruct),
        dislocations: pct(dislCurr, dislPrev)
    };

    const sinceDate = new Date(now);
    sinceDate.setUTCDate(sinceDate.getUTCDate() - (weeks * 7));
    sinceDate.setUTCHours(0, 0, 0, 0);

    const trajWeekly = await Trajectory.aggregate([
        { $match: { team: { $in: [teamId] }, createdAt: { $gte: sinceDate } } },
        { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'week', timezone: tz } }, value: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    const structWeekly = await StructureAnalysis.aggregate([
        { $match: { trajectory: { $in: trajectoryIds }, createdAt: { $gte: sinceDate } } },
        { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'week', timezone: tz } }, value: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    const dislWeekly = await Dislocation.aggregate([
        { $match: { trajectory: { $in: trajectoryIds }, createdAt: { $gte: sinceDate } } },
        { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'week', timezone: tz } }, value: { $sum: '$totalSegments' } } },
        { $sort: { _id: 1 } }
    ]);

    const key = (d: any) => new Date(d).toISOString().slice(0, 10);
    const allKeys = new Set<string>();
    
    for(const r of trajWeekly) allKeys.add(key(r._id));
    for(const r of structWeekly) allKeys.add(key(r._id));
    for(const r of dislWeekly) allKeys.add(key(r._id));

    const sorted = Array.from(allKeys).sort();
    const clampLastN = sorted.slice(-weeks);

    const toDict = (arr: Array<{ _id: Date; value: number }>) => {
        const m = new Map<string, number>();
        for(const r of arr) m.set(key(r._id), r.value);
        return m;
    };

    const dTraj = toDict(trajWeekly as any);
    const dStruct = toDict(structWeekly as any);
    const dDisl = toDict(dislWeekly as any);

    const seriesTraj = clampLastN.map((k) => dTraj.get(k) ?? 0);
    const seriesStruct = clampLastN.map((k) => dStruct.get(k) ?? 0);
    const seriesDisl = clampLastN.map((k) => dDisl.get(k) ?? 0);

    return {
        totals: {
            structureAnalysis: totalStructAnalyses,
            trajectories: totalTrajectories,
            dislocations: totalDislocations
        },
        lastMonth,
        weekly: {
            labels: clampLastN,      
            trajectories: seriesTraj,
            structureAnalysis: seriesStruct,
            dislocations: seriesDisl
        }
    };
};