import type { FrameMetadata, ParseOptions, ParseResult } from '@modules/trajectory/domain/contracts/trajectory';

export interface ITrajectoryReader {
    read(filePath: string, options?: ParseOptions): Promise<ParseResult>;
    readMetadata(filePath: string): Promise<FrameMetadata>;
};
