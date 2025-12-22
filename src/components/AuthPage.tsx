"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FcGoogle } from 'react-icons/fc';

export default function AuthPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loginWithGoogle, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    console.log("AuthPage: Auth state:", { isAuthenticated, loading });
    if (isAuthenticated) {
      console.log("AuthPage: Authenticated, redirecting to home...");
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  const handleGoogleLogin = async () => {
    console.log("AuthPage: Starting Google Login...");
    setIsLoading(true);
    setError(null);
    try {
      console.log("AuthPage: Calling loginWithGoogle...");
      await loginWithGoogle();
      console.log("AuthPage: Login successful (popup).");
      // Force redirect if not handled by effect
      router.push('/'); 
    } catch (err: any) {
      console.error("AuthPage: Login error:", err);
      let errorMessage = 'Google login failed';
      if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Small Giants</CardTitle>
          <CardDescription>
            Strategic Planning Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            variant="outline" 
            type="button" 
            className="w-full py-6 text-base"
            disabled={isLoading}
            onClick={handleGoogleLogin}
          >
            <FcGoogle className="mr-2 h-5 w-5" />
            Sign in with Google
          </Button>

        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground flex justify-center">
          <p>Access restricted to Small Giants team members</p>
        </CardFooter>
      </Card>
    </div>
  );
}
