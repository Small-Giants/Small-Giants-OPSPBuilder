import ScalabilityRoadmap from './ScalabilityRoadmap';

interface OpspCanvasProps {
  sections?: any;
  onSectionUpdate?: (sectionId: string, content: string | string[]) => void;
  data?: any;
  onUpdate?: (data: any) => void;
}

export default function OpspCanvas({ sections, onSectionUpdate, data, onUpdate }: OpspCanvasProps) {
  // This is now a read-only rollup view of the Scalability Roadmap
  return <ScalabilityRoadmap data={data} />;
}