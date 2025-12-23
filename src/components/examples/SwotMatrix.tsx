import { useState } from "react";
import SwotMatrix from '../SwotMatrix';

export default function SwotMatrixExample() {
  //todo: remove mock functionality
  const [swotData, setSwotData] = useState({
    strengths: [
      { id: "s1", text: "Strong technical team" },
      { id: "s2", text: "Proven track record" },
      { id: "s3", text: "Innovative product approach" }
    ],
    weaknesses: [
      { id: "w1", text: "Limited marketing budget" },
      { id: "w2", text: "Small customer base" }
    ],
    opportunities: [
      { id: "o1", text: "Growing market demand" },
      { id: "o2", text: "Partnership possibilities" },
      { id: "o3", text: "Digital transformation trend" }
    ],
    threats: [
      { id: "t1", text: "Established competitors" },
      { id: "t2", text: "Economic uncertainty" }
    ]
  });

  const handleUpdate = (newData: typeof swotData) => {
    setSwotData(newData);
  };

  return (
    <div className="p-6">
      <SwotMatrix data={swotData} onUpdate={handleUpdate} />
    </div>
  );
}