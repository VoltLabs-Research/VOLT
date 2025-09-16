import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Team, Trajectory, Dislocations } from '@/models/index';

// TODO: HandlerFactory
export const getUserDislocations = async (req: Request, res: Response) => {
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
      sort = '-createdAt'
    } = req.query as Record<string, string>;
    let teamIds: string[] = [];
    if(teamId){
      if(!isValidObjectId(teamId)){
        return res.status(400).json({ status: 'error', data: { error: 'teamId inválido' } });
      }
      const team = await Team.findOne({ _id: teamId, members: userId }).select('_id');
      if(!team){
        return res.status(403).json({ status: 'error', data: { error: 'Forbidden. No perteneces a este equipo.' } });
      }
      teamIds = [team._id.toString()];
    }else{
      const teams = await Team.find({ members: userId }).select('_id');
      teamIds = teams.map(t => t._id.toString());
    }

    if(teamIds.length === 0){
      return res.status(200).json({
        status: 'success',
        data: { page: 1, limit: 0, total: 0, totals: { segments: 0, points: 0, length: 0 }, dislocations: [] }
      });
    }

    let trajectoryIds: string[] = [];
    if(trajectoryId){
      if(!isValidObjectId(trajectoryId)){
        return res.status(400).json({ status: 'error', data: { error: 'trajectoryId inválido' } });
      }
      const traj = await Trajectory.findOne({ _id: trajectoryId }).select('_id team');
      if(!traj){
        return res.status(404).json({ status: 'error', data: { error: 'Trajectory no encontrada' } });
      }
      if(!teamIds.includes(traj.team.toString())){
        return res.status(403).json({ status: 'error', data: { error: 'Forbidden. La trayectoria no pertenece a tus equipos.' } });
      }
      trajectoryIds = [traj._id.toString()];
    }else{
      const trajectories = await Trajectory.find({ team: { $in: teamIds } }).select('_id');
      trajectoryIds = trajectories.map(t => t._id.toString());
    }

    if(trajectoryIds.length === 0){
      return res.status(200).json({
        status: 'success',
        data: { page: 1, limit: 0, total: 0, totals: { segments: 0, points: 0, length: 0 }, dislocations: [] }
      });
    }

    const match: any = { trajectory: { $in: trajectoryIds } };

    if(analysisConfigId){
      if(!isValidObjectId(analysisConfigId)){
        return res.status(400).json({ status: 'error', data: { error: 'analysisConfigId inválido' } });
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
        const fields = sort.split(',').map(s => s.trim()).filter(Boolean);
        for(const f of fields){
            if(f.startsWith('-')) sortObj[f.slice(1)] = -1;
            else sortObj[f] = 1;
        }
    }else{
        sortObj.createdAt = -1;
    }

    const [rows, totalDocs, totalsAgg] = await Promise.all([
        Dislocation.find(match)
            .select('trajectory timestep totalSegments totalPoints totalLength averageSegmentLength maxSegmentLength minSegmentLength analysisConfig createdAt updatedAt')
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .populate({ path: 'trajectory', select: 'name _id team' })
            .populate({ path: 'analysisConfig', select: '_id crystalStructure RMSD identificationMode' })
            .lean(),
            Dislocation.countDocuments(match),
            Dislocation.aggregate([
                { $match: match },
                {
                $group: {
                    _id: null,
                    segments: { $sum: '$totalSegments' },
                    points:   { $sum: '$totalPoints' },
                length:   { $sum: '$totalLength' }
            }
            }
        ])
    ]);

    const totals = {
        segments: totalsAgg?.[0]?.segments ?? 0,
        points:   totalsAgg?.[0]?.points   ?? 0,
        length:   totalsAgg?.[0]?.length   ?? 0
    };

    return res.status(200).json({
        status: 'success',
        data: {
            page: pageNum,
            limit: limitNum,
            total: totalDocs,
            totals,
            dislocations: rows
        }
    });
    }catch(err){
        console.error('getUserDislocations error:', err);
        return res.status(500).json({
        status: 'error',
        data: { error: 'Internal Server Error' }
        });
    }
};
