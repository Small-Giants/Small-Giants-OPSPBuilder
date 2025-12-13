import { useState } from "react";
import AssessmentCard from '../AssessmentCard';

export default function AssessmentCardExample() {
  //todo: remove mock functionality
  const [assessmentItems, setAssessmentItems] = useState([
    { id: "trust", question: "Team members trust each other", score: 4 },
    { id: "conflict", question: "Team engages in productive conflict", score: 3 },
    { id: "commitment", question: "Team commits to decisions", score: 4 },
    { id: "accountability", question: "Team holds each other accountable", score: 3 },
    { id: "results", question: "Team focuses on collective results", score: 5 }
  ]);

  const averageScore = assessmentItems.reduce((sum, item) => sum + item.score, 0) / assessmentItems.length;

  const handleScoreChange = (itemId: string, score: number) => {
    console.log(`Score changed for ${itemId}: ${score}`);
    setAssessmentItems(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, score } : item
      )
    );
  };

  const handleSubmit = () => {
    console.log('Assessment submitted:', assessmentItems);
  };

  return (
    <div className="p-6">
      <AssessmentCard
        title="Team Dysfunction Assessment"
        description="Evaluate your team's effectiveness across the five dysfunctions"
        items={assessmentItems}
        averageScore={averageScore}
        previousScore={3.2}
        onScoreChange={handleScoreChange}
        onSubmit={handleSubmit}
      />
    </div>
  );
}