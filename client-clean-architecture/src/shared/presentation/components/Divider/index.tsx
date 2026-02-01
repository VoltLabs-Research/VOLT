import './Divider.css';

interface DividerProps {
    orientation?: 'horizontal' | 'vertical';
    className?: string;
};

const Divider = ({ orientation = 'horizontal', className = '' }: DividerProps) => {
    const classes = [
        'volt-divider',
        `volt-divider--${orientation}`,
        className
    ].filter(Boolean).join(' ');

    return <hr className={classes} />;
};

export default Divider;
