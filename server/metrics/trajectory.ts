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
import { AnalysisConfig, SimulationCell, StructureAnalysis, Team, Trajectory } from "@/models";
import { Request, Response } from 'express';
import { listDislocationsByPrefix } from '@/buckets/dislocations';
import { Types } from 'mongoose';

const factory = new HandlerFactory({
    model: AnalysisConfig as any,
    fields: [],
});

export const getAnalysisConfigById = factory.getOne();
export const deleteAnalysisConfigById = factory.deleteOne();

export const getAnalysisDislocations = async (req: Request, res: Response) => {
    try{
        const analysisConfigId = (req as any).params.id;

        const analysis = await AnalysisConfig
            .findById(analysisConfigId)
            .select('trajectory')
            .lean();

        if(!analysis){
            return res.status(404).json({
                status: 'error',
                data: { error: 'AnalysisConfig no encontrado' }
            });
        }

        const trajectoryId = String(analysis.trajectory);
        const prefix = `${trajectoryId}/${analysisConfigId}/`;

        const objects = await listDislocationsByPrefix(prefix);

        const dislocations = objects.map(({ key, data }) => ({
            key,
            ...data
        }));

        return res.status(200).json({
            status: 'success',
            data: dislocations
        });
    }catch(err){
        console.error('getAnalysisDislocations error:', err);
        return res.status(500).json({
            status: 'error',
            data: { error: 'Internal Server Error' }
        });
    }
};

