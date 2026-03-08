import type { FrameMetadata, ParseOptions, ParseResult } from './ParserTypes';

export interface ITrajectoryReader {
    read(filePath: string, options?: ParseOptions): Promise<ParseResult>;
    readMetadata(filePath: string): Promise<FrameMetadata>;
}
