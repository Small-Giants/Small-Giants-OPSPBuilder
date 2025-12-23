import { useState } from "react";
import OpspCanvas from '../OpspCanvas';

export default function OpspCanvasExample() {
  //todo: remove mock functionality
  const [sections, setSections] = useState([
    {
      id: "core-purpose",
      title: "Core Purpose",
      content: "To empower organizations with strategic clarity and execution excellence",
      type: "text" as const
    },
    {
      id: "core-values",
      title: "Culture Drivers",
      content: "",
      type: "list" as const,
      items: ["Transparency", "Innovation", "Excellence", "Collaboration"]
    },
    {
      id: "strategy",
      title: "One-Phrase Strategy",
      content: "Transform strategy into execution through interactive planning",
      type: "text" as const
    },
    {
      id: "differentiators",
      title: "3-5 Differentiators",
      content: "",
      type: "list" as const,
      items: ["Real-time collaboration", "Assessment integration", "Executive dashboards"]
    },
    {
      id: "targets",
      title: "3-Year Targets",
      content: "",
      type: "metrics" as const,
      items: ["Revenue: $10M", "Users: 50K", "NPS: 70+"]
    },
    {
      id: "priorities",
      title: "Annual Priorities",
      content: "",
      type: "list" as const,
      items: ["Launch MVP", "Secure Series A", "Build enterprise features"]
    }
  ]);

  const handleSectionUpdate = (sectionId: string, content: string | string[]) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { 
            ...section, 
            content: typeof content === 'string' ? content : section.content,
            items: Array.isArray(content) ? content : section.items 
          }
        : section
    ));
  };

  return (
    <OpspCanvas 
      sections={sections}
      onSectionUpdate={handleSectionUpdate}
    />
  );
}