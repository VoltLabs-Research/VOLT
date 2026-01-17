import { IAnalysisRepository } from "@/src/modules/analysis/domain/port/IAnalysisRepository";
import Analysis, { AnalysisProps } from "@/src/modules/analysis/domain/entities/Analysis";
import AnalysisModel, { AnalysisDocument } from "../models/AnalysisModel";
import analysisMapper from "../mappers/AnalysisMapper";
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable, inject } from "tsyringe";
import { IEventBus } from "@/src/shared/application/events/IEventBus";
import { SHARED_TOKENS } from "@/src/shared/infrastructure/di/SharedTokens";
import AnalysisDeletedEvent from "../../../../domain/events/AnalysisDeletedEvent";

@injectable()
export default class AnalysisRepository
    extends MongooseBaseRepository<Analysis, AnalysisProps, AnalysisDocument>
    implements IAnalysisRepository {

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {
        super(AnalysisModel, analysisMapper);
    }

    async retryFailedFrames(analysisId: string): Promise<void> {
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);

        if (result) {
            await this.eventBus.publish(new AnalysisDeletedEvent({
                analysisId: id,
                trajectoryId: result.trajectory?.toString(),
                pluginId: result.plugin
            }));
        }

        return !!result;
    }
}