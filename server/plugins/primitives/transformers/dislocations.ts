import { AnyRecord, ArtifactTransformContext } from '../types/core';
import { DislocationSegment } from '../types/dislocation';
import calculateDislocationType from '../utilities/calculate-dislocation-type';

export default async function transformer(
    ctx: ArtifactTransformContext
): Promise<AnyRecord | null> {
    for await(const chunk of ctx.iterateChunks()){
        const slice: DislocationSegment[] = JSON.parse(chunk.toString('utf-8'));
        
        for(const seg of slice){
            await ctx.writeChunk({
                segmentId: seg.segment_id,
                type: calculateDislocationType(seg),
                numPoints: seg.num_points,
                length: seg.length,
                points: seg.points,
                burgers: seg.burgers,
                nodes: seg.nodes,
                lineDirection: seg.line_direction
            });
        }
    }

    return null;
};