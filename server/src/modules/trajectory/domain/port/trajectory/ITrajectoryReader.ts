import type { AtomPageResult, FrameMetadata, ParseOptions, ParseResult } from '@modules/trajectory/domain/contracts/trajectory';

export interface ITrajectoryReader {
    read(filePath: string, options?: ParseOptions, teamClusterId?: string, trajectoryId?: string, timestep?: string | number): Promise<ParseResult>;
    readMetadata(filePath: string, teamClusterId?: string, trajectoryId?: string, timestep?: string | number): Promise<FrameMetadata>;
    readPage(teamClusterId: string, trajectoryId: string, timestep: string | number, page: number, limit: number): Promise<AtomPageResult>;
};
