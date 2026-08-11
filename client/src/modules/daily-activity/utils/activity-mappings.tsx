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
    'trajectory-upload': 'var(--accent)',
    'trajectory-deletion': 'var(--danger)',
    'analysis-performed': 'var(--success)',
    'analysis-deletion': 'var(--danger)',
    'container-creation': 'var(--accent-purple)',
    'container-deletion': 'var(--danger)',
    'whiteboard-creation': 'var(--warning)',
    'whiteboard-deletion': 'var(--danger)',
    'role-creation': 'var(--accent-indigo)',
    'role-deletion': 'var(--danger)',
    'secret-key-creation': 'var(--warning)',
    'secret-key-deletion': 'var(--danger)'
};
