import type { tags } from 'typia';

export interface GetActivitySummaryInput{
    range?: number & tags.Type<'int32'> & tags.ExclusiveMinimum<0> & tags.Maximum<365>;
    scope?: 'team' | 'self';
}
