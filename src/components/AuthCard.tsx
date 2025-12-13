import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Computer, LogOutIcon, UserIcon, SettingsIcon } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'Admin' | 'Owner' | 'Editor' | 'Viewer' | 'Coach';
  organization: string;
}

interface AuthCardProps {
  user: User | null;
  onSignIn: (provider: 'google' | 'microsoft') => void;
  onSignOut: () => void;
}

export default function AuthCard({ user, onSignIn, onSignOut }: AuthCardProps) {
  const [isLoading, setIsLoading] = useState<'google' | 'microsoft' | null>(null);

  const handleSignIn = async (provider: 'google' | 'microsoft') => {
    setIsLoading(provider);
    try {
      await onSignIn(provider);
    } finally {
      setIsLoading(null);
    }
  };

  const getRoleColor = (role: User['role']) => {
    const colors = {
      Admin: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100',
      Owner: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100',
      Editor: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100',
      Viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
      Coach: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
    };
    return colors[role];
  };

  if (user) {
    return (
      <Card className="w-full max-w-md" data-testid="card-user-profile">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>
                <UserIcon className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-lg">{user.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Role</span>
            <Badge className={getRoleColor(user.role)} data-testid="badge-user-role">
              {user.role}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Organization</span>
            <span className="text-sm text-muted-foreground">{user.organization}</span>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              data-testid="button-settings"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onSignOut}
              data-testid="button-sign-out"
            >
              <LogOutIcon className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md" data-testid="card-auth">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to OPSP</CardTitle>
        <p className="text-muted-foreground">
          Sign in to access your strategic planning workspace
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <Button
          onClick={() => handleSignIn('google')}
          disabled={isLoading !== null}
          className="w-full"
          variant="outline"
          data-testid="button-sign-in-google"
        >
          {isLoading === 'google' ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Search className="w-4 h-4 mr-2" />
          )}
          Continue with Google
        </Button>

        <Button
          onClick={() => handleSignIn('microsoft')}
          disabled={isLoading !== null}
          className="w-full"
          variant="outline"
          data-testid="button-sign-in-microsoft"
        >
          {isLoading === 'microsoft' ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Computer className="w-4 h-4 mr-2" />
          )}
          Continue with Microsoft
        </Button>

        <div className="text-center text-xs text-muted-foreground pt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </div>
      </CardContent>
    </Card>
  );
}

// Simple icon components since we need them for the auth providers
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
    </svg>
  );
}