import { cn } from '@heroui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { Components } from 'react-markdown';

const REMARK_PLUGINS = [remarkGfm];

const PROSE_CLASS = cn(
    'm-0 w-full min-w-0 break-words leading-[1.6]',
    '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
    '[&_p]:my-2 [&_p+p]:mt-3',
    '[&_ul]:my-2 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:pl-5',
    '[&_li]:m-0 [&_li]:pl-0.5 [&_li+li]:mt-1 [&_li>p]:m-0',
    '[&_li>ul]:mt-1 [&_li>ul]:mb-0 [&_li>ol]:mt-1 [&_li>ol]:mb-0',
    '[&_:is(h1,h2,h3,h4,h5,h6)]:mx-0 [&_:is(h1,h2,h3,h4,h5,h6)]:mt-4 [&_:is(h1,h2,h3,h4,h5,h6)]:mb-1.5',
    '[&_:is(h1,h2,h3,h4,h5,h6)]:leading-[1.3] [&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:text-foreground',
    '[&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_:is(h4,h5,h6)]:text-sm',
    '[&_code]:font-mono',
    '[&_pre]:my-2.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-background [&_pre]:px-3 [&_pre]:py-2.5',
    '[&_pre_code]:whitespace-pre [&_pre_code]:text-xs',
    '[&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-surface-secondary [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-xs',
    '[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2',
    '[&_blockquote]:my-2.5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:py-0.5 [&_blockquote]:pr-0 [&_blockquote]:pl-3 [&_blockquote]:text-muted',
    '[&_blockquote>*:first-child]:mt-0 [&_blockquote>*:last-child]:mb-0',
    '[&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border',
    '[&_table]:my-2.5 [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-border [&_table]:border-collapse [&_table]:text-xs',
    '[&_thead]:bg-surface-secondary',
    '[&_th]:border-b [&_th]:border-border [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted',
    '[&_td]:border-b [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5',
    '[&_tr:last-child_td]:border-b-0',
    '[&_tbody_tr:hover]:bg-surface-hover',
    '[&_strong]:font-semibold [&_strong]:text-foreground'
);

const SIZE_CLASS = {
    base: 'text-sm text-foreground',
    sm: cn(
        'text-xs text-muted',
        '[&_p]:my-1 [&_p+p]:mt-1.5 [&_ul]:my-1 [&_ol]:my-1 [&_pre]:my-1.5 [&_blockquote]:my-1.5'
    )
} as const;

interface ProseProps {
    children: string;
    size?: keyof typeof SIZE_CLASS;
    components?: Components;
    className?: string;
}

const Prose = ({ children, size = 'base', components, className }: ProseProps) => (
    <div className={cn(PROSE_CLASS, SIZE_CLASS[size], className)}>
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
            {children}
        </ReactMarkdown>
    </div>
);

export default Prose;
