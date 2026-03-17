import * as goIcons from 'react-icons/go';
import * as hiIcons from 'react-icons/hi';
import * as ioIcons from 'react-icons/io';
import * as luIcons from 'react-icons/lu';
import * as tbIcons from 'react-icons/tb';

export const ICON_LIB_LOADERS = {
    ai: () => import('react-icons/ai'),
    bi: () => import('react-icons/bi'),
    bs: () => import('react-icons/bs'),
    ci: () => import('react-icons/ci'),
    cg: () => import('react-icons/cg'),
    di: () => import('react-icons/di'),
    fa: () => import('react-icons/fa'),
    fc: () => import('react-icons/fc'),
    fi: () => import('react-icons/fi'),
    gi: () => import('react-icons/gi'),
    go: () => Promise.resolve(goIcons),
    gr: () => import('react-icons/gr'),
    hi: () => Promise.resolve(hiIcons),
    im: () => import('react-icons/im'),
    io: () => Promise.resolve(ioIcons),
    io5: () => import('react-icons/io5'),
    lia: () => import('react-icons/lia'),
    lu: () => Promise.resolve(luIcons),
    md: () => import('react-icons/md'),
    pi: () => import('react-icons/pi'),
    ri: () => import('react-icons/ri'),
    rx: () => import('react-icons/rx'),
    si: () => import('react-icons/si'),
    sl: () => import('react-icons/sl'),
    tb: () => Promise.resolve(tbIcons),
    ti: () => import('react-icons/ti'),
    vsc: () => import('react-icons/vsc'),
    wi: () => import('react-icons/wi')
};
