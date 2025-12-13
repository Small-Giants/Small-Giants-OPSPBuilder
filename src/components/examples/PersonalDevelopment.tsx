import { useState } from "react";
import PersonalDevelopment from '../PersonalDevelopment';

export default function PersonalDevelopmentExample() {
  //todo: remove mock functionality
  const [learning, setLearning] = useState([
    { id: "l1", title: "Scaling Up by Verne Harnish", type: 'book' as const, completed: true },
    { id: "l2", title: "Strategic Leadership Course", type: 'course' as const, completed: false },
    { id: "l3", title: "OKR Implementation Workshop", type: 'video' as const, completed: false }
  ]);

  const [development, setDevelopment] = useState([
    { id: "d1", title: "Public Speaking", type: 'skill' as const, progress: 65 },
    { id: "d2", title: "Daily Morning Meditation", type: 'habit' as const, progress: 80 },
    { id: "d3", title: "International Conference Speaking", type: 'experience' as const, progress: 25 }
  ]);

  const handleLearningUpdate = (items: typeof learning) => {
    console.log('Learning updated:', items);
    setLearning(items);
  };

  const handleDevelopmentUpdate = (items: typeof development) => {
    console.log('Development updated:', items);
    setDevelopment(items);
  };

  return (
    <div className="p-6 bg-muted">
      <PersonalDevelopment
        learning={learning}
        development={development}
        onLearningUpdate={handleLearningUpdate}
        onDevelopmentUpdate={handleDevelopmentUpdate}
      />
    </div>
  );
}