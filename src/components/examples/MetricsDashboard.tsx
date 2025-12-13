import { useState } from "react";
import MetricsDashboard from '../MetricsDashboard';

export default function MetricsDashboardExample() {
  //todo: remove mock functionality
  const [metrics, setMetrics] = useState([
    {
      id: "m1",
      name: "Monthly Recurring Revenue",
      unit: "$",
      currentValue: 85000,
      targetValue: 100000,
      trend: 'up' as const,
      data: [
        { date: "Jan", value: 65000 },
        { date: "Feb", value: 72000 },
        { date: "Mar", value: 78000 },
        { date: "Apr", value: 81000 },
        { date: "May", value: 85000 }
      ]
    },
    {
      id: "m2",
      name: "Active Users",
      unit: "",
      currentValue: 1250,
      targetValue: 2000,
      trend: 'up' as const,
      data: [
        { date: "Jan", value: 890 },
        { date: "Feb", value: 950 },
        { date: "Mar", value: 1100 },
        { date: "Apr", value: 1180 },
        { date: "May", value: 1250 }
      ]
    },
    {
      id: "m3",
      name: "Customer Satisfaction",
      unit: "%",
      currentValue: 92,
      targetValue: 95,
      trend: 'stable' as const,
      data: [
        { date: "Jan", value: 89 },
        { date: "Feb", value: 91 },
        { date: "Mar", value: 93 },
        { date: "Apr", value: 91 },
        { date: "May", value: 92 }
      ]
    },
    {
      id: "m4",
      name: "Churn Rate",
      unit: "%",
      currentValue: 3.2,
      targetValue: 2.0,
      trend: 'down' as const,
      data: [
        { date: "Jan", value: 4.1 },
        { date: "Feb", value: 3.8 },
        { date: "Mar", value: 3.5 },
        { date: "Apr", value: 3.3 },
        { date: "May", value: 3.2 }
      ]
    }
  ]);

  const handleMetricUpdate = (updatedMetric: typeof metrics[0]) => {
    console.log('Metric updated:', updatedMetric);
    setMetrics(prev => 
      prev.map(m => m.id === updatedMetric.id ? updatedMetric : m)
    );
  };

  const handleAddMetric = (newMetric: Omit<typeof metrics[0], 'id'>) => {
    console.log('Adding metric:', newMetric);
    const metric = {
      ...newMetric,
      id: `m${Date.now()}`
    };
    setMetrics(prev => [...prev, metric]);
  };

  return (
    <div className="p-6">
      <MetricsDashboard
        metrics={metrics}
        onMetricUpdate={handleMetricUpdate}
        onAddMetric={handleAddMetric}
      />
    </div>
  );
}