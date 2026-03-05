import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import { decodeMultiStream } from '@shared/infrastructure/utilities/msgpack';
import mergeChunkedValue from '@modules/plugin/infrastructure/utilities/merge-chunked-value';
import {
    GetSubListingInputDTO,
    GetSubListingOutputDTO,
    SubListingColumn
} from '@modules/plugin/application/dtos/listing-row/GetSubListingDTO';

const shouldIgnoreValue = (value: unknown): boolean => {
    return Array.isArray(value) && value.length >= 1 && Array.isArray(value[0]);
};

@injectable()
export class GetSubListingUseCase implements IUseCase<GetSubListingInputDTO, GetSubListingOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ) {}

    async execute(input: GetSubListingInputDTO): Promise<Result<GetSubListingOutputDTO>> {
        const analysis = await this.analysisRepository.findById(input.analysisId);
        if (!analysis) {
            return Result.fail({ message: 'Analysis::NotFound', statusCode: 404 });
        }

        const trajectoryId = analysis.props.trajectory;
        const storageKey = `plugins/trajectory-${trajectoryId}/analysis-${input.analysisId}/${input.exposureId}/timestep-${input.timestep}.msgpack`;

        let decoded: Record<string, unknown> | null = null;

        try {
            const stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, storageKey);
            for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array | Buffer>)) {
                if (message && typeof message === 'object') {
                    decoded = mergeChunkedValue(decoded, message);
                }
            }
        } catch {
            return Result.fail({ message: 'SubListing::PayloadNotFound', statusCode: 404 });
        }

        if (!decoded) {
            return Result.fail({ message: 'SubListing::EmptyPayload', statusCode: 404 });
        }

        const subListings = decoded.sub_listings as Record<string, unknown> | undefined;
        if (!subListings || typeof subListings !== 'object') {
            return Result.fail({ message: 'SubListing::NoSubListings', statusCode: 404 });
        }

        const subListingData = subListings[input.subListingName];
        if (!Array.isArray(subListingData) || subListingData.length === 0) {
            return Result.fail({ message: 'SubListing::NotFound', statusCode: 404 });
        }

        const firstRow = subListingData[0] as Record<string, unknown>;
        const filteredKeys = Object.keys(firstRow).filter((key) => !shouldIgnoreValue(firstRow[key]));

        const columns: SubListingColumn[] = filteredKeys.map((key) => ({
            label: key,
            sortable: true
        }));

        const rows = subListingData.map((item: Record<string, unknown>) => {
            const row: Record<string, unknown> = {};
            for (const key of filteredKeys) {
                row[key] = item[key];
            }
            return row;
        });

        return Result.ok({
            subListingName: input.subListingName,
            columns,
            rows
        });
    }
}
