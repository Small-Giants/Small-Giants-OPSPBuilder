import NavigationSidebar from '../NavigationSidebar';

export default function NavigationSidebarExample() {
  //todo: remove mock functionality
  const currentUser = {
    name: "Sarah Johnson",
    email: "sarah.johnson@company.com",
    avatar: "",
    role: "Strategy Lead"
  };

  const handleNavigate = (itemId: string) => {
    console.log(`Navigating to: ${itemId}`);
  };

  return (
    <div className="h-screen">
      <NavigationSidebar
        currentUser={currentUser}
        activeItemId="exec-summary"
        onNavigate={handleNavigate}
        onLogout={() => console.log("Logout clicked")}
      />
    </div>
  );
}