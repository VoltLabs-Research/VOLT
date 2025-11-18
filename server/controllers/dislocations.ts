import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Team, Trajectory, AnalysisConfig } from '@/models/index';
import { listDislocationsByPrefix } from '@/buckets/dislocations';
import path from 'path';

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
			limit = '100'
		} = req.query as Record<string, string>;

		let teamIds: string[] = [];
		if(teamId){
			if(!isValidObjectId(teamId)){
				return res.status(400).json({
					status: 'error',
					data: { error: 'TeamId::Invalid' }
				});
			}

			const team = await Team.findOne({ _id: teamId, members: userId }).select('_id');
			if(!team){
				return res.status(403).json({
					status: 'error',
					data: { error: 'Forbbiden' }
				});
			}

			teamIds = [(team as any)._id.toString()];
		}else{
			const teams = await Team.find({ members: userId }).select('_id');
			teamIds = (teams as any[]).map((t: any) => t._id.toString());
		}

		if(teamIds.length === 0){
			return res.status(200).json({
				status: 'success',
				data: {
					page: 1,
					limit: 0,
					total: 0,
					totals: { segments: 0, points: 0, length: 0 },
					dislocations: []
				}
			});
		}

		let trajectoryIds: string[] = [];
		if(trajectoryId){
			if(!isValidObjectId(trajectoryId)){
				return res.status(400).json({
					status: 'error',
					data: { error: 'TrajectoryId::Invalid' }
				});
			}
			const traj = await Trajectory.findOne({ _id: trajectoryId }).select('_id team');
			if(!traj){
				return res.status(404).json({
					status: 'error', 
					data: { error: 'Trajectory::NotFound' } 
				});
			}
			if(!teamIds.includes(traj.team.toString())){
				return res.status(403).json({
					status: 'error',
					data: { error: 'Forbidden' }
				});
			}

			trajectoryIds = [traj._id.toString()];
		}else{
			const trajectories = await Trajectory.find({ team: { $in: teamIds } }).select('_id');
			trajectoryIds = (trajectories as any[]).map((t: any) => t._id.toString());
		}

		if(trajectoryIds.length === 0){
			return res.status(200).json({
				status: 'success',
				data: {
					page: 1,
					limit: 0,
					total: 0,
					totals: { segments: 0, points: 0, length: 0 },
					dislocations: []
				}
			});
		}

		const fromNum = Number(timestepFrom);
		const toNum = Number(timestepTo);
		const allRows: any[] = [];

		for(const trajId of trajectoryIds){
			const prefix = `${trajId}/`;
			const objects = await listDislocationsByPrefix(prefix);

			for(const { key, data } of objects){
				const [, analysisId, filename] = key.split('/');
				const timestep = data.timestep ?? Number(path.basename(filename, '.json'));

				if(analysisConfigId && analysisId !== analysisConfigId) continue;
				if(!Number.isNaN(fromNum) && timestep < fromNum) continue;
				if(!Number.isNaN(toNum) && timestep > toNum) continue;

				allRows.push({
					trajectory: trajId,
					analysisConfig: analysisId,
					timestep,
					totalSegments: data.totalSegments,
					totalPoints: data.totalPoints,
					averageSegmentLength: data.averageSegmentLength,
					maxSegmentLength: data.maxSegmentLength,
					minSegmentLength: data.minSegmentLength,
					totalLength: data.totalLength
				});
			}
		}

		const totalDocs = allRows.length;
		const pageNum = Math.max(1, parseInt(page, 10) || 1);
		const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
		const start = (pageNum - 1) * limitNum;
		const end = start + limitNum;

		allRows.sort((a, b) => a.timestep - b.timestep);
		const rows = allRows.slice(start, end);
		
		const totals = rows.reduce((acc, r) => {
			acc.segments += r.totalSegments || 0;
			acc.points += r.totalPoints || 0;
			acc.length += r.totalLength || 0;
			return acc;
		}, { segments: 0, points: 0, length: 0 });

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
	}catch(error){
		console.error('getUserDislocations error:', error);
		return res.status(500).json({
			status: 'error',
			data: { error: 'Internal Server Error' }
		});
	}
};