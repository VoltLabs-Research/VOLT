import React from 'react';
import { CircularProgress, Badge } from '@mui/material';

const ProgressBadge: React.FC<any> = ({ 
    completionRate, 
    hasActiveJobs, 
    isCompleted, 
    getBorderColor,
    shouldShow = true 
}) => {
    if(!shouldShow) return null;

    const getBadgeContent = (): React.ReactNode => {
        // TODO: maybe a icon??
        if(isCompleted) return '✓';
        if(completionRate === 0 && hasActiveJobs){
            return (
              <CircularProgress 
                    size={12} 
                    thickness={6}
                    sx={{ 
                        color: 'white',
                        '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round'
                        }
                    }} 
                />
            );
            
        }

        return `${completionRate}%`;
    };

    const getBadgeColor = (): string => {
        if(completionRate === 0 && hasActiveJobs){
            return '#6b7280';
        }

        return getBorderColor();
    };

     return (
        <Badge
            badgeContent={getBadgeContent()}
            sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                '& .MuiBadge-badge': {
                    backgroundColor: getBadgeColor(),
                    color: 'white',
                    fontSize: '0.75rem',
                    minWidth: '28px',
                    height: '20px',
                    fontWeight: 600,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }
            }}
        >
            <div />
        </Badge>
    );
};

export default ProgressBadge;