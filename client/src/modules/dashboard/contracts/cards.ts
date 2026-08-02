export interface DashboardCardYDomain{
    min: number;
    max: number;
}

export interface DashboardCard{
    key: string;
    name: string;
    listingUrl?: string;
    count: string;
    rawCount: number;
    lastMonthStatus: number;
    series: number[];
    labels: string[];
    yDomain: DashboardCardYDomain;
}
