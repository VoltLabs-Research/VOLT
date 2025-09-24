import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Team, Trajectory, StructureAnalysis } from '@models/index';

export const getStructureAnalysisById = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { analysisId } = req.params;

        if (!analysisId || !isValidObjectId(analysisId)) {
            return res.status(400).json({
                status: 'error',
                data: { error: 'Parámetro analysisId inválido o ausente.' }
            });
        }

        const analysis = await StructureAnalysis.findById(analysisId)
            .populate({
                path: 'trajectory',
                select: 'team name _id isPublic'
            })
            .lean();

        if (!analysis) {
            return res.status(404).json({
                status: 'error',
                data: { error: 'Análisis estructural no encontrado.' }
            });
        }

        // Si la trayectoria es pública, permitir acceso sin membresía
        if ((analysis.trajectory as any)?.isPublic) {
            return res.status(200).json({
                status: 'success',
                data: analysis
            });
        }

        const team = await Team.findOne({
            _id: (analysis.trajectory as any).team,
            members: userId
        }).select('_id');

        if (!team) {
            return res.status(403).json({
                status: 'error',
                data: { error: 'Forbidden. No tienes acceso a este análisis.' }
            });
        }

        return res.status(200).json({
            status: 'success',
            data: analysis
        });
    } catch (err) {
        console.error('getStructureAnalysisById error:', err);
        return res.status(500).json({
            status: 'error',
            data: { error: 'Internal Server Error' }
        });
    }
};

export const getStructureAnalysesByConfig = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { configId } = req.params;

        if (!configId || !isValidObjectId(configId)) {
            return res.status(400).json({
                status: 'error',
                data: { error: 'Parámetro configId inválido o ausente.' }
            });
        }

        // Obtener los análisis estructurales que pertenecen a esta configuración
        const analyses = await StructureAnalysis.find({ analysisConfig: configId })
            .select('totalAtoms timestep analysisMethod types identifiedStructures unidentifiedStructures identificationRate createdAt trajectory')
            .populate({
                path: 'trajectory',
                select: 'team name _id isPublic'
            })
            .lean();

        if (analyses.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: { analyses: [] }
            });
        }

        // Si la trayectoria es pública, permitir acceso sin membresía
        if ((analyses[0].trajectory as any)?.isPublic) {
            return res.status(200).json({
                status: 'success',
                data: { analyses }
            });
        }

        // Verificar que el usuario tenga acceso al equipo de la trayectoria del primer análisis
        const team = await Team.findOne({
            _id: (analyses[0].trajectory as any).team,
            members: userId
        }).select('_id');

        if (!team) {
            return res.status(403).json({
                status: 'error',
                data: { error: 'Forbidden. No tienes acceso a estos análisis.' }
            });
        }

        return res.status(200).json({
            status: 'success',
            data: { analyses }
        });
    } catch (err) {
        console.error('getStructureAnalysesByConfig error:', err);
        return res.status(500).json({
            status: 'error',
            data: { error: 'Internal Server Error' }
        });
    }
};

