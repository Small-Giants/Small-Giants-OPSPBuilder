import { useState } from "react";
import LerPowerSection from '../LerPowerSection';

export default function LerPowerSectionExample() {
  //todo: remove mock functionality
  const [lerData, setLerData] = useState({
    grossProfit: 500000,
    laborCost: 200000,
    ratio: 2.5
  });

  const [powerOfOne, setPowerOfOne] = useState({
    lever: "Customer Acquisition Cost",
    goal: "Reduce by 25% in Q1"
  });

  const handleLerUpdate = (data: typeof lerData) => {
    console.log('LER updated:', data);
    setLerData(data);
  };

  const handlePowerUpdate = (data: typeof powerOfOne) => {
    console.log('Power of One updated:', data);
    setPowerOfOne(data);
  };

  return (
    <div className="p-6 bg-muted">
      <LerPowerSection
        lerData={lerData}
        powerOfOne={powerOfOne}
        onLerUpdate={handleLerUpdate}
        onPowerUpdate={handlePowerUpdate}
      />
    </div>
  );
}