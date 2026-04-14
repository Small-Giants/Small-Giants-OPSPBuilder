import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  UsersIcon, 
  BrainIcon, 
  TargetIcon, 
  RocketIcon,
  DollarSignIcon,
  HeartHandshakeIcon,
  SettingsIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircle2Icon,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, collection } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_COMPANY_ID = 'caliente';

interface ChecklistItem {
  itemId: string;
  text: string;
  score: number;
  category: string;
}

interface Category {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
  color: string;
}

export default function AgileGrowthChecklist() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['leadership']));
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const userId = user?.id || 'demo-user';

  // Fetch data from Firestore
  useEffect(() => {
    if (!userId) return;

    const checklistDocRef = doc(db, 'companies', DEFAULT_COMPANY_ID, 'users', userId, 'tools', 'agileChecklist');
    
    const unsubscribe = onSnapshot(checklistDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (data.items) {
          setChecklistItems(data.items);
        }
      } else {
        // Initialize with default items if not exists
        const defaultItems = getDefaultItems().flatMap(cat => 
          cat.items.map(item => ({
            category: cat.category,
            itemId: item.itemId,
            text: item.text,
            score: 0
          }))
        );
        // We don't automatically save it to DB yet to avoid junk data, 
        // or we could save it. Let's just set local state.
        setChecklistItems(defaultItems);
      }
      setIsLoading(false);
    }, (error) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to load checklist data",
        variant: "destructive"
      });
    });

    return () => unsubscribe();
  }, [userId, toast]);

  const getDefaultItems = () => {
    return [
      {
        category: 'leadership',
        items: [
          { itemId: 'l1', text: 'Each executive has written and shared a personal purpose plan.' },
          { itemId: 'l2', text: 'Each executive has conducted and shared a quarterly leadership health check in.' },
          { itemId: 'l3', text: 'The executive team has built strong trust, commitment, and accountability.' },
          { itemId: 'l4', text: 'The executive team regularly reviews strategy, execution, and results.' },
          { itemId: 'l5', text: 'The executive team participates in an aligned learning and implementation process.' }
        ]
      },
      {
        category: 'talent',
        items: [
          { itemId: 't1', text: "The organization's core purpose and culture drivers are clear, visible, and part of day-to-day operations." },
          { itemId: 't2', text: 'The organization has communicated a well-written concise vision to its key stakeholders.' },
          { itemId: 't3', text: 'The organization has identified the key attributes of an ideal team member used in recruiting, onboarding, and feedback systems.' },
          { itemId: 't4', text: 'The organization regularly assesses its overall talent profile, and discusses actions to reward, coach, and discipline members.' },
          { itemId: 't5', text: 'Every team member participates in learning, and is effectively coached by their manager, coach or mentor.' }
        ]
      },
      {
        category: 'strategy',
        items: [
          { itemId: 's1', text: "A map of the competitive landscape is current, and visually shows the organization's key differentiators." },
          { itemId: 's2', text: 'A map of key activities shows the alignment of operational systems, processes, and sub-activities.' },
          { itemId: 's3', text: "The organization's core economic engine is clearly identified, and measures the profit delivery units to successfully scale." },
          { itemId: 's4', text: "The organization's 10+ year and 3-year qualitative and quantitative targets have been identified, and made visible to internal constituents." },
          { itemId: 's5', text: 'The organization maintains a current Strengths, Weaknesses, Opportunities and Threat (SWOT) matrix, with input from top talent at all levels of the organization.' }
        ]
      },
      {
        category: 'execution',
        items: [
          { itemId: 'e1', text: 'The executive team and key managers meet annually to determine the single most important metric to drive organizational success.' },
          { itemId: 'e2', text: 'The executive team and key managers meet annually and quarterly to set 3-5 strategic objectives that drive the critical metric, culture, and profit.' },
          { itemId: 'e3', text: 'Every leader, manager and key contributor in the organization has a 13-week sprint plan to execute their personal strategic objectives each week.' },
          { itemId: 'e4', text: 'The organization has a clear and visible communication flow to include quarterly team meetings, monthly briefings, weekly leadership meetings, daily huddles, and key metrics (KPIs).' },
          { itemId: 'e5', text: 'Working teams solve business problems using collective intelligence, participation, measurement, fun, and rewards.' }
        ]
      },
      {
        category: 'cash',
        items: [
          { itemId: 'c1', text: 'The cash conversion cycle is visually constructed and optimized by all key contributors throughout the organization.' },
          { itemId: 'c2', text: 'Internal cash flow and profit are regularly measured and systematically optimized.' },
          { itemId: 'c3', text: 'The cost and efficiency of labor is understood, measured, and optimized on an ongoing basis.' },
          { itemId: 'c4', text: 'The organization understands which products are profitable, marginal, and unprofitable, and how to create recurring revenue.' },
          { itemId: 'c5', text: 'The organization has a well-developed pricing strategy that aligns with their market position, and drives regular price increases.' }
        ]
      },
      {
        category: 'customer',
        items: [
          { itemId: 'cu1', text: "The organization's strategy has generated the ideal core customer profile with a compelling, measurable value proposition (promise)." },
          { itemId: 'cu2', text: "The organization's brand has been carefully created in a compelling story format, and elicits action by prospective core customers." },
          { itemId: 'cu3', text: 'The organization leverages the power of content generation to strengthen its market position, attracting customer and media attention.' },
          { itemId: 'cu4', text: 'The customer acquisition-to-referral lifecycle has been defined and systematized to generate maximum profit and minimum cost(s).' },
          { itemId: 'cu5', text: 'The customer experience has been designed, optimized, and yields industry-leading retention, referrals, and testimonials.' }
        ]
      },
      {
        category: 'systems',
        items: [
          { itemId: 'sy1', text: 'The organization leverages systems thinking for driving change, technology investment, and process improvement for a differentiated customer experience.' },
          { itemId: 'sy2', text: 'Key processes in each of the 7 Attributes have been visually mapped and optimized with accountable leadership assigned.' },
          { itemId: 'sy3', text: 'The organization has created an agile culture of continuous improvement with a defined change management process, providing the ability to quickly adapt to changing conditions.' },
          { itemId: 'sy4', text: 'A technology roadmap ensures strategic investment to systematize processes, automate labor-intensive tasks, and maximize profits.' },
          { itemId: 'sy5', text: 'The organization prioritizes their innovation process to remain relevant and create future opportunities.' }
        ]
      }
    ];
  };

  const handleScoreChange = async (itemId: string, newScore: string) => {
    const score = parseInt(newScore);
    if (score >= 1 && score <= 5) {
      const updatedItems = checklistItems.map(item => 
        item.itemId === itemId ? { ...item, score } : item
      );
      
      // Optimistic update
      setChecklistItems(updatedItems);

      // Save to Firestore
      try {
        const checklistDocRef = doc(db, 'companies', DEFAULT_COMPANY_ID, 'users', userId, 'tools', 'agileChecklist');
        await setDoc(checklistDocRef, { items: updatedItems }, { merge: true });
        
        toast({
          description: "Score updated",
          duration: 1000
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save score",
          variant: "destructive"
        });
      }
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const buildCategories = (): Category[] => {
    const categoryMetadata = {
      leadership: {
        title: 'Leadership',
        description: 'The Executive leadership team is authentic, healthy, and aligned.',
        icon: <UsersIcon className="w-5 h-5" />,
        color: 'text-purple-500'
      },
      talent: {
        title: 'Talent',
        description: 'Leaders and managers relentlessly pursue a culture of trust, results, and accountability.',
        icon: <BrainIcon className="w-5 h-5" />,
        color: 'text-blue-500'
      },
      strategy: {
        title: 'Strategy',
        description: "The organization's strategy provides a unique and valuable position in the market, and can be stated in one phrase.",
        icon: <TargetIcon className="w-5 h-5" />,
        color: 'text-primary'
      },
      execution: {
        title: 'Execution',
        description: 'The organization has annual, quarterly, and personal strategic objectives that are visible, measured, and activated with a 13-week sprint.',
        icon: <RocketIcon className="w-5 h-5" />,
        color: 'text-orange-500'
      },
      cash: {
        title: 'Cash',
        description: 'The organization has optimized cash flow, and understands the forces and levers in their control to increase profit and cash.',
        icon: <DollarSignIcon className="w-5 h-5" />,
        color: 'text-green-500'
      },
      customer: {
        title: 'Customer',
        description: 'The organization has defined the core customer, crafted a compelling promise, and systematized the customer lifecycle.',
        icon: <HeartHandshakeIcon className="w-5 h-5" />,
        color: 'text-pink-500'
      },
      systems: {
        title: 'Systems',
        description: 'The organization has a system to optimize core processes, change management, decision-making, and technology use.',
        icon: <SettingsIcon className="w-5 h-5" />,
        color: 'text-amber-500'
      }
    };

    const groupedItems = checklistItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, ChecklistItem[]>);

    return Object.entries(categoryMetadata).map(([id, meta]) => ({
      id,
      ...meta,
      items: groupedItems[id] || []
    }));
  };

  const categories = buildCategories();

  const getCategoryProgress = (category: Category) => {
    const scoredItems = category.items.filter(item => item.score > 0);
    const averageScore = scoredItems.length > 0 
      ? scoredItems.reduce((sum, item) => sum + item.score, 0) / scoredItems.length 
      : 0;
    return {
      scored: scoredItems.length,
      total: category.items.length,
      average: averageScore,
      percentage: averageScore * 20
    };
  };

  const getTotalProgress = () => {
    if (checklistItems.length === 0) {
      return { scored: 0, total: 0, average: 0, percentage: 0 };
    }
    const scoredItems = checklistItems.filter(item => item.score > 0);
    const averageScore = scoredItems.length > 0 
      ? scoredItems.reduce((sum, item) => sum + item.score, 0) / scoredItems.length 
      : 0;
    return {
      scored: scoredItems.length,
      total: checklistItems.length,
      average: averageScore,
      percentage: averageScore * 20
    };
  };

  const totalProgress = getTotalProgress();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            The 7 Attributes of Agile Growth Checklist©
          </h1>
          <p className="text-muted-foreground">
            Assess your organization's agility across seven key dimensions
          </p>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2Icon className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Overall Progress</p>
                  <p className="text-2xl font-bold text-foreground">
                    {totalProgress.average.toFixed(1)} / 5.0
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">
                  {totalProgress.percentage.toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
            </div>
            <Progress value={totalProgress.percentage} className="h-3" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {categories.map(category => {
          const progress = getCategoryProgress(category);
          const isExpanded = expandedCategories.has(category.id);

          return (
            <Card 
              key={category.id}
              className="hover:border-border/80 transition-all"
            >
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`${category.color}`}>
                      {category.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-foreground">{category.title}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            progress.average >= 4 
                              ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' 
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {progress.average.toFixed(1)}/5.0
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress 
                      value={progress.percentage} 
                      className={`w-24 h-2 ${
                        progress.percentage === 100 ? '[&>div]:bg-green-500' : ''
                      }`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(category.id);
                      }}
                      aria-label={isExpanded ? `Collapse ${category.title}` : `Expand ${category.title}`}
                      aria-expanded={isExpanded}
                      data-testid={`button-toggle-${category.id}`}
                    >
                      {isExpanded ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="pt-2 pb-6">
                  <div className="space-y-3 mb-4">
                    {category.items.map((item, index) => (
                      <div 
                        key={item.itemId}
                        className="flex items-start gap-3 group hover:bg-muted/50 p-2 rounded-md transition-colors"
                      >
                        <Select
                          value={item.score > 0 ? item.score.toString() : ""}
                          onValueChange={(value) => handleScoreChange(item.itemId, value)}
                        >
                          <SelectTrigger 
                            className="w-20 h-8"
                            data-testid={`score-selector-${item.itemId}`}
                          >
                            <SelectValue placeholder="Score" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="5">5</SelectItem>
                          </SelectContent>
                        </Select>
                        <label
                          htmlFor={item.itemId}
                          className={`text-sm cursor-pointer flex-1 leading-relaxed transition-all ${
                            item.score > 0 
                              ? 'text-muted-foreground' 
                              : 'text-foreground'
                          }`}
                        >
                          <span className="text-muted-foreground mr-2">{index + 1}.</span>
                          {item.text}
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">
          © 7 Attributes™ Tools - For use by active 7 Attributes™ Certified Coaches
        </p>
      </div>
    </div>
  );
}
