import { FilterExpression } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';

import { Readable } from 'node:stream';

export enum ParticleFilterCombinator {
    And = 'AND',
    Or = 'OR'
}

export interface ParticleFilterCondition extends FilterExpression {
    kind?: 'property';
    exposureId?: string;
}

export interface ParticleFilterRequest {
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterCondition[];
}

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
        request: ParticleFilterRequest,
        analysisId?: string
    ): Promise<{ matchCount: number; totalAtoms: number }>;

    applyAction(
        trajectoryId: string,
        timestep: string | number,
        action: 'delete' | 'highlight',
        request: ParticleFilterRequest,
        analysisId?: string
    ): Promise<{ fileId: string; atomsResult: number; action: string }>;

    getModelStream(
        trajectoryId: string,
        timestep: string | number,
        request: ParticleFilterRequest,
        action?: string,
        analysisId?: string
    ): Promise<Readable>;
}
