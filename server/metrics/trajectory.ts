// Copyright (C) ...
// src/metrics/trajectory.ts
import { Types } from 'mongoose';
import { Trajectory, StructureAnalysis, Dislocations, SimulationCell } from '@models/index';

type NumStat = { min: number | null; max: number | null; avg: number | null };

export interface TrajectoryMetrics {
  trajectory: {
    _id: string;
    name: string;
    team: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  files: {
    totalFiles: number;
    totalSizeBytes: number;
  };
  frames: {
    totalFrames: number;
    minTimestep: number | null;
    maxTimestep: number | null;
    atoms: NumStat; // sobre 'natoms' en frames
    withGLB: number; // frames que tienen glbPath
  };
  structureAnalysis: {
    totalDocs: number;
    methodsCount: Record<string, number>;
    lastTimestep: number | null;
    totalAtomsAnalyzed: number;
    totalIdentifiedStructures: number;
    totalUnidentifiedStructures: number;
    overallIdentificationRate: number | null; // identificado/totalAtoms
    typesDistribution: Array<{ name: string; typeId: number; count: number; percentage: number }>;
  };
  dislocations: {
    totalDocs: number;
    timestepsAnalysed: number;
    totalSegments: number;
    totalPoints: number;
    totalLength: number;
    avgSegmentLength: number | null; // ponderado por #segmentos
    maxSegmentLength: number | null;
    minSegmentLength: number | null;
  };
  simulationCell: {
    snapshots: number;
    latestTimestep: number | null;
    latest?: {
      volume: number;
      angles: { alpha: number; beta: number; gamma: number };
      periodicBoundaryConditions: { x: boolean; y: boolean; z: boolean };
    };
    volume: NumStat;
    dimensionality: { is2D: number; is3D: number };
  };
}

export const getTrajectoryMetricsById = async (trajectoryId: string): Promise<TrajectoryMetrics> => {
  if (!Types.ObjectId.isValid(trajectoryId)) {
    throw new Error('InvalidTrajectoryId');
  }

  const traj = await Trajectory.findById(trajectoryId)
    .select('name team status frames stats createdAt updatedAt')
    .lean<any>();

  if (!traj) throw new Error('TrajectoryNotFound');

  // ---- Frames / timesteps / natoms
  const frames = Array.isArray(traj.frames) ? traj.frames : [];
  const totalFrames = frames.length;
  const timesteps: number[] = frames.map((f: any) => Number(f.timestep)).filter((v: any) => Number.isFinite(v));
  const natoms: number[] = frames.map((f: any) => Number(f.natoms)).filter((v: any) => Number.isFinite(v));
  const withGLB = frames.filter((f: any) => !!f.glbPath).length;

  const atomsStats: NumStat = totalFrames
    ? {
        min: natoms.length ? Math.min(...natoms) : null,
        max: natoms.length ? Math.max(...natoms) : null,
        avg: natoms.length ? Number((natoms.reduce((a, b) => a + b, 0) / natoms.length).toFixed(4)) : null
      }
    : { min: null, max: null, avg: null };

  // ---- StructureAnalysis
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

  // ---- Dislocations
  const dDocs = await Dislocations.find({ trajectory: trajectoryId })
    .select(
      'timestep totalSegments totalPoints totalLength averageSegmentLength maxSegmentLength minSegmentLength'
    )
    .lean<any>();

  const dTimesteps = new Set<number>();
  let dTotalSegments = 0;
  let dTotalPoints = 0;
  let dTotalLength = 0;
  let dMaxSegLen: number | null = null;
  let dMinSegLen: number | null = null;
  let avgWeightedNumerator = 0; // sum(avgSegLen_doc * totalSegments_doc)
  for (const d of dDocs) {
    if (Number.isFinite(d.timestep)) dTimesteps.add(d.timestep);
    const seg = Number(d.totalSegments) || 0;
    const pts = Number(d.totalPoints) || 0;
    const len = Number(d.totalLength) || 0;
    const avg = Number(d.averageSegmentLength) || 0;
    const mx = Number(d.maxSegmentLength);
    const mn = Number(d.minSegmentLength);

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

  const metrics: TrajectoryMetrics = {
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
      totalDocs: dDocs.length,
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
