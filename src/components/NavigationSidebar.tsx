import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  HomeIcon,
  TargetIcon,
  BarChart3Icon, 
  ClipboardListIcon, 
  TrendingUpIcon,
  FileTextIcon,
  SettingsIcon,
  HelpCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  ActivityIcon,
  BookOpenIcon,
  BuildingIcon,
  CalendarIcon,
  Clock3Icon,
  ShieldIcon,
  MailIcon,
  CopyIcon,
  LogOutIcon,
  UsersIcon
} from "lucide-react";

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

interface NavigationSidebarProps {
  currentUser?: {
    name: string;
    email: string;
    avatar?: string;
    role: string;
  };
  activeItemId: string;
  onNavigate: (itemId: string) => void;
  onLogout?: () => void;
}

export default function NavigationSidebar({ currentUser, activeItemId, onNavigate, onLogout }: NavigationSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const { toast } = useToast();
  
  const supportEmail = "brennan@smallgiantsonline.com";
  
  const handleCopyEmail = () => {
    navigator.clipboard.writeText(supportEmail);
    toast({
      title: "Email copied",
      description: "Email address copied to clipboard.",
    });
  };

  const navigationSections: NavigationSection[] = useMemo(() => {
    const planItems: NavigationItem[] = [
      { id: 'exec-summary', label: 'Executive Summary', icon: <HomeIcon className="w-4 h-4" /> },
      { id: 'wizard', label: 'Planning Wizard', icon: <TrendingUpIcon className="w-4 h-4" /> },
      { id: 'canvas', label: 'Roadmap Canvas', icon: <FileTextIcon className="w-4 h-4" /> },
      { id: 'foundation', label: 'Foundation', icon: <BuildingIcon className="w-4 h-4" /> },
      { id: 'three-year', label: 'Three Year', icon: <CalendarIcon className="w-4 h-4" /> },
      { id: 'one-year', label: 'One Year', icon: <Clock3Icon className="w-4 h-4" /> },
      { id: 'priority-management', label: 'Priorities & Capabilities', icon: <ActivityIcon className="w-4 h-4" /> },
      { id: 'swot', label: 'SWOT Analysis', icon: <TrendingUpIcon className="w-4 h-4" /> },
    ];

    const executeItems: NavigationItem[] = [
      { id: 'weekly-meeting', label: 'Weekly Meeting', icon: <UsersIcon className="w-4 h-4" /> },
      { id: 'priorities', label: 'Priority Execution', icon: <ClipboardListIcon className="w-4 h-4" /> },
      { id: 'metrics', label: 'KPI Dashboard', icon: <BarChart3Icon className="w-4 h-4" /> },
      { id: 'rocks', label: 'My Rocks', icon: <TargetIcon className="w-4 h-4" /> },
      { id: 'assessments', label: 'Agile Growth Checklist', icon: <ClipboardListIcon className="w-4 h-4" /> },
      { id: 'just-get-it-done', label: 'Just Get It Done', icon: <ClipboardListIcon className="w-4 h-4" /> },
      { id: 'personal', label: 'Personal Development', icon: <BookOpenIcon className="w-4 h-4" />, disabled: true },
    ];

    const adminItems: NavigationItem[] =
      currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin')
        ? [{ id: 'admin', label: 'Admin Panel', icon: <ShieldIcon className="w-4 h-4" /> }]
        : [];

    return [
      { title: 'Plan', items: planItems },
      { title: 'Execute', items: executeItems },
      ...(adminItems.length ? [{ title: 'Admin', items: adminItems }] : []),
    ];
  }, [currentUser]);

  const handleItemClick = (itemId: string) => {
    onNavigate(itemId);
  };

  return (
    <div className={`h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-brand-teal-turquoise flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SG</span>
                </div>
                <div>
                  <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">Small Giants</h1>
                  <p className="text-[10px] text-muted-foreground leading-tight">7 Attributes of Agile Growth</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-gradient-brand-teal-turquoise flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">SG</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={isCollapsed ? "hidden" : ""}
            data-testid="button-toggle-sidebar"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
        </div>
        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className="w-full mt-2"
            data-testid="button-expand-sidebar"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Navigation Items */}
      <div className="flex-1 p-2 space-y-4 overflow-auto">
        {navigationSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
                {section.title}
              </div>
            )}

            {section.items.map((item) => {
              const isActive = activeItemId === item.id;

              const button = (
                <Button
                  key={item.id}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => !item.disabled && handleItemClick(item.id)}
                  disabled={item.disabled}
                  className={`w-full justify-start gap-3 transition-all overflow-hidden ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed text-muted-foreground border-l-2 border-transparent'
                      : isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-accent'
                        : 'text-sidebar-foreground/70 border-l-2 border-transparent'
                  }`}
                  data-testid={`nav-item-${item.id}`}
                >
                  {item.icon}
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 min-w-0 text-left truncate">{item.label}</span>
                      {item.count && (
                        <Badge variant="secondary" className="ml-auto">
                          {item.count}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
              );

              // When collapsed, always show a tooltip so labels never “disappear”.
              if (isCollapsed) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>
                        {item.label}
                        {item.disabled ? " (Coming soon)" : ""}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              if (item.disabled) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Coming soon</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return button;
            })}
          </div>
        ))}
      </div>

      {/* Settings Section */}
      <div className="p-2 space-y-1 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleItemClick('settings')}
          className="w-full justify-start gap-3 text-sidebar-foreground/70"
          data-testid="nav-item-settings"
        >
          <SettingsIcon className="w-4 h-4" />
          {!isCollapsed && <span>Settings</span>}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHelpDialog(true)}
          className="w-full justify-start gap-3 text-sidebar-foreground/70"
          data-testid="nav-item-help"
        >
          <HelpCircleIcon className="w-4 h-4" />
          {!isCollapsed && <span>Help & Support</span>}
        </Button>
      </div>

      {/* User Profile */}
      {currentUser && (
        <div className="p-4 border-t border-sidebar-border">
          <div className={`flex flex-wrap items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
              <AvatarFallback>
                <UserIcon className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {currentUser.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentUser.role}
                </p>
              </div>
            )}
            {onLogout && !isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                data-testid="button-logout"
              >
                <LogOutIcon className="w-4 h-4" />
              </Button>
            )}
          </div>
          {onLogout && isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              data-testid="button-logout"
            >
              <LogOutIcon className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Help & Support Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircleIcon className="h-5 w-5" />
              Help & Support
            </DialogTitle>
            <DialogDescription>
              Need assistance? Reach out to us via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <MailIcon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Email Address</p>
                <p className="text-lg font-mono text-primary">{supportEmail}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCopyEmail}
                variant="outline"
                className="flex-1"
              >
                <CopyIcon className="h-4 w-4 mr-2" />
                Copy Email
              </Button>
              <Button
                onClick={() => window.location.href = `mailto:${supportEmail}`}
                className="flex-1"
              >
                <MailIcon className="h-4 w-4 mr-2" />
                Open Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}