import React from 'react'
import { Skeleton } from '@mui/material'

interface MetricStatProps {
  label: string
  value: string | number
  isLoading?: boolean
}

export const MetricStat: React.FC<MetricStatProps> = ({ label, value, isLoading = false }) => {
  if(isLoading){
    return(
      <div className="metric-stat">
        <span className="metric-stat-label">{label}</span>
        <Skeleton variant="text" width={60} height={18} />
      </div>
    )
  }

  return(
    <div className="metric-stat">
      <span className="metric-stat-label">{label}</span>
      <span className="metric-stat-value">{value}</span>
    </div>
  )
}
