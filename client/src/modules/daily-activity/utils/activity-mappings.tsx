import { Beaker, Container, Key, Pencil, ShieldCheck, Trash2, Upload } from 'lucide-react';
import type { ActivityItem } from '@volt/contracts/modules/daily-activity/domain';
import type { ReactNode } from 'react';

export const ACTIVITY_ICON: Record<ActivityItem['type'], ReactNode> = {
    'trajectory-upload': <Upload size={14} />,
    'trajectory-deletion': <Trash2 size={14} />,
    'analysis-performed': <Beaker size={14} />,
    'analysis-deletion': <Trash2 size={14} />,
    'container-creation': <Container size={14} />,
    'container-deletion': <Trash2 size={14} />,
    'whiteboard-creation': <Pencil size={14} />,
    'whiteboard-deletion': <Trash2 size={14} />,
    'role-creation': <ShieldCheck size={14} />,
    'role-deletion': <Trash2 size={14} />,
    'secret-key-creation': <Key size={14} />,
    'secret-key-deletion': <Trash2 size={14} />
};

export const ACTIVITY_ACCENT: Record<ActivityItem['type'], string> = {
    'trajectory-upload': 'var(--accent-blue)',
    'trajectory-deletion': 'var(--accent-red)',
    'analysis-performed': 'var(--accent-green)',
    'analysis-deletion': 'var(--accent-red)',
    'container-creation': 'var(--accent-purple)',
    'container-deletion': 'var(--accent-red)',
    'whiteboard-creation': 'var(--accent-yellow)',
    'whiteboard-deletion': 'var(--accent-red)',
    'role-creation': 'var(--accent-indigo)',
    'role-deletion': 'var(--accent-red)',
    'secret-key-creation': 'var(--accent-orange)',
    'secret-key-deletion': 'var(--accent-red)'
};
