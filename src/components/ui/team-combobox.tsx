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
import { useTeams } from "@/hooks/use-teams";

interface TeamComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowUnassigned?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function TeamCombobox({
  value,
  onValueChange,
  placeholder = "Select team...",
  allowUnassigned = true,
  className,
  triggerClassName,
}: TeamComboboxProps) {
  const { teams } = useTeams();
  const [open, setOpen] = React.useState(false);

  const displayValue = React.useMemo(() => {
    if (!value) return "";
    return teams.find((d) => d.id === value)?.name ?? "";
  }, [value, teams]);

  const handleSelect = (teamId: string) => {
    onValueChange(teamId);
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
          <CommandInput placeholder="Search teams..." />
          <CommandList>
            <CommandEmpty>No teams found.</CommandEmpty>
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
              {teams.map((team) => (
                <CommandItem
                  key={team.id}
                  value={team.name}
                  onSelect={() => handleSelect(team.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === team.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {team.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