// List analysis configs by team
export const listAnalysisConfigsByTeam = async (req: Request, res: Response) => {
    try{
        const userId = (req as any).user?.id;
        const { teamId } = req.params as { teamId: string };
        const { page = '1', limit = '20', q = '' } = req.query as Record<string, string>;

        const team = await Team.findOne({ _id: teamId, members: userId }).select('_id');
        if(!team){
            return res.status(403).json({ status: 'error', data: { error: 'Forbidden' } });
        }

        const trajectories = await Trajectory.find({ team: teamId }).select('_id name').lean();
        const trajectoryIds = trajectories.map((t: any) => t._id);

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const query = typeof q === 'string' ? q.trim() : '';
        const regex = query ? { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } : null;

        // Build aggregation with optional search by identificationMode, crystalStructure, and trajectory name
        const pipeline: any[] = [
            { $match: { trajectory: { $in: trajectoryIds } } }
        ];

        // If searching, bring trajectory name early and apply $match
        if (regex) {
            pipeline.push(
                { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
                { $addFields: { trajectoryDoc: { $arrayElemAt: ['$trajectoryDoc', 0] } } },
                { $match: {
                    $or: [
                        { identificationMode: regex },
                        { crystalStructure: regex },
                        { 'trajectoryDoc.name': regex }
                    ]
                } }
            );
        }

        pipeline.push(
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
                // TODO:
                dislocationsCount: { $literal: 0 }
            }},
            { $skip: skip },
            { $limit: limitNum }
        );

        // Ensure trajectory name is attached regardless of search
        pipeline.push(
            { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
            { $addFields: { trajectory: { $let: { vars: { t: { $arrayElemAt: ['$trajectoryDoc', 0] } }, in: { _id: '$$t._id', name: '$$t.name' } } } } },
            { $project: { trajectoryDoc: 0 } }
        );

        let configs: any[] = [];
        let total: number = 0;
        if (regex) {
            const countPipeline: any[] = [
                { $match: { trajectory: { $in: trajectoryIds } } },
                { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
                { $addFields: { trajectoryDoc: { $arrayElemAt: ['$trajectoryDoc', 0] } } },
                { $match: { $or: [ { identificationMode: regex }, { crystalStructure: regex }, { 'trajectoryDoc.name': regex } ] } },
                { $count: 'total' }
            ];
            const [rows, countRows] = await Promise.all([
                AnalysisConfig.aggregate(pipeline),
                AnalysisConfig.aggregate(countPipeline)
            ]);
            configs = rows as any[];
            total = (countRows?.[0]?.total as number) ?? 0;
        } else {
            const [rows, count] = await Promise.all([
                AnalysisConfig.aggregate(pipeline),
                AnalysisConfig.countDocuments({ trajectory: { $in: trajectoryIds } })
            ]);
            configs = rows as any[];
            total = count as number;
        }

        return res.status(200).json({
            status: 'success',
            data: { configs, total, page: pageNum, limit: limitNum }
        });
    }catch(err){
        console.error('listAnalysisConfigsByTeam error:', err);
        return res.status(500).json({ status: 'error', data: { error: 'Internal Server Error' } });
    }
};


export const getTrajectoryMetricsById = async (trajectoryId: string): Promise<any> => {
  if (!Types.ObjectId.isValid(trajectoryId)) {
    throw new Error('InvalidTrajectoryId');
  }

  const traj = await Trajectory.findById(trajectoryId)
    .select('name team status frames stats createdAt updatedAt')
    .lean<any>();

  if (!traj) throw new Error('TrajectoryNotFound');

  const frames = Array.isArray(traj.frames) ? traj.frames : [];
  const totalFrames = frames.length;
  const timesteps: number[] = frames.map((f: any) => Number(f.timestep)).filter((v: any) => Number.isFinite(v));
  const natoms: number[] = frames.map((f: any) => Number(f.natoms)).filter((v: any) => Number.isFinite(v));
  const withGLB = frames.filter((f: any) => !!f.glbPath).length;

  const atomsStats = totalFrames
    ? {
        min: natoms.length ? Math.min(...natoms) : null,
        max: natoms.length ? Math.max(...natoms) : null,
        avg: natoms.length ? Number((natoms.reduce((a, b) => a + b, 0) / natoms.length).toFixed(4)) : null
      }
    : { min: null, max: null, avg: null };

  const saDocs = await StructureAnalysis.find({ trajectory: trajectoryId })
    .select('timestep totalAtoms identifiedStructures unidentifiedStructures analysisMethod types')
    .lean<any>();

  const methodsCount: Record<string, number> = {};
  let saTotalAtoms = 0;
  let saIdentified = 0;
  let saUnidentified = 0;
  let saLastTimestep: number | null = null;

  const typeMap = new Map<string, { name: string; typeId: number; count: number }>();

  for (const sa of saDocs) {
    methodsCount[sa.analysisMethod] = (methodsCount[sa.analysisMethod] || 0) + 1;
    if (Number.isFinite(sa.timestep)) {
      saLastTimestep = saLastTimestep == null ? sa.timestep : Math.max(saLastTimestep, sa.timestep);
    }
    const totAtoms = Number(sa.totalAtoms) || 0;
    const iden = Number(sa.identifiedStructures) || 0;
    const uniden = Number(sa.unidentifiedStructures) || 0;

    saTotalAtoms += totAtoms;
    saIdentified += iden;
    saUnidentified += uniden;

    const types = Array.isArray(sa.types) ? sa.types : [];
    for (const t of types) {
      const key = `${t.typeId}|${t.name}`;
      const prev = typeMap.get(key);
      const cnt = Number(t.count) || 0;
      if (prev) prev.count += cnt;
      else typeMap.set(key, { name: t.name, typeId: t.typeId, count: cnt });
    }
  }

  const typesTotal = Array.from(typeMap.values()).reduce((a, b) => a + b.count, 0) || 0;
  const typesDistribution = Array.from(typeMap.values()).map((t) => ({
    name: t.name,
    typeId: t.typeId,
    count: t.count,
    percentage: typesTotal ? Number(((t.count * 100) / typesTotal).toFixed(4)) : 0
  }));

  const overallIdentificationRate =
    saTotalAtoms > 0 ? Number(((saIdentified * 1.0) / saTotalAtoms).toFixed(6)) : null;

  // ---- Dislocations desde MinIO
  const objects = await listDislocationsByPrefix(`${trajectoryId}/`);

  const dTimesteps = new Set<number>();
  let dTotalSegments = 0;
  let dTotalPoints = 0;
  let dTotalLength = 0;
  let dMaxSegLen: number | null = null;
  let dMinSegLen: number | null = null;
  let avgWeightedNumerator = 0; // sum(avgSegLen_doc * totalSegments_doc)

  for (const { data } of objects) {
    const timestep = Number(data.timestep);
    if (Number.isFinite(timestep)) dTimesteps.add(timestep);

    const seg = Number(data.totalSegments) || 0;
    const pts = Number(data.totalPoints) || 0;
    const len = Number(data.totalLength) || 0;
    const avg = Number(data.averageSegmentLength) || 0;
    const mx = Number(data.maxSegmentLength);
    const mn = Number(data.minSegmentLength);

    dTotalSegments += seg;
    dTotalPoints += pts;
    dTotalLength += len;
    avgWeightedNumerator += avg * seg;

    dMaxSegLen = mx === mx ? (dMaxSegLen == null ? mx : Math.max(dMaxSegLen, mx)) : dMaxSegLen;
    dMinSegLen = mn === mn ? (dMinSegLen == null ? mn : Math.min(dMinSegLen, mn)) : dMinSegLen;
  }

  const dAvgSegLen =
    dTotalSegments > 0 ? Number((avgWeightedNumerator / dTotalSegments).toFixed(6)) : null;

  // ---- Simulation Cell
  const scDocs = await SimulationCell.find({ trajectory: trajectoryId })
    .select('timestep volume angles periodicBoundaryConditions')
    .lean<any>();

  const scVolumes = scDocs.map((s: any) => Number(s.volume)).filter((v: any) => v === v);
  const scLatest =
    scDocs.length > 0
      ? scDocs.reduce((best: any, s: any) => (!best || s.timestep > best.timestep ? s : best), null)
      : null;

  const scNum2D = scDocs.filter((s: any) => s?.dimensionality?.is_2d === true).length;
  const scNum3D = scDocs.length - scNum2D;

  const metrics = {
    trajectory: {
      _id: String(traj._id),
      name: traj.name,
      team: String(traj.team),
      status: traj.status,
      createdAt: traj.createdAt,
      updatedAt: traj.updatedAt
    },
    files: {
      totalFiles: Number(traj?.stats?.totalFiles) || 0,
      totalSizeBytes: Number(traj?.stats?.totalSize) || 0
    },
    frames: {
      totalFrames,
      minTimestep: timesteps.length ? Math.min(...timesteps) : null,
      maxTimestep: timesteps.length ? Math.max(...timesteps) : null,
      atoms: atomsStats,
      withGLB
    },
    structureAnalysis: {
      totalDocs: saDocs.length,
      methodsCount,
      lastTimestep: saLastTimestep,
      totalAtomsAnalyzed: saTotalAtoms,
      totalIdentifiedStructures: saIdentified,
      totalUnidentifiedStructures: saUnidentified,
      overallIdentificationRate,
      typesDistribution
    },
    dislocations: {
      totalDocs: objects.length,
      timestepsAnalysed: dTimesteps.size,
      totalSegments: dTotalSegments,
      totalPoints: dTotalPoints,
      totalLength: dTotalLength,
      avgSegmentLength: dAvgSegLen,
      maxSegmentLength: dMaxSegLen,
      minSegmentLength: dMinSegLen
    },
    simulationCell: {
      snapshots: scDocs.length,
      latestTimestep: scLatest ? Number(scLatest.timestep) : null,
      latest: scLatest
        ? {
            volume: Number(scLatest.volume),
            angles: {
              alpha: Number(scLatest?.angles?.alpha),
              beta: Number(scLatest?.angles?.beta),
              gamma: Number(scLatest?.angles?.gamma)
            },
            periodicBoundaryConditions: {
              x: !!scLatest?.periodicBoundaryConditions?.x,
              y: !!scLatest?.periodicBoundaryConditions?.y,
              z: !!scLatest?.periodicBoundaryConditions?.z
            }
          }
        : undefined,
      volume: scDocs.length
        ? {
            min: Math.min(...scVolumes),
            max: Math.max(...scVolumes),
            avg: Number((scVolumes.reduce((a: number, b:number) => a + b, 0) / scVolumes.length).toFixed(6))
          }
        : { min: null, max: null, avg: null },
      dimensionality: { is2D: scNum2D, is3D: scNum3D }
    }
  };

  return metrics;
};