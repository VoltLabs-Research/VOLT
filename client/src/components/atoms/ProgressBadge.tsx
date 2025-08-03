/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

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