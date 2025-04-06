"use client";

import { Dashboard } from "./components/dashboard-main/dashboard";
import { useWebSocket } from "./context/WebSocketContext";

export default function Home() {
  const { method, keywords, isLoading, tweets } = useWebSocket();

  return (
    <div className='pt-20'>
      <Dashboard />
    </div>
  );
}
