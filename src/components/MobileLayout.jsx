import { Outlet } from "react-router-dom";
import BottomNav from "./chat/BottomNav";
import OfflineIndicator from "./chat/OfflineIndicator";

export default function MobileLayout() {
  return (
    <div className="h-full w-full max-w-lg mx-auto flex flex-col relative">
      <OfflineIndicator />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}