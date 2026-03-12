import { GoBeaker, GoContainer, GoFileCode, GoKey, GoPencil, GoShieldCheck, GoTrash, GoUpload } from 'react-icons/go';
import type { ActivityItem } from '@/modules/daily-activity/api/entities/daily-activity';
import type { ReactNode } from 'react';

export const ACTIVITY_ICON: Record<ActivityItem['type'], ReactNode> = {
    'trajectory-upload': <GoUpload size={14} />,
    'trajectory-deletion': <GoTrash size={14} />,
    'analysis-performed': <GoBeaker size={14} />,
    'analysis-deletion': <GoTrash size={14} />,
    'latex-document-creation': <GoFileCode size={14} />,
    'latex-document-deletion': <GoTrash size={14} />,
    'container-creation': <GoContainer size={14} />,
    'container-deletion': <GoTrash size={14} />,
    'whiteboard-creation': <GoPencil size={14} />,
    'whiteboard-deletion': <GoTrash size={14} />,
    'role-creation': <GoShieldCheck size={14} />,
    'role-deletion': <GoTrash size={14} />,
    'secret-key-creation': <GoKey size={14} />,
    'secret-key-deletion': <GoTrash size={14} />
};

export const ACTIVITY_ACCENT: Record<ActivityItem['type'], string> = {
    'trajectory-upload': 'var(--accent-blue)',
    'trajectory-deletion': 'var(--accent-red)',
    'analysis-performed': 'var(--accent-green)',
    'analysis-deletion': 'var(--accent-red)',
    'latex-document-creation': 'var(--accent-teal)',
    'latex-document-deletion': 'var(--accent-red)',
    'container-creation': 'var(--accent-purple)',
    'container-deletion': 'var(--accent-red)',
    'whiteboard-creation': 'var(--accent-yellow)',
    'whiteboard-deletion': 'var(--accent-red)',
    'role-creation': 'var(--accent-indigo)',
    'role-deletion': 'var(--accent-red)',
    'secret-key-creation': 'var(--accent-orange)',
    'secret-key-deletion': 'var(--accent-red)'
};
