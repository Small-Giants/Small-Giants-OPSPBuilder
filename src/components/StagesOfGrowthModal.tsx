import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUpIcon, UsersIcon, UserIcon, BarChart3Icon } from "lucide-react";
import { useState } from "react";

interface StagesOfGrowthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StagesOfGrowthModal({ open, onOpenChange }: StagesOfGrowthModalProps) {
  const [selectedStage, setSelectedStage] = useState(4);

  const stagesData = {
    1: {
      stage: "Stage 1",
      theme: "Start-Up",
      totalStaff: "1-10",
      numManagers: "0", 
      numExecutives: "1",
      builderProtectorRatio: "4:1",
      threeGatesOfFocus: {
        first: "Profit",
        second: "People", 
        third: "Process"
      },
      modalities: {
        ceo: "Dominant",
        manager: "Supportive",
        staff: "Facilitative"
      },
      leadershipBlend: {
        visionary: "40%",
        manager: "10%",
        specialist: "50%"
      },
      primaryChallenge: "Cash Flow",
      secondaryChallenges: [
        "Destabilized by Chaos",
        "Slow Product Development & getting to market", 
        "Limited Capital to Grow",
        "Expand Sales"
      ],
      leadershipStyle: {
        primary: "Visionary",
        secondary: "Coaching", 
        auxiliary: "Commanding"
      }
    },
    2: {
      stage: "Stage 2",
      theme: "Ramp-Up",
      totalStaff: "11-19",
      numManagers: "1", 
      numExecutives: "1",
      builderProtectorRatio: "3:1",
      threeGatesOfFocus: {
        first: "Profit",
        second: "Process", 
        third: "People"
      },
      modalities: {
        ceo: "Dominant",
        manager: "Supportive",
        staff: "Facilitative"
      },
      leadershipBlend: {
        visionary: "40%",
        manager: "20%",
        specialist: "40%"
      },
      primaryChallenge: "Hiring Quality Staff",
      secondaryChallenges: [
        "Expand Sales",
        "Cash Flow",
        "Weak Business/Profit Design",
        "Leadership/Staff Communication Gap"
      ],
      leadershipStyle: {
        primary: "Coaching",
        secondary: "Pacesetting", 
        auxiliary: "Commanding"
      }
    },
    3: {
      stage: "Stage 3",
      theme: "Delegation",
      totalStaff: "20-34",
      numManagers: "3-5", 
      numExecutives: "1",
      builderProtectorRatio: "1:1",
      threeGatesOfFocus: {
        first: "People",
        second: "Profit", 
        third: "Process"
      },
      modalities: {
        ceo: "Facilitative",
        manager: "Supportive",
        staff: "Dominant"
      },
      leadershipBlend: {
        visionary: "10%",
        manager: "60%",
        specialist: "30%"
      },
      primaryChallenge: "Staff Buy-In",
      secondaryChallenges: [
        "Leadership/Staff Communication Difficulty",
        "Employee Turnover",
        "Unclear Culture Drivers",
        "Limited Capital to Grow"
      ],
      leadershipStyle: {
        primary: "Coaching",
        secondary: "Democratic", 
        auxiliary: "Pacesetting"
      }
    },
    4: {
      stage: "Stage 4",
      theme: "Professional",
      totalStaff: "35-57",
      numManagers: "6-10", 
      numExecutives: "2-3",
      builderProtectorRatio: "3:2",
      threeGatesOfFocus: {
        first: "Process",
        second: "Profit", 
        third: "People"
      },
      modalities: {
        ceo: "Facilitative",
        manager: "Dominant",
        staff: "Supportive"
      },
      leadershipBlend: {
        visionary: "10%",
        manager: "70%",
        specialist: "20%"
      },
      primaryChallenge: "Weak Project Management",
      secondaryChallenges: [
        "Diagnosing Problems",
        "Cost of Lost Expertise",
        "Systems Development",
        "Culture Resistant to Change"
      ],
      leadershipStyle: {
        primary: "Coaching",
        secondary: "Affiliative", 
        auxiliary: "Pacesetting"
      }
    },
    5: {
      stage: "Stage 5",
      theme: "Integration",
      totalStaff: "58-95",
      numManagers: "11-16", 
      numExecutives: "4-5",
      builderProtectorRatio: "2:1",
      threeGatesOfFocus: {
        first: "Profit",
        second: "People", 
        third: "Process"
      },
      modalities: {
        ceo: "Facilitative",
        manager: "Dominant",
        staff: "Supportive"
      },
      leadershipBlend: {
        visionary: "30%",
        manager: "60%",
        specialist: "10%"
      },
      primaryChallenge: "Expand Sales",
      secondaryChallenges: [
        "Difficulty Anticipating Problems",
        "New Staff Orientation",
        "Weak Business/Profit Design",
        "Organization Uninformed of Growth Plans"
      ],
      leadershipStyle: {
        primary: "Democratic",
        secondary: "Visionary", 
        auxiliary: "Affiliative"
      }
    },
    6: {
      stage: "Stage 6",
      theme: "Strategic",
      totalStaff: "96-160",
      numManagers: "17-26", 
      numExecutives: "6-8",
      builderProtectorRatio: "3:1",
      threeGatesOfFocus: {
        first: "People",
        second: "Profit", 
        third: "Process"
      },
      modalities: {
        ceo: "Dominant",
        manager: "Supportive",
        staff: "Facilitative"
      },
      leadershipBlend: {
        visionary: "45%",
        manager: "50%",
        specialist: "5%"
      },
      primaryChallenge: "Staff Buy-In",
      secondaryChallenges: [
        "Staff Satisfaction/Profit relationship not seen",
        "Staff Training",
        "Weak Business/Profit Design",
        "Hiring Quality Staff"
      ],
      leadershipStyle: {
        primary: "Affiliative",
        secondary: "Pacesetting", 
        auxiliary: "Visionary"
      }
    },
    7: {
      stage: "Stage 7",
      theme: "Visionary",
      totalStaff: "161-500",
      numManagers: "27-45", 
      numExecutives: "9-15",
      builderProtectorRatio: "2:1",
      threeGatesOfFocus: {
        first: "People",
        second: "Process", 
        third: "Profit"
      },
      modalities: {
        ceo: "Dominant",
        manager: "Facilitative",
        staff: "Supportive"
      },
      leadershipBlend: {
        visionary: "75%",
        manager: "20%",
        specialist: "5%"
      },
      primaryChallenge: "Products not Differentiated",
      secondaryChallenges: [
        "Inadequate Profits",
        "Slow Product Development & getting to market", 
        "Hiring Quality Staff",
        "Marketplace Changes too Quickly"
      ],
      leadershipStyle: {
        primary: "Visionary",
        secondary: "Coaching", 
        auxiliary: "Democratic"
      }
    }
  };

