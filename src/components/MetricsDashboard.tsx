import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUpIcon, TrendingDownIcon, PlusIcon, TargetIcon, PencilIcon, TrashIcon, CheckIcon, XIcon, Loader2, UserIcon, CalendarIcon, ClockIcon, AlertCircleIcon, RefreshCwIcon, MinusIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, where, type Unsubscribe } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";

interface MetricDataPoint {
  date: string;
  value: number;
}

interface Metric {
  id: string;
  name: string;
  unit: string;
  currentValue: number;
  targetValue: number;
  data: MetricDataPoint[];
  trend: 'up' | 'down' | 'stable';
  owner?: string;
  cadence?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  lastUpdated?: string;
  status?: 'green' | 'yellow' | 'red';
}

interface MetricsDashboardProps {
  metrics?: Metric[]; // Kept for compatibility
  onMetricUpdate?: (metric: Metric) => void;
  onAddMetric?: (metric: Omit<Metric, 'id'>) => void;
  onDeleteMetric?: (metricId: string) => void;
}

export default function MetricsDashboard({ }: MetricsDashboardProps) {
  const { toast } = useToast();
  const { companyId, selectedYear } = usePlanYear();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Metric | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInValues, setCheckInValues] = useState<Record<string, number>>({});
  const [newMetric, setNewMetric] = useState({
    name: "",
    unit: "",
    currentValue: 0,
    targetValue: 0,
    data: [] as MetricDataPoint[],
    trend: 'stable' as const,
    owner: "",
    cadence: 'weekly' as const,
    status: 'green' as const
  });

  useEffect(() => {
    let unsubYear: Unsubscribe | undefined;
    let unsubLegacy: Unsubscribe | undefined;

    const byId = new Map<string, Metric>();
    const apply = () => {
      setMetrics(Array.from(byId.values()));
      setLoading(false);
    };

    const metricsRef = collection(db, 'companies', companyId, 'metrics');
    const qYear = query(metricsRef, where("planYear", "==", selectedYear));
    unsubYear = onSnapshot(
      qYear,
      (snapshot) => {
        byId.clear();
        snapshot.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as any) }));
        apply();
      },
      (error) => {
        setLoading(false);
      }
    );

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qLegacy = query(metricsRef, where("planYear", "==", null));
      unsubLegacy = onSnapshot(
        qLegacy,
        (snapshot) => {
          snapshot.forEach((d) => {
            if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ...(d.data() as any) });
          });
          apply();
        },
        () => {
          // ignore
        }
      );
    }

    return () => {
      unsubYear?.();
      unsubLegacy?.();
    };
  }, [companyId, selectedYear]);

  // Fetch users for owner dropdown
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers: any[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push({ id: doc.id, ...doc.data() });
      });
      setUsers(fetchedUsers);
    });
    return () => unsubscribe();
  }, []);

  // Calculate derived status for metrics
  const metricsWithStatus = useMemo(() => {
    return metrics.map((metric) => {
      const pct = metric.targetValue > 0 ? (metric.currentValue / metric.targetValue) * 100 : 0;
      const status: 'green' | 'yellow' | 'red' = pct >= 100 ? 'green' : pct >= 75 ? 'yellow' : 'red';
      return { ...metric, status };
    });
  }, [metrics]);

  // Check for stale data alerts
  const staleMetrics = useMemo(() => {
    const now = new Date();
    return metricsWithStatus.filter((metric) => {
      if (!metric.lastUpdated) return true;
      const lastUpdate = new Date(metric.lastUpdated);
      const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
      
      switch (metric.cadence) {
        case 'daily': return daysSinceUpdate > 1;
        case 'weekly': return daysSinceUpdate > 7;
        case 'monthly': return daysSinceUpdate > 30;
        case 'quarterly': return daysSinceUpdate > 90;
        default: return daysSinceUpdate > 7;
      }
    });
  }, [metricsWithStatus]);

  const getProgressPercentage = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const getTrendIcon = (trend: Metric['trend']) => {
    switch (trend) {
      case 'up': return <TrendingUpIcon className="w-4 h-4 text-green-600" />;
      case 'down': return <TrendingDownIcon className="w-4 h-4 text-red-600" />;
      default: return <div className="w-4 h-4" />;
    }
  };

  const getTrendColor = (trend: Metric['trend']) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const handleAddMetric = async () => {
    if (!newMetric.name.trim()) return;
    
    try {
      const metricsRef = collection(db, 'companies', companyId, 'metrics');
      await addDoc(metricsRef, {
        ...newMetric,
        planYear: selectedYear,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      
      setNewMetric({
        name: "",
        unit: "",
        currentValue: 0,
        targetValue: 0,
        data: [],
        trend: 'stable',
        owner: "",
        cadence: 'weekly',
        status: 'green'
      });
      setShowAddForm(false);
      toast({ title: "Success", description: "KPI added successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add KPI", variant: "destructive" });
    }
  };

  const handleWeeklyCheckIn = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      for (const metric of metrics) {
        const newValue = checkInValues[metric.id];
        if (newValue !== undefined && newValue !== metric.currentValue) {
          const metricRef = doc(db, 'companies', companyId, 'metrics', metric.id);
          const newDataPoint = { date: today, value: newValue };
          const updatedData = [...(metric.data || []), newDataPoint].slice(-12); // Keep last 12 data points
          
          // Calculate trend
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (updatedData.length >= 2) {
            const prevValue = updatedData[updatedData.length - 2].value;
            if (newValue > prevValue) trend = 'up';
            else if (newValue < prevValue) trend = 'down';
          }

          await updateDoc(metricRef, {
            currentValue: newValue,
            data: updatedData,
            trend,
            lastUpdated: new Date().toISOString()
          });
        }
      }
      
      setShowCheckIn(false);
      setCheckInValues({});
      toast({ title: "Check-in complete", description: "All KPIs have been updated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save check-in", variant: "destructive" });
    }
  };

  const handleEditMetric = (metric: Metric) => {
    setEditingMetricId(metric.id);
    setEditForm({ ...metric });
  };

  const handleSaveEdit = async () => {
    if (editForm) {
      try {
        const metricRef = doc(db, 'companies', companyId, 'metrics', editForm.id);
        const { id, ...data } = editForm;
        await updateDoc(metricRef, data);
        
        setEditingMetricId(null);
        setEditForm(null);
        toast({ title: "Success", description: "KPI updated successfully" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to update KPI", variant: "destructive" });
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingMetricId(null);
    setEditForm(null);
  };

  const handleDeleteMetric = async (metricId: string) => {
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'metrics', metricId));
      toast({ title: "Success", description: "KPI deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete KPI", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">KPI Dashboard</h2>
          <p className="text-muted-foreground">Monitor your key performance indicators</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              setShowCheckIn(true);
              const initialValues: Record<string, number> = {};
              metrics.forEach(m => { initialValues[m.id] = m.currentValue; });
              setCheckInValues(initialValues);
            }}
            data-testid="button-weekly-checkin"
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            Weekly Check-In
          </Button>
          <Button 
            onClick={() => setShowAddForm(true)}
            data-testid="button-add-metric"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add KPI
          </Button>
        </div>
      </div>

      {/* Stale Data Alert */}
      {staleMetrics.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircleIcon className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-400">
                  {staleMetrics.length} KPI{staleMetrics.length > 1 ? 's' : ''} need{staleMetrics.length === 1 ? 's' : ''} updating
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-500">
                  {staleMetrics.map(m => m.name).join(', ')}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-auto border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                onClick={() => {
                  setShowCheckIn(true);
                  const initialValues: Record<string, number> = {};
                  metrics.forEach(m => { initialValues[m.id] = m.currentValue; });
                  setCheckInValues(initialValues);
                }}
              >
                Update Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Check-In Modal */}
      {showCheckIn && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCwIcon className="h-5 w-5" />
              Weekly KPI Check-In
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Update each KPI with this week's value. Changes will be saved with today's date.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.map((metric) => {
                const pct = metric.targetValue > 0 ? (checkInValues[metric.id] / metric.targetValue) * 100 : 0;
                const status = pct >= 100 ? 'green' : pct >= 75 ? 'yellow' : 'red';
                const statusColors = {
                  green: "border-l-green-500",
                  yellow: "border-l-yellow-500",
                  red: "border-l-red-500"
                };
                
                return (
                  <div key={metric.id} className={`p-3 rounded-lg border border-l-4 ${statusColors[status]}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{metric.name}</span>
                      <Badge variant={status === 'green' ? 'default' : status === 'yellow' ? 'secondary' : 'destructive'} className="text-xs">
                        {Math.round(pct)}% of target
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={checkInValues[metric.id] || 0}
                        onChange={(e) => setCheckInValues(prev => ({
                          ...prev,
                          [metric.id]: Number(e.target.value)
                        }))}
                        className="h-8"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {metric.unit} / {metric.targetValue} target
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowCheckIn(false); setCheckInValues({}); }}>
                Cancel
              </Button>
              <Button onClick={handleWeeklyCheckIn}>
                <CheckIcon className="w-4 h-4 mr-2" />
                Save Check-In
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showAddForm && (
        <Card className="border-2 border-dashed border-border">
          <CardHeader>
            <CardTitle>Add New KPI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Metric name"
                value={newMetric.name}
                onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))}
                data-testid="input-new-metric-name"
              />
              <Input
                placeholder="Unit (e.g., $, %, users)"
                value={newMetric.unit}
                onChange={(e) => setNewMetric(prev => ({ ...prev, unit: e.target.value }))}
                data-testid="input-new-metric-unit"
              />
              <Input
                type="number"
                placeholder="Current value"
                value={newMetric.currentValue || ""}
                onChange={(e) => setNewMetric(prev => ({ ...prev, currentValue: Number(e.target.value) }))}
                data-testid="input-new-metric-current"
              />
              <Input
                type="number"
                placeholder="Target value"
                value={newMetric.targetValue || ""}
                onChange={(e) => setNewMetric(prev => ({ ...prev, targetValue: Number(e.target.value) }))}
                data-testid="input-new-metric-target"
              />
              <Select
                value={newMetric.owner || "unassigned"}
                onValueChange={(value) => setNewMetric(prev => ({ ...prev, owner: value === "unassigned" ? "" : value }))}
              >
                <SelectTrigger data-testid="select-new-metric-owner">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.name || user.email}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={newMetric.cadence}
                onValueChange={(value) => setNewMetric(prev => ({ ...prev, cadence: value as any }))}
              >
                <SelectTrigger data-testid="select-new-metric-cadence">
                  <SelectValue placeholder="Update cadence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddMetric} data-testid="button-save-new-metric">
                Save KPI
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
                data-testid="button-cancel-new-metric"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {metricsWithStatus.map((metric) => {
          const statusColors = {
            green: "border-l-green-500",
            yellow: "border-l-yellow-500",
            red: "border-l-red-500"
          };
          const statusBgColors = {
            green: "bg-green-50/50 dark:bg-green-950/20",
            yellow: "bg-yellow-50/50 dark:bg-yellow-950/20",
            red: "bg-red-50/50 dark:bg-red-950/20"
          };
          
          return (
          <Card key={metric.id} className={`hover-elevate group border-l-4 ${statusColors[metric.status || 'green']} ${statusBgColors[metric.status || 'green']}`} data-testid={`card-metric-${metric.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {editingMetricId === metric.id ? (
                    <Input
                      value={editForm?.name || ""}
                      onChange={(e) => setEditForm(prev => prev ? {...prev, name: e.target.value} : null)}
                      className="h-7 text-base font-semibold"
                      data-testid={`input-edit-metric-name-${metric.id}`}
                    />
                  ) : (
                    <CardTitle className="text-base">{metric.name}</CardTitle>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Badge 
                    variant={metric.status === 'green' ? 'default' : metric.status === 'yellow' ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {(metric.status || 'green').toUpperCase()}
                  </Badge>
                  {editingMetricId === metric.id ? (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSaveEdit}
                        className="h-6 w-6 text-green-500"
                        data-testid={`button-save-metric-${metric.id}`}
                      >
                        <CheckIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-6 w-6 text-red-500"
                        data-testid={`button-cancel-metric-${metric.id}`}
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEditMetric(metric)}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-edit-metric-${metric.id}`}
                      >
                        <PencilIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteMetric(metric.id)}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500"
                        data-testid={`button-delete-metric-${metric.id}`}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {/* Owner and Last Updated */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {metric.owner && (
                  <span className="flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    {metric.owner}
                  </span>
                )}
                {metric.cadence && (
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {metric.cadence}
                  </span>
                )}
                {metric.lastUpdated && (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    {new Date(metric.lastUpdated).toLocaleDateString()}
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  {editingMetricId === metric.id ? (
                    <>
                      <Input
                        type="number"
                        value={editForm?.currentValue || ""}
                        onChange={(e) => setEditForm(prev => prev ? {...prev, currentValue: Number(e.target.value)} : null)}
                        className="w-32 h-8 text-2xl font-bold"
                        data-testid={`input-edit-metric-current-${metric.id}`}
                      />
                      <Input
                        value={editForm?.unit || ""}
                        onChange={(e) => setEditForm(prev => prev ? {...prev, unit: e.target.value} : null)}
                        className="w-16 h-6 text-sm"
                        placeholder="unit"
                        data-testid={`input-edit-metric-unit-${metric.id}`}
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-foreground">
                        {metric.currentValue.toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">{metric.unit}</span>
                    </>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <TargetIcon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Target:</span>
                    {editingMetricId === metric.id ? (
                      <Input
                        type="number"
                        value={editForm?.targetValue || ""}
                        onChange={(e) => setEditForm(prev => prev ? {...prev, targetValue: Number(e.target.value)} : null)}
                        className="w-24 h-5 text-sm"
                        data-testid={`input-edit-metric-target-${metric.id}`}
                      />
                    ) : (
                      <span>{metric.targetValue.toLocaleString()}{metric.unit}</span>
                    )}
                  </div>
                  <Badge variant="outline" className={getTrendColor(metric.trend)}>
                    {getProgressPercentage(
                      editingMetricId === metric.id ? editForm?.currentValue || 0 : metric.currentValue,
                      editingMetricId === metric.id ? editForm?.targetValue || 1 : metric.targetValue
                    ).toFixed(0)}%
                  </Badge>
                </div>

                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      getProgressPercentage(metric.currentValue, metric.targetValue) >= 100 
                        ? 'bg-green-500' 
                        : getProgressPercentage(metric.currentValue, metric.targetValue) >= 75 
                        ? 'bg-blue-500' 
                        : 'bg-yellow-500'
                    }`}
                    style={{ 
                      width: `${Math.min(getProgressPercentage(metric.currentValue, metric.targetValue), 100)}%` 
                    }}
                  />
                </div>
              </div>

              {metric.data && metric.data.length > 0 && (
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metric.data}>
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <Tooltip 
                        labelFormatter={(value) => `Date: ${value}`}
                        formatter={(value: number) => [`${value.toLocaleString()}${metric.unit}`, metric.name]}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              
              {/* Trend indicator */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                <span className="flex items-center gap-1">
                  {metric.trend === 'up' ? (
                    <><TrendingUpIcon className="h-3 w-3 text-green-600" /> Trending up</>
                  ) : metric.trend === 'down' ? (
                    <><TrendingDownIcon className="h-3 w-3 text-red-600" /> Trending down</>
                  ) : (
                    <><MinusIcon className="h-3 w-3" /> Stable</>
                  )}
                </span>
                <span>{getProgressPercentage(metric.currentValue, metric.targetValue).toFixed(0)}% of target</span>
              </div>
            </CardContent>
          </Card>
        );})}
      </div>
    </div>
  );
}
