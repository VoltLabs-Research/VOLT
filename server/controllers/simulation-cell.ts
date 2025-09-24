import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Team, Trajectory, SimulationCell } from '@/models/index';

// List simulation cells accessible to the current user (by team/trajectory/analysisConfig filters)
export const getUserSimulationCells = async (req: Request, res: Response) => {
  try{
    const userId = (req as any).user?.id;
    const {
      teamId,
      trajectoryId,
      analysisConfigId,
      timestepFrom,
      timestepTo,
      page = '1',
      limit = '100',
      sort = '-createdAt',
      q = ''
    } = req.query as Record<string, string>;

    // Resolve team membership
    let teamIds: string[] = [];
    if(teamId){
      if(!isValidObjectId(teamId)){
        return res.status(400).json({ status: 'error', data: { error: 'Invalid teamId' } });
      }
      const team = await Team.findOne({ _id: teamId, members: userId }).select('_id');
      if(!team){
        return res.status(403).json({ status: 'error', data: { error: 'Forbidden: not a team member' } });
      }
  teamIds = [(team as any)._id.toString()];
    }else{
      const teams = await Team.find({ members: userId }).select('_id');
  teamIds = (teams as any[]).map((t: any) => t._id.toString());
    }

    if(teamIds.length === 0){
      return res.status(200).json({ status: 'success', data: { page: 1, limit: 0, total: 0, cells: [] } });
    }

    // Resolve trajectories
    let trajectoryIds: string[] = [];
    if(trajectoryId){
      if(!isValidObjectId(trajectoryId)){
        return res.status(400).json({ status: 'error', data: { error: 'Invalid trajectoryId' } });
      }
      const traj = await Trajectory.findOne({ _id: trajectoryId }).select('_id team');
      if(!traj){
        return res.status(404).json({ status: 'error', data: { error: 'Trajectory not found' } });
      }
      if(!teamIds.includes(traj.team.toString())){
        return res.status(403).json({ status: 'error', data: { error: 'Forbidden: trajectory not in your teams' } });
      }
      trajectoryIds = [traj._id.toString()];
    }else{
      const trajectories = await Trajectory.find({ team: { $in: teamIds } }).select('_id');
      trajectoryIds = trajectories.map((t) => t._id.toString());
    }

    if(trajectoryIds.length === 0){
      return res.status(200).json({ status: 'success', data: { page: 1, limit: 0, total: 0, cells: [] } });
    }

    const match: any = { trajectory: { $in: trajectoryIds } };

    if(analysisConfigId){
      if(!isValidObjectId(analysisConfigId)){
        return res.status(400).json({ status: 'error', data: { error: 'Invalid analysisConfigId' } });
      }
      match.analysisConfig = analysisConfigId;
    }

    const fromNum = Number(timestepFrom);
    const toNum = Number(timestepTo);
    if(!Number.isNaN(fromNum) || !Number.isNaN(toNum)){
      match.timestep = {};
      if(!Number.isNaN(fromNum)) match.timestep.$gte = fromNum;
      if(!Number.isNaN(toNum))   match.timestep.$lte = toNum;
      if(Object.keys(match.timestep).length === 0) delete match.timestep;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
    const skip = (pageNum - 1) * limitNum;

    const sortObj: Record<string, 1 | -1> = {};
    if(typeof sort === 'string' && sort.length){
      const fields = sort.split(',').map((s) => s.trim()).filter(Boolean);
      for(const f of fields){
        if(f.startsWith('-')) sortObj[f.slice(1)] = -1;
        else sortObj[f] = 1;
      }
    }else{
      sortObj.createdAt = -1;
    }

    const query = typeof q === 'string' ? q.trim() : '';
    const regex = query ? { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } : null;

    let rows: any[] = [];
    let totalDocs = 0;

    if (regex) {
      // Use aggregation to filter by trajectory.name or analysisConfig.identificationMode
      const pipeline: any[] = [
        { $match: match },
        { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
        { $addFields: { trajectoryDoc: { $arrayElemAt: ['$trajectoryDoc', 0] } } },
        { $lookup: { from: 'analysisconfigs', localField: 'analysisConfig', foreignField: '_id', as: 'analysisConfigDoc' } },
        { $addFields: { analysisConfigDoc: { $arrayElemAt: ['$analysisConfigDoc', 0] } } },
        { $match: { $or: [ { 'trajectoryDoc.name': regex }, { 'analysisConfigDoc.identificationMode': regex } ] } },
        { $sort: sortObj },
        { $skip: skip },
        { $limit: limitNum },
        { $project: {
          trajectory: { _id: '$trajectoryDoc._id', name: '$trajectoryDoc.name', team: '$trajectoryDoc.team' },
          analysisConfig: { _id: '$analysisConfigDoc._id', identificationMode: '$analysisConfigDoc.identificationMode', RMSD: '$analysisConfigDoc.RMSD', crystalStructure: '$analysisConfigDoc.crystalStructure' },
          timestep: 1,
          volume: 1,
          dimensionality: 1,
          angles: 1,
          periodicBoundaryConditions: 1,
          createdAt: 1,
          updatedAt: 1
        } }
      ];

      const countPipeline: any[] = [
        { $match: match },
        { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
        { $addFields: { trajectoryDoc: { $arrayElemAt: ['$trajectoryDoc', 0] } } },
        { $lookup: { from: 'analysisconfigs', localField: 'analysisConfig', foreignField: '_id', as: 'analysisConfigDoc' } },
        { $addFields: { analysisConfigDoc: { $arrayElemAt: ['$analysisConfigDoc', 0] } } },
        { $match: { $or: [ { 'trajectoryDoc.name': regex }, { 'analysisConfigDoc.identificationMode': regex } ] } },
        { $count: 'total' }
      ];

      const [aggRows, aggCount] = await Promise.all([
        SimulationCell.aggregate(pipeline),
        SimulationCell.aggregate(countPipeline)
      ]);
      rows = aggRows as any[];
      totalDocs = (aggCount?.[0]?.total as number) ?? 0;
    } else {
      const [found, total] = await Promise.all([
        SimulationCell.find(match)
          .select('trajectory analysisConfig timestep volume dimensionality angles periodicBoundaryConditions createdAt updatedAt')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .populate({ path: 'trajectory', select: 'name _id team' })
          .populate({ path: 'analysisConfig', select: '_id identificationMode RMSD crystalStructure' })
          .lean(),
        SimulationCell.countDocuments(match)
      ]);
      rows = found as any[];
      totalDocs = total as number;
    }

    return res.status(200).json({
      status: 'success',
      data: { page: pageNum, limit: limitNum, total: totalDocs, cells: rows }
    });
  }catch(err){
    console.error('getUserSimulationCells error:', err);
    return res.status(500).json({ status: 'error', data: { error: 'Internal Server Error' } });
  }
};
