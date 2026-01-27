import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@mui/material'
import '@/shared/presentation/components/atoms/common/ChartContainer/ChartContainer.css'
import Title from '@/shared/presentation/components/primitives/Title';
import Container from '@/shared/presentation/components/primitives/Container';

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
  return (
    <Container className="d-flex h-max column p-1-5 chart-container sm:p-1">
      <Container className="d-flex content-between mb-1-5 sm:column sm:gap-1">
        <Container className="d-flex items-center gap-075">
          <Icon className="chart-icon color-muted-foreground" />
          <Title className='font-size-3 chart-title font-weight-6 color-primary'>{title}</Title>
        </Container>
        {stats && (
          <Container className="d-flex gap-1-5 flex-wrap sm:w-max sm:gap-1">
            {stats.map((stat) => (
              <Container key={stat.label} className="d-flex column gap-025">
                <span className="chart-stat-label font-size-1 color-muted-foreground color-muted">{stat.label}</span>
                {statsLoading ? (
                  <Skeleton variant="text" width={60} height={18} />
                ) : (
                  <span className="chart-stat-value font-size-3 color-primary">{stat.value}</span>
                )}
              </Container>
            ))}
          </Container>
        )}
      </Container>

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
    </Container>
  )
}
