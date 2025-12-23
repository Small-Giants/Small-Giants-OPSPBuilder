import { useState } from "react";
import AuthCard from '../AuthCard';

export default function AuthCardExample() {
  //todo: remove mock functionality
  const [user, setUser] = useState<any>(null);

  const handleSignIn = async (provider: 'google' | 'microsoft') => {
    // Simulate authentication
    setTimeout(() => {
      setUser({
        id: "user123",
        name: "John Smith",
        email: "john.smith@company.com",
        avatar: "",
        role: "Owner",
        organization: "Acme Corporation"
      });
    }, 1500);
  };

  const handleSignOut = () => {
    setUser(null);
  };

  return (
    <div className="p-6 flex justify-center">
      <AuthCard
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    </div>
  );
}