export const getStructureAnalysesByTrajectory = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { trajectoryId } = req.params;
        const {
            analysisMethod,
            timestepFrom,
            timestepTo,
            page = '1',
            limit = '100',
            sort = '-createdAt',
            q = ''
        } = req.query as Record<string, string>;

        if (!trajectoryId || !isValidObjectId(trajectoryId)) {
            return res.status(400).json({
                status: 'error',
                data: { error: 'Parámetro trajectoryId inválido o ausente.' }
            });
        }

        const trajectory = await Trajectory.findById(trajectoryId)
            .select('team isPublic')
            .lean();

        if (!trajectory) {
            return res.status(404).json({
                status: 'error',
                data: { error: 'Trayectoria no encontrada.' }
            });
        }

        // Si la trayectoria es pública, saltar verificación de membresía
        if (!(trajectory as any).isPublic) {
            const team = await Team.findOne({
                _id: trajectory.team,
                members: userId
            }).select('_id');

            if (!team) {
                return res.status(403).json({
                    status: 'error',
                    data: { error: 'Forbidden. No tienes acceso a esta trayectoria.' }
                });
            }
        }

        const saMatch: any = { trajectory: trajectoryId };
        if (analysisMethod) {
            saMatch.analysisMethod = analysisMethod;
        }

        const fromNum = Number(timestepFrom);
        const toNum = Number(timestepTo);
        if (!Number.isNaN(fromNum) || !Number.isNaN(toNum)) {
            saMatch.timestep = {};
            if (!Number.isNaN(fromNum)) saMatch.timestep.$gte = fromNum;
            if (!Number.isNaN(toNum)) saMatch.timestep.$lte = toNum;
            if (Object.keys(saMatch.timestep).length === 0) delete saMatch.timestep;
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
        const skip = (pageNum - 1) * limitNum;

        const sortObj: Record<string, 1 | -1> = {};
        if (typeof sort === 'string' && sort.length) {
            const fields = sort.split(',').map(s => s.trim()).filter(Boolean);
            for (const f of fields) {
                if (f.startsWith('-')) sortObj[f.slice(1)] = -1;
                else sortObj[f] = 1;
            }
        } else {
            sortObj.createdAt = -1;
        }

        const query = typeof q === 'string' ? q.trim() : '';
        const regex = query ? { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } : null;

        let analyses: any[] = [];
        let totalAnalyses = 0;

        if (regex) {
            const pipeline: any[] = [
                { $match: saMatch },
                { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
                { $addFields: { trajectoryDoc: { $arrayElemAt: ['$trajectoryDoc', 0] } } },
                { $match: { $or: [ { 'trajectoryDoc.name': regex }, { analysisMethod: regex } ] } },
                { $sort: sortObj },
                { $skip: skip },
                { $limit: limitNum },
                { $project: {
                    totalAtoms: 1,
                    timestep: 1,
                    analysisMethod: 1,
                    types: 1,
                    identifiedStructures: 1,
                    unidentifiedStructures: 1,
                    identificationRate: 1,
                    createdAt: 1,
                    trajectory: { _id: '$trajectoryDoc._id', name: '$trajectoryDoc.name' }
                } }
            ];
            const countPipeline: any[] = [
                { $match: saMatch },
                { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
                { $addFields: { trajectoryDoc: { $arrayElemAt: ['$trajectoryDoc', 0] } } },
                { $match: { $or: [ { 'trajectoryDoc.name': regex }, { analysisMethod: regex } ] } },
                { $count: 'total' }
            ];
            const [aggRows, aggCount] = await Promise.all([
                StructureAnalysis.aggregate(pipeline),
                StructureAnalysis.aggregate(countPipeline)
            ]);
            analyses = aggRows as any[];
            totalAnalyses = (aggCount?.[0]?.total as number) ?? 0;
        } else {
            const [rows, total] = await Promise.all([
                StructureAnalysis.find(saMatch)
                    .select('totalAtoms timestep analysisMethod types identifiedStructures unidentifiedStructures identificationRate createdAt')
                    .sort(sortObj)
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                StructureAnalysis.countDocuments(saMatch)
            ]);
            analyses = rows as any[];
            totalAnalyses = total as number;
        }

        return res.status(200).json({
            status: 'success',
            data: {
                analyses,
                totalAnalyses,
                page: pageNum,
                limit: limitNum
            }
        });
    } catch (err) {
        console.error('getStructureAnalysesByTrajectory error:', err);
        return res.status(500).json({
            status: 'error',
            data: { error: 'Internal Server Error' }
        });
    }
};

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
            sort = '-createdAt',
            q = '' 
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

        const query = typeof q === 'string' ? q.trim() : '';
        const regex = query ? { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } : null;

        let analyses: any[] = [];
        let totalAnalyses = 0;

        if (regex) {
            const pipeline: any[] = [
                { $match: saMatch },
                { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
                { $addFields: { trajectoryDoc: { $arrayElemAt: ['$trajectoryDoc', 0] } } },
                { $match: { $or: [ { 'trajectoryDoc.name': regex }, { analysisMethod: regex } ] } },
                { $sort: sortObj },
                { $skip: skip },
                { $limit: limitNum },
                { $project: {
                    trajectory: { _id: '$trajectoryDoc._id', name: '$trajectoryDoc.name' },
                    totalAtoms: 1,
                    timestep: 1,
                    analysisMethod: 1,
                    types: 1,
                    identifiedStructures: 1,
                    unidentifiedStructures: 1,
                    identificationRate: 1,
                    createdAt: 1
                } }
            ];
            const countPipeline: any[] = [
                { $match: saMatch },
                { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
                { $addFields: { trajectoryDoc: { $arrayElemAt: ['$trajectoryDoc', 0] } } },
                { $match: { $or: [ { 'trajectoryDoc.name': regex }, { analysisMethod: regex } ] } },
                { $count: 'total' }
            ];
            const [aggRows, aggCount] = await Promise.all([
                StructureAnalysis.aggregate(pipeline),
                StructureAnalysis.aggregate(countPipeline)
            ]);
            analyses = aggRows as any[];
            totalAnalyses = (aggCount?.[0]?.total as number) ?? 0;
        } else {
            const [rows, total] = await Promise.all([
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
            analyses = rows as any[];
            totalAnalyses = total as number;
        }

        const analysesByTrajectory: Record<string, any[]> = {};
        for(const sa of analyses){
            const key = (typeof sa.trajectory === 'object' && sa.trajectory?._id) ? String(sa.trajectory._id) : String(sa.trajectory);
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
