import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react";

interface ActionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "ghost" | "outline" | "default";
  testId?: string;
}

export function ActionMenu({
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
  className = "",
  size = "sm",
  variant = "ghost",
  testId
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`h-6 w-6 p-0 text-muted-foreground hover:text-foreground ${className}`}
          data-testid={testId}
        >
          <MoreHorizontalIcon className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            onEdit();
            setOpen(false);
          }}
          className="cursor-pointer"
        >
          <PencilIcon className="mr-2 h-4 w-4" />
          {editLabel}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            onDelete();
            setOpen(false);
          }}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <TrashIcon className="mr-2 h-4 w-4" />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
