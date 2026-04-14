"use client";

import * as React from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CommandSeparator,
} from "@/components/ui/command";
import { useActiveUsers, type ActiveUser } from "@/hooks/use-active-users";

type ValueMode = "id" | "name";

interface UserComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  valueMode?: ValueMode;
  className?: string;
  triggerClassName?: string;
}

export function UserCombobox({
  value,
  onValueChange,
  placeholder = "Select person...",
  valueMode = "id",
  className,
  triggerClassName,
}: UserComboboxProps) {
  const { users } = useActiveUsers();
  const [open, setOpen] = React.useState(false);
  const [customMode, setCustomMode] = React.useState(false);
  const [customName, setCustomName] = React.useState("");

  const displayValue = React.useMemo(() => {
    if (!value || value === "unassigned") return "";
    if (valueMode === "id") {
      const user = users.find((u) => u.id === value);
      return user ? user.name || user.email || value : value;
    }
    return value;
  }, [value, users, valueMode]);

  const handleSelect = (selectedValue: string, user?: ActiveUser) => {
    if (valueMode === "id") {
      onValueChange(selectedValue);
    } else {
      onValueChange(user ? user.name || user.email || "" : selectedValue);
    }
    setOpen(false);
    setCustomMode(false);
  };

  const handleCustomSubmit = () => {
    const trimmed = customName.trim();
    if (trimmed) {
      onValueChange(trimmed);
      setCustomName("");
      setCustomMode(false);
      setOpen(false);
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCustomSubmit();
    }
    if (e.key === "Escape") {
      setCustomMode(false);
    }
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
          <span className="truncate">
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", className)} align="start">
        {customMode ? (
          <div className="p-3 space-y-2">
            <p className="text-sm font-medium">Enter a name</p>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              placeholder="Type a name..."
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCustomSubmit} className="flex-1">
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCustomMode(false)}
                className="flex-1"
              >
                Back
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Search people..." />
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__unassigned__"
                  onSelect={() => handleSelect("")}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value || value === "unassigned"
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  Unassigned
                </CommandItem>
                {users.map((user) => {
                  const matchValue =
                    valueMode === "id"
                      ? user.id
                      : user.name || user.email || "";
                  return (
                    <CommandItem
                      key={user.id}
                      value={user.name || user.email || user.id}
                      onSelect={() => handleSelect(matchValue, user)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === matchValue ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {user.name || user.email}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => setCustomMode(true)}
                  className="text-muted-foreground"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Type a custom name...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
