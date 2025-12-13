import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@mui/material'
import './ChartContainer.css'

interface ChartContainerProps {
  icon: LucideIcon
  title: string
  isLoading: boolean
  children: React.ReactNode
  stats?: Array<{
    label: string
    value: string | number
  }>
  statsLoading?: boolean
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  icon: Icon,
  title,
  isLoading,
  children,
  stats,
  statsLoading = false
}) => {
  return(
    <div className="chart-container">
      <div className="chart-header">
        <div className="chart-title-group">
          <Icon className="chart-icon" />
          <h3 className="chart-title">{title}</h3>
        </div>
        {stats && (
          <div className="chart-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="chart-stat">
                <span className="chart-stat-label">{stat.label}</span>
                {statsLoading ? (
                  <Skeleton variant="text" width={60} height={18} />
                ) : (
                  <span className="chart-stat-value">{stat.value}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton
          variant="rectangular"
          width="100%"
          height={280}
          sx={{ borderRadius: '8px' }}
        />
      ) : (
        children
      )}
    </div>
  )
}
