import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react";

interface AssessmentItem {
  id: string;
  question: string;
  score: number;
}

interface AssessmentCardProps {
  title: string;
  description: string;
  items: AssessmentItem[];
  averageScore: number;
  previousScore?: number;
  onScoreChange: (itemId: string, score: number) => void;
  onSubmit: () => void;
}

export default function AssessmentCard({ 
  title, 
  description, 
  items, 
  averageScore, 
  previousScore,
  onScoreChange, 
  onSubmit 
}: AssessmentCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const getTrendIcon = () => {
    if (!previousScore) return <MinusIcon className="w-4 h-4" />;
    if (averageScore > previousScore) return <TrendingUpIcon className="w-4 h-4 text-green-600" />;
    if (averageScore < previousScore) return <TrendingDownIcon className="w-4 h-4 text-red-600" />;
    return <MinusIcon className="w-4 h-4" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return "bg-green-500";
    if (score >= 3) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card className="w-full max-w-2xl" data-testid={`card-assessment-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`${getScoreColor(averageScore)} text-white`}
            >
              {averageScore.toFixed(1)}
            </Badge>
            {getTrendIcon()}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {items.map((item) => (
          <div key={item.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                {item.question}
              </label>
              <Badge variant="outline" data-testid={`score-${item.id}`}>
                {item.score}
              </Badge>
            </div>
            
            {isEditing ? (
              <div className="px-3">
                <Slider
                  value={[item.score]}
                  onValueChange={(value) => onScoreChange(item.id, value[0])}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                  data-testid={`slider-${item.id}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1 - Poor</span>
                  <span>3 - Good</span>
                  <span>5 - Excellent</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getScoreColor(item.score)}`}
                    style={{ width: `${(item.score / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8">
                  {item.score}/5
                </span>
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-4 border-t">
          {isEditing ? (
            <>
              <Button 
                onClick={() => {
                  onSubmit();
                  setIsEditing(false);
                }}
                className="flex-1"
                data-testid="button-save-assessment"
              >
                Save Assessment
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(false)}
                data-testid="button-cancel-assessment"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setIsEditing(true)} 
              variant="outline" 
              className="flex-1"
              data-testid="button-edit-assessment"
            >
              Update Scores
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}