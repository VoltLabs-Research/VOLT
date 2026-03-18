import { FilterExpression } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';

import { Readable } from 'node:stream';

export enum ParticleFilterCombinator {
    And = 'AND',
    Or = 'OR'
};

export interface ParticleFilterCondition extends FilterExpression {
    exposureId?: string;
};

export interface ParticleFilterGroup {
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterCondition[];
};

export interface IParticleFilterService {
    getProperties(
        trajectoryId: string,
        timestep: string | number,
        analysisId?: string
    ): Promise<{ dump: string[]; perAtom: Record<string, string[]>; exposureNames: Record<string, string> }>;

    getUniqueValues(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        maxValues?: number,
        analysisId?: string,
        exposureId?: string
    ): Promise<number[]>;

    preview(
        trajectoryId: string,
        timestep: string | number,
        filterGroup: ParticleFilterGroup,
        analysisId?: string
    ): Promise<{ matchCount: number; totalAtoms: number }>;

    applyAction(
        trajectoryId: string,
        timestep: string | number,
        action: 'delete' | 'highlight',
        filterGroup: ParticleFilterGroup,
        analysisId?: string
    ): Promise<{ fileId: string; atomsResult: number; action: string }>;

    getModelStream(
        trajectoryId: string,
        timestep: string | number,
        filterGroup: ParticleFilterGroup,
        action?: string,
        analysisId?: string
    ): Promise<Readable>;
};
