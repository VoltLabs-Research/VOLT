import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type Analysis from '@modules/analysis/domain/entities/Analysis';

export interface AnalysisStatusChangedEventPayload {
    analysisId: string;
    trajectoryId: string;
    teamId: string;
    status: Analysis['props']['status'];
    completedFrames?: number;
    totalFrames?: number;
    failedFrames?: number;
};

export default class AnalysisStatusChangedEvent extends BaseDomainEvent<AnalysisStatusChangedEventPayload> {
    constructor(payload: AnalysisStatusChangedEventPayload) {
        super('analysis.status.changed', payload);
    }
};
