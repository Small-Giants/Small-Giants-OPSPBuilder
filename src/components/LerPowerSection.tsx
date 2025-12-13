import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUpIcon, TargetIcon, EditIcon, SaveIcon, XIcon } from "lucide-react";

interface LerPowerSectionProps {
  lerData: {
    grossProfit: number;
    laborCost: number;
    ratio: number;
  };
  powerOfOne: {
    lever: string;
    goal: string;
  };
  onLerUpdate: (data: any) => void;
  onPowerUpdate: (data: any) => void;
}

export default function LerPowerSection({ 
  lerData, 
  powerOfOne, 
  onLerUpdate, 
  onPowerUpdate 
}: LerPowerSectionProps) {
  const [isEditingLer, setIsEditingLer] = useState(false);
  const [isEditingPower, setIsEditingPower] = useState(false);
  const [tempLer, setTempLer] = useState(lerData);
  const [tempPower, setTempPower] = useState(powerOfOne);

  const calculateLer = (grossProfit: number, laborCost: number) => {
    if (laborCost === 0) return 0;
    return Number((grossProfit / laborCost).toFixed(2));
  };

  const saveLer = () => {
    const ratio = calculateLer(tempLer.grossProfit, tempLer.laborCost);
    onLerUpdate({ ...tempLer, ratio });
    setIsEditingLer(false);
  };

  const savePower = () => {
    onPowerUpdate(tempPower);
    setIsEditingPower(false);
  };

  const getLerColor = (ratio: number) => {
    if (ratio >= 3) return "text-green-600 dark:text-green-400";
    if (ratio >= 2) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="hover-elevate">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">Labor Efficiency Ratio (LER)</CardTitle>
            {isEditingLer ? (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={saveLer}
                  data-testid="button-save-ler"
                >
                  <SaveIcon className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    setTempLer(lerData);
                    setIsEditingLer(false);
                  }}
                  data-testid="button-cancel-ler"
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setIsEditingLer(true)}
                data-testid="button-edit-ler"
              >
                <EditIcon className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditingLer ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Gross Profit</label>
                <Input
                  type="number"
                  value={tempLer.grossProfit}
                  onChange={(e) => setTempLer({ ...tempLer, grossProfit: Number(e.target.value) })}
                  data-testid="input-gross-profit"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Labor Cost</label>
                <Input
                  type="number"
                  value={tempLer.laborCost}
                  onChange={(e) => setTempLer({ ...tempLer, laborCost: Number(e.target.value) })}
                  data-testid="input-labor-cost"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ratio</span>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${getLerColor(lerData.ratio)}`}>
                    {lerData.ratio}
                  </span>
                  <TrendingUpIcon className={`w-5 h-5 ${getLerColor(lerData.ratio)}`} />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Profit</span>
                  <span className="text-foreground">${lerData.grossProfit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Labor Cost</span>
                  <span className="text-foreground">${lerData.laborCost.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs text-muted-foreground italic">
                  Formula: Gross Profit ÷ Labor Cost
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="hover-elevate">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">Power of One Focus</CardTitle>
            {isEditingPower ? (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={savePower}
                  data-testid="button-save-power"
                >
                  <SaveIcon className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    setTempPower(powerOfOne);
                    setIsEditingPower(false);
                  }}
                  data-testid="button-cancel-power"
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setIsEditingPower(true)}
                data-testid="button-edit-power"
              >
                <EditIcon className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditingPower ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Lever</label>
                <Input
                  value={tempPower.lever}
                  onChange={(e) => setTempPower({ ...tempPower, lever: e.target.value })}
                  placeholder="Key lever to focus on"
                  data-testid="input-power-lever"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Goal</label>
                <Input
                  value={tempPower.goal}
                  onChange={(e) => setTempPower({ ...tempPower, goal: e.target.value })}
                  placeholder="Target goal"
                  data-testid="input-power-goal"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <TargetIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">Lever</div>
                    <div className="text-sm text-foreground">
                      {powerOfOne.lever || <span className="italic text-muted-foreground">Not set</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Badge variant="secondary">Goal</Badge>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-foreground">
                      {powerOfOne.goal || <span className="italic text-muted-foreground">Not set</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground italic">
                  Focus on one key metric that drives significant impact
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
