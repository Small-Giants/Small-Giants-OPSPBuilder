import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEditMode } from "@/contexts/EditModeContext";
import { GripVertical } from "lucide-react";
import { ReactNode } from "react";

interface ResizableCardProps {
  children: ReactNode;
  cardId: string;
  width: number; // 1 (full), 2 (half), 3 (third), 4 (quarter)
  onWidthChange: (cardId: string, newWidth: number) => void;
  className?: string;
  isDragging?: boolean;
}

// Map width values to Tailwind column span classes (12-column grid)
const widthToColSpan: Record<number, string> = {
  1: 'col-span-12',      // Full width
  2: 'col-span-6',       // Half width
  3: 'col-span-4',       // Third width
  4: 'col-span-3',       // Quarter width
};

const widthLabels: Record<number, string> = {
  1: '1/1',
  2: '1/2',
  3: '1/3',
  4: '1/4',
};

export function ResizableCard({
  children,
  cardId,
  width,
  onWidthChange,
  className = '',
  isDragging = false
}: ResizableCardProps) {
  const { isEditMode } = useEditMode();

  const colSpanClass = widthToColSpan[width] || widthToColSpan[1];

  return (
    <div 
      className={`${colSpanClass} ${isDragging ? 'opacity-50' : ''}`}
      data-card-id={cardId}
    >
      {isEditMode && (
        <div className="mb-2 flex items-center gap-2 justify-between bg-muted p-2 rounded-md border border-border">
          <div className="flex items-center gap-1 cursor-grab" data-testid={`drag-handle-${cardId}`}>
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Drag to reorder</span>
          </div>
          
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Width:</span>
            {[1, 2, 3, 4].map((w) => (
              <Button
                key={w}
                size="sm"
                variant={width === w ? "default" : "outline"}
                onClick={() => onWidthChange(cardId, w)}
                className="h-7 px-2 text-xs"
                data-testid={`resize-${cardId}-${widthLabels[w]}`}
              >
                {widthLabels[w]}
              </Button>
            ))}
          </div>
        </div>
      )}
      
      <div className={className}>
        {children}
      </div>
    </div>
  );
}
