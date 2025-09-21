/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import HandlerFactory from '@/controllers/handler-factory';
import { AnalysisConfig, Dislocations, Team, Trajectory } from "@/models";
import { Request, Response } from 'express';

const factory = new HandlerFactory({
    model: AnalysisConfig as any,
    fields: [],
});

export const getAnalysisConfigById = factory.getOne();
export const deleteAnalysisConfigById = factory.deleteOne();

export const getAnalysisDislocations = async (req: Request, res: Response) => {
    const analysisConfigId = (req as any).params.id;
    const dislocations = await Dislocations.find({ analysisConfig: analysisConfigId });

    res.status(200).json({
        status: 'success',
        data: dislocations
    });
};

// List analysis configs by team
export const listAnalysisConfigsByTeam = async (req: Request, res: Response) => {
    try{
        const userId = (req as any).user?.id;
        const { teamId } = req.params as { teamId: string };
        const { page = '1', limit = '20' } = req.query as Record<string, string>;

        const team = await Team.findOne({ _id: teamId, members: userId }).select('_id');
        if(!team){
            return res.status(403).json({ status: 'error', data: { error: 'Forbidden' } });
        }

    const trajectories = await Trajectory.find({ team: teamId }).select('_id name').lean();
    const trajectoryIds = trajectories.map((t: any) => t._id);

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const [configs, total] = await Promise.all([
            AnalysisConfig.aggregate([
                { $match: { trajectory: { $in: trajectoryIds } } },
                { $sort: { createdAt: -1 } },
                { $project: {
                    crystalStructure: 1,
                    identificationMode: 1,
                    maxTrialCircuitSize: 1,
                    circuitStretchability: 1,
                    RMSD: 1,
                    defectMeshSmoothingLevel: 1,
                    lineSmoothingLevel: 1,
                    linePointInterval: 1,
                    onlyPerfectDislocations: 1,
                    markCoreAtoms: 1,
                    structureIdentificationOnly: 1,
                    structureAnalysis: 1,
                    simulationCell: 1,
                    createdAt: 1,
                    trajectory: 1,
                    dislocationsCount: { $size: { $ifNull: ['$dislocations', []] } }
                }},
                { $skip: skip },
                { $limit: limitNum },
                // lookup trajectory name for nicer rendering
                { $lookup: {
                    from: 'trajectories',
                    localField: 'trajectory',
                    foreignField: '_id',
                    as: 'trajectoryDoc'
                }},
                { $addFields: {
                    trajectory: {
                        $let: {
                            vars: { t: { $arrayElemAt: ['$trajectoryDoc', 0] } },
                            in: { _id: '$$t._id', name: '$$t.name' }
                        }
                    }
                }},
                { $project: { trajectoryDoc: 0 } }
            ]),
            AnalysisConfig.countDocuments({ trajectory: { $in: trajectoryIds } })
        ]);

        return res.status(200).json({
            status: 'success',
            data: { configs, total, page: pageNum, limit: limitNum }
        });
    }catch(err){
        console.error('listAnalysisConfigsByTeam error:', err);
        return res.status(500).json({ status: 'error', data: { error: 'Internal Server Error' } });
    }
};