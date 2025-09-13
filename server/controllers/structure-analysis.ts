import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Team, Trajectory, StructureAnalysis } from '@models/index';

export const getStructureAnalysesByTeam = async (req: Request, res: Response) => {
    try{
        const userId = (req as any).user?.id;
        const { teamId } = req.params; 
        const {
            analysisMethod, 
            timestepFrom,
            timestepTo,
            page = '1',
            limit = '100', 
            sort = '-createdAt' 
        } = req.query as Record<string, string>;

        if(!teamId || !isValidObjectId(teamId)){
            return res.status(400).json({
                status: 'error',
                data: { error: 'Parámetro teamId inválido o ausente.' }
            });
        }

        const team = await Team.findOne({ _id: teamId, members: userId }).select('_id');
        if(!team){
            return res.status(403).json({
                status: 'error',
                data: { error: 'Forbidden. No perteneces a este equipo.' }
            });
        }

        const trajectories = await Trajectory.find({ team: teamId })
            .select('_id name createdAt')
            .lean();

        if(trajectories.length === 0){
            return res.status(200).json({
                status: 'success',
                data: {
                trajectories: [],
                totalAnalyses: 0,
                analysesByTrajectory: {}
                }
            });
        }

        const trajectoryIds = trajectories.map(t => t._id);

        const saMatch: any = { trajectory: { $in: trajectoryIds } };
        if(analysisMethod){
            saMatch.analysisMethod = analysisMethod;
        }

        const fromNum = Number(timestepFrom);
        const toNum = Number(timestepTo);
        if(!Number.isNaN(fromNum) || !Number.isNaN(toNum)){
            saMatch.timestep = {};
            if(!Number.isNaN(fromNum)) saMatch.timestep.$gte = fromNum;
            if(!Number.isNaN(toNum))   saMatch.timestep.$lte = toNum;
            if(Object.keys(saMatch.timestep).length === 0) delete saMatch.timestep;
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

        const [analyses, totalAnalyses] = await Promise.all([
            StructureAnalysis.find(saMatch)
                .select('trajectory totalAtoms timestep analysisMethod types identifiedStructures unidentifiedStructures identificationRate createdAt')
                .sort(sortObj)
                .skip(skip)
                .populate({
                    path: 'trajectory',
                    select: 'name _id'
                })
                .limit(limitNum)
                .lean(),
            StructureAnalysis.countDocuments(saMatch)
        ]);

        const analysesByTrajectory: Record<string, any[]> = {};
        for(const sa of analyses){
            const key = sa.trajectory.toString();
            if(!analysesByTrajectory[key]) analysesByTrajectory[key] = [];
            analysesByTrajectory[key].push(sa);
        }

        return res.status(200).json({
            status: 'success',
            data: {
                trajectories,      
                totalAnalyses, 
                page: pageNum,
                limit: limitNum,
                analysesByTrajectory 
            }
        });
    }catch(err){
        console.error('getStructureAnalysesByTeam error:', err);
        return res.status(500).json({
            status: 'error',
            data: { error: 'Internal Server Error' }
        });
    }
};
