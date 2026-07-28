import type { tags } from 'typia';

export interface GetActivitySummaryInput{
    /**
     * Days to look back. Defaults to 7.
     */
    range?: number & tags.Type<'int32'> & tags.ExclusiveMinimum<0> & tags.Maximum<365>;
    /**
     * "team" (default) summarizes all members; "self" only the current user.
     */
    scope?: 'team' | 'self';
}
