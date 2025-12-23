import { useState } from "react";
import PriorityTracker from '../PriorityTracker';

export default function PriorityTrackerExample() {
  //todo: remove mock functionality
  const [priorities, setPriorities] = useState([
    {
      id: "p1",
      title: "Launch MVP Platform",
      description: "Complete development and launch of the initial OPSP platform",
      owner: "Engineering Team",
      dueDate: "2025-06-30",
      status: 'in-progress' as const,
      progress: 65,
      evidence: "Demo environment live at demo.opsp.com",
      subPriorities: [
        { id: "sp1", title: "Complete user authentication", completed: true },
        { id: "sp2", title: "Build OPSP canvas", completed: true },
        { id: "sp3", title: "Implement assessments", completed: false },
        { id: "sp4", title: "Add export functionality", completed: false }
      ]
    },
    {
      id: "p2",
      title: "Secure Series A Funding",
      description: "Raise $5M Series A to accelerate growth and product development",
      owner: "CEO",
      dueDate: "2025-09-15",
      status: 'not-started' as const,
      progress: 20,
      evidence: "",
      subPriorities: [
        { id: "sp5", title: "Prepare pitch deck", completed: true },
        { id: "sp6", title: "Identify target investors", completed: false },
        { id: "sp7", title: "Complete due diligence", completed: false }
      ]
    },
    {
      id: "p3",
      title: "Build Enterprise Features",
      description: "Develop advanced features for enterprise customers",
      owner: "Product Team",
      dueDate: "2025-12-31",
      status: 'not-started' as const,
      progress: 0,
      evidence: "",
      subPriorities: []
    }
  ]);

  const handlePriorityUpdate = (updatedPriority: typeof priorities[0]) => {
    setPriorities(prev => 
      prev.map(p => p.id === updatedPriority.id ? updatedPriority : p)
    );
  };

  const handleAddPriority = (newPriority: Omit<typeof priorities[0], 'id'>) => {
    const priority = {
      ...newPriority,
      id: `p${Date.now()}`
    };
    setPriorities(prev => [...prev, priority]);
  };

  return (
    <div className="p-6">
      <PriorityTracker
        priorities={priorities}
        onPriorityUpdate={handlePriorityUpdate}
        onAddPriority={handleAddPriority}
      />
    </div>
  );
}