import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpenIcon, VideoIcon, AwardIcon, SparklesIcon, PlusIcon, XIcon, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_COMPANY_ID = "default-company";

interface LearningItem {
  id: string;
  title: string;
  type: 'book' | 'video' | 'course';
  completed: boolean;
}

interface DevelopmentItem {
  id: string;
  title: string;
  type: 'skill' | 'habit' | 'experience';
  progress: number;
}

interface PersonalDevelopmentProps {
  learning?: LearningItem[];
  development?: DevelopmentItem[];
  onLearningUpdate?: (items: LearningItem[]) => void;
  onDevelopmentUpdate?: (items: DevelopmentItem[]) => void;
}

export default function PersonalDevelopment({ }: PersonalDevelopmentProps) {
  const { toast } = useToast();
  const [learning, setLearning] = useState<LearningItem[]>([]);
  const [development, setDevelopment] = useState<DevelopmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [newLearningTitle, setNewLearningTitle] = useState("");
  const [newLearningType, setNewLearningType] = useState<LearningItem['type']>('book');
  const [newDevTitle, setNewDevTitle] = useState("");
  const [newDevType, setNewDevType] = useState<DevelopmentItem['type']>('skill');

  useEffect(() => {
    const docRef = doc(db, 'companies', DEFAULT_COMPANY_ID, 'personal-development', 'data');
    const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setLearning(data.learning || []);
        setDevelopment(data.development || []);
      } else {
        setLearning([]);
        setDevelopment([]);
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const saveData = async (newLearning: LearningItem[], newDevelopment: DevelopmentItem[]) => {
    try {
      const docRef = doc(db, 'companies', DEFAULT_COMPANY_ID, 'personal-development', 'data');
      await setDoc(docRef, {
        learning: newLearning,
        development: newDevelopment
      }, { merge: true });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save data",
        variant: "destructive"
      });
    }
  };

  const addLearning = async () => {
    if (!newLearningTitle.trim()) return;
    const newItem: LearningItem = {
      id: `l_${Date.now()}`,
      title: newLearningTitle,
      type: newLearningType,
      completed: false
    };
    const newLearning = [...learning, newItem];
    setLearning(newLearning); // Optimistic
    setNewLearningTitle("");
    await saveData(newLearning, development);
  };

  const toggleLearning = async (id: string) => {
    const newLearning = learning.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setLearning(newLearning); // Optimistic
    await saveData(newLearning, development);
  };

  const removeLearning = async (id: string) => {
    const newLearning = learning.filter(item => item.id !== id);
    setLearning(newLearning); // Optimistic
    await saveData(newLearning, development);
  };

  const addDevelopment = async () => {
    if (!newDevTitle.trim()) return;
    const newItem: DevelopmentItem = {
      id: `d_${Date.now()}`,
      title: newDevTitle,
      type: newDevType,
      progress: 0
    };
    const newDevelopment = [...development, newItem];
    setDevelopment(newDevelopment); // Optimistic
    setNewDevTitle("");
    await saveData(learning, newDevelopment);
  };

  const updateProgress = async (id: string, progress: number) => {
    const newDevelopment = development.map(item => 
      item.id === id ? { ...item, progress } : item
    );
    setDevelopment(newDevelopment); // Optimistic
    await saveData(learning, newDevelopment);
  };

  const removeDevelopment = async (id: string) => {
    const newDevelopment = development.filter(item => item.id !== id);
    setDevelopment(newDevelopment); // Optimistic
    await saveData(learning, newDevelopment);
  };

  const getTypeIcon = (type: LearningItem['type']) => {
    switch (type) {
      case 'book': return <BookOpenIcon className="w-3 h-3" />;
      case 'video': return <VideoIcon className="w-3 h-3" />;
      case 'course': return <AwardIcon className="w-3 h-3" />;
    }
  };

  const getDevTypeColor = (type: DevelopmentItem['type']) => {
    switch (type) {
      case 'skill': return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700';
      case 'habit': return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700';
      case 'experience': return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700';
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="hover-elevate">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary" />
            Personal Learning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {learning.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border hover:border-border/80 transition-all"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => toggleLearning(item.id)}
                  className="rounded border-border bg-background"
                  data-testid={`checkbox-learning-${item.id}`}
                />
                <div className="flex items-center gap-1 text-primary">
                  {getTypeIcon(item.type)}
                </div>
                <span className={`flex-1 text-sm ${
                  item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                }`}>
                  {item.title}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeLearning(item.id)}
                  className="h-6 w-6 p-0"
                  data-testid={`button-remove-learning-${item.id}`}
                >
                  <XIcon className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newLearningTitle}
              onChange={(e) => setNewLearningTitle(e.target.value)}
              placeholder="Add learning item"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addLearning()}
              data-testid="input-new-learning"
            />
            <select
              value={newLearningType}
              onChange={(e) => setNewLearningType(e.target.value as LearningItem['type'])}
              className="px-3 py-2 bg-background border border-border text-foreground rounded-md"
              data-testid="select-learning-type"
            >
              <option value="book">Book</option>
              <option value="video">Video</option>
              <option value="course">Course</option>
            </select>
            <Button
              onClick={addLearning}
              size="sm"
              data-testid="button-add-learning"
            >
              <PlusIcon className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="hover-elevate">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <AwardIcon className="w-5 h-5 text-primary" />
            Personal Development
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {development.map((item) => (
              <div 
                key={item.id} 
                className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border hover:border-border/80 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{item.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge className={getDevTypeColor(item.type)}>
                      {item.type}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDevelopment(item.id)}
                      className="h-6 w-6 p-0"
                      data-testid={`button-remove-dev-${item.id}`}
                    >
                      <XIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    value={item.progress}
                    onChange={(e) => updateProgress(item.id, Number(e.target.value))}
                    min="0"
                    max="100"
                    className="flex-1"
                    data-testid={`slider-progress-${item.id}`}
                  />
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {item.progress}%
                  </span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newDevTitle}
              onChange={(e) => setNewDevTitle(e.target.value)}
              placeholder="Add development goal"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addDevelopment()}
              data-testid="input-new-development"
            />
            <select
              value={newDevType}
              onChange={(e) => setNewDevType(e.target.value as DevelopmentItem['type'])}
              className="px-3 py-2 bg-background border border-border text-foreground rounded-md"
              data-testid="select-dev-type"
            >
              <option value="skill">Skill</option>
              <option value="habit">Habit</option>
              <option value="experience">Experience</option>
            </select>
            <Button
              onClick={addDevelopment}
              size="sm"
              data-testid="button-add-development"
            >
              <PlusIcon className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
