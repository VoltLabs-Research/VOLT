import type { User } from '@/modules/auth/api/entities/user';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { motion } from 'framer-motion';
import Avatar from '@/shared/presentation/components/Avatar';
import './SimulationCardHeader.css';
import type { Variants } from 'framer-motion';

interface SimulationCardHeaderProps {
    user?: User | null;
};

const HEADER_VARIANTS: Variants = {
    normal: { background: 'rgba(18, 18, 18, 0)' },
    hover: { background: 'rgba(18, 18, 18, 0.45)' }
};

const HEADER_PADDING_VARIANTS: Variants = {
    normal: { padding: 0 },
    hover: { padding: '0.3rem 0.5rem' }
};

const HEADER_AVATAR_VARIANTS: Variants = {
    normal: { scale: 0.8, opacity: 0.9 },
    hover: { scale: 1, opacity: 1 }
};

const HEADER_CONTENT_VARIANTS: Variants = {
    normal: { width: 0, opacity: 0, marginLeft: 0, scale: 0.8 },
    hover: { width: 'auto', opacity: 1, marginLeft: '0.75rem', scale: 1 }
};

export default function SimulationCardHeader({ user }: SimulationCardHeaderProps) {
    if (!user?.firstName) return null;

    return (
        <motion.div
            className='simulation-card-header d-flex column gap-075 p-absolute top-0 left-0 right-0 z-5'
            initial={false}
            whileHover='hover'
            animate='normal'
            variants={HEADER_VARIANTS}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
            <motion.div
                className='d-flex items-center p-relative'
                variants={HEADER_PADDING_VARIANTS}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
                <motion.div
                    className='header-avatar-wrapper'
                    variants={HEADER_AVATAR_VARIANTS}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                    <Avatar user={user} size='sm' />
                </motion.div>
                <motion.div
                    className='d-flex column content-center overflow-hidden'
                    variants={HEADER_CONTENT_VARIANTS}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                    <Paragraph className='font-size-1 font-weight-5 color-secondary'>Uploaded by</Paragraph>
                    <Paragraph className='font-size-1 font-weight-5 color-secondary header-user-name text-truncate'>
                        {`${user.firstName} ${user.lastName}`}
                    </Paragraph>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}
