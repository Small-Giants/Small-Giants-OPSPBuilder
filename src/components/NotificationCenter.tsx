"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/use-notifications";
import type { AppNotification, NotificationKind } from "@/types";
import {
  AlertTriangle,
  BellIcon,
  CalendarClock,
  CheckCircle2,
  MailOpen,
  RefreshCw,
  TargetIcon,
  UserPlus,
  X,
} from "lucide-react";

const KIND_ICONS: Record<NotificationKind, React.ReactNode> = {
  goal_assigned: <TargetIcon className="w-4 h-4 text-primary" />,
  contributor_added: <UserPlus className="w-4 h-4 text-primary" />,
  goal_at_risk: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  goal_completed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  quarter_due_soon: <CalendarClock className="w-4 h-4 text-amber-600" />,
  quarter_updated: <RefreshCw className="w-4 h-4 text-muted-foreground" />,
  sync_failed: <AlertTriangle className="w-4 h-4 text-destructive" />,
  weekly_digest: <MailOpen className="w-4 h-4 text-muted-foreground" />,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

interface NotificationCenterProps {
  onNavigate: (view: string) => void;
}

export default function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { notifications, unreadCount, markRead, markAllRead, dismiss } =
    useNotifications();
  const [open, setOpen] = useState(false);

  const handleOpen = (notification: AppNotification) => {
    if (!notification.read) void markRead(notification.id);
    onNavigate(notification.view);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <BellIcon className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing here yet. Goal assignments, check-in reminders, and at-risk
              flags will show up in this list.
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 ${
                    notification.read ? "" : "bg-primary/5"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {KIND_ICONS[notification.kind] ?? (
                      <BellIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpen(notification)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {notification.body}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {relativeTime(notification.createdAt)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void dismiss(notification.id)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => {
              onNavigate("notification-settings");
              setOpen(false);
            }}
          >
            Notification settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
