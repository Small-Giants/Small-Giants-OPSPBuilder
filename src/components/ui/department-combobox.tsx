"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDepartments } from "@/hooks/use-departments";

interface DepartmentComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowUnassigned?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function DepartmentCombobox({
  value,
  onValueChange,
  placeholder = "Select department...",
  allowUnassigned = true,
  className,
  triggerClassName,
}: DepartmentComboboxProps) {
  const { departments } = useDepartments();
  const [open, setOpen] = React.useState(false);

  const displayValue = React.useMemo(() => {
    if (!value) return "";
    return departments.find((d) => d.id === value)?.name ?? "";
  }, [value, departments]);

  const handleSelect = (departmentId: string) => {
    onValueChange(departmentId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !displayValue && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">{displayValue || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", className)} align="start">
        <Command>
          <CommandInput placeholder="Search departments..." />
          <CommandList>
            <CommandEmpty>No departments found.</CommandEmpty>
            <CommandGroup>
              {allowUnassigned && (
                <CommandItem value="__unassigned__" onSelect={() => handleSelect("")}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Unassigned
                </CommandItem>
              )}
              {departments.map((department) => (
                <CommandItem
                  key={department.id}
                  value={department.name}
                  onSelect={() => handleSelect(department.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === department.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {department.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
