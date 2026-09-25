export interface MetricDataPoint {
  date: string;
  value: number;
}

export type MetricTrend = "up" | "down" | "stable";

export type MetricStatus = "green" | "yellow" | "red";

export type MetricCadence = "daily" | "weekly" | "monthly" | "quarterly";

export interface Metric {
  id: string;
  name: string;
  unit: string;
  currentValue: number;
  targetValue: number;
  data: MetricDataPoint[];
  trend: MetricTrend;
  owner?: string;
  assignee?: string;
  cadence?: MetricCadence;
  lastUpdated?: string;
  status?: MetricStatus;
  priorityId?: string;
  planYear?: number;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}
