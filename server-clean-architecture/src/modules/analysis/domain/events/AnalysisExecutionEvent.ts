import { IDomainEvent } from "@/src/shared/application/events/IDomainEvent";

export default class AnalysisRequestedEvent implements IDomainEvent {
    readonly name = 'analysis.requested';
    readonly eventId: string;
    readonly occurredOn: Date;

    constructor(
        public readonly analysisId: string,
        public readonly pluginId: string,
        public readonly trajectoryId: string,
        public readonly userId: string,
        public readonly teamId: string,
        public readonly config: Record<string, any>,
        public readonly options: {
            selectedFrameOnly?: boolean;
            timestep?: number;
        }
    ){
        this.occurredOn = new Date();
        this.eventId = crypto.randomUUID();
    }
}