  const currentStageData = stagesData[selectedStage as keyof typeof stagesData];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
            <TrendingUpIcon className="w-6 h-6" />
            Stages of Growth - {currentStageData.stage} - {currentStageData.theme}
          </DialogTitle>
          <div className="flex gap-2 mt-3">
            {[1, 2, 3, 4, 5, 6].map((stage) => (
              <Button
                key={stage}
                size="sm"
                variant={selectedStage === stage ? "default" : "outline"}
                onClick={() => setSelectedStage(stage)}
                data-testid={`button-stage-${stage}`}
              >
                Stage {stage}
              </Button>
            ))}
            <Button
              size="sm"
              variant={selectedStage === 7 ? "default" : "outline"}
              onClick={() => setSelectedStage(7)}
              data-testid="button-stage-7"
            >
              Stage 7
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <UsersIcon className="w-5 h-5" />
                  Organization Size
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Staff:</span>
                  <Badge variant="secondary">
                    {currentStageData.totalStaff}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Managers:</span>
                  <Badge variant="secondary">
                    {currentStageData.numManagers}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Executives:</span>
                  <Badge variant="secondary">
                    {currentStageData.numExecutives}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <BarChart3Icon className="w-5 h-5" />
                  Leadership Blend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visionary:</span>
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700">
                    {currentStageData.leadershipBlend.visionary}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manager:</span>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
                    {currentStageData.leadershipBlend.manager}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Specialist:</span>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                    {currentStageData.leadershipBlend.specialist}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-foreground">
                  Builder-Protector Ratio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    {currentStageData.builderProtectorRatio}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Three Gates of Focus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">1st Priority</div>
                  <Badge variant="secondary">
                    {currentStageData.threeGatesOfFocus.first}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">2nd Priority</div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
                    {currentStageData.threeGatesOfFocus.second}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">3rd Priority</div>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                    {currentStageData.threeGatesOfFocus.third}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Organizational Modalities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">CEO Modality</div>
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700">
                    {currentStageData.modalities.ceo}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">Manager Modality</div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
                    {currentStageData.modalities.manager}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">Staff Modality</div>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                    {currentStageData.modalities.staff}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Primary Challenge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <Badge variant="destructive" className="text-lg px-4 py-2">
                  {currentStageData.primaryChallenge}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-2">Secondary Challenges:</div>
              <div className="flex flex-wrap gap-2">
                {currentStageData.secondaryChallenges.map((challenge: string, index: number) => (
                  <Badge key={index} variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700">
                    {challenge}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Leadership Style Focus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">Primary</div>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700">
                    {currentStageData.leadershipStyle.primary}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">Secondary</div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
                    {currentStageData.leadershipStyle.secondary}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">Auxiliary</div>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                    {currentStageData.leadershipStyle.auxiliary}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
