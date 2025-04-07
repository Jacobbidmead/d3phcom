"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { socket } from "../socket";
import type { Tweet } from "../types";

interface WebSocketContextData {
  isConnected: boolean;
  transport: string;
  method: string;
  keywords: { _id?: string; kw_string: string }[];
  isLoading: boolean;
  tweets: {
    newTweets: Tweet[];
    totalPages: number;
    currentPage: number;
  };
  // fetchPage: (page: number) => void;
}

const WebSocketContext = createContext<WebSocketContextData | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [transport, setTransport] = useState(socket.io.engine.transport.name);
  const [method, setMethod] = useState("");
  const [keywords, setKeywords] = useState<{ _id?: string; kw_string: string }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [tweets, setTweets] = useState<{
    newTweets: Tweet[];
    totalPages: number;
    currentPage: number;
  }>({
    newTweets: [],
    totalPages: 1,
    currentPage: 1,
  });

  // fetch page for pagination
  // const fetchPage = (page: number) => {
  //   socket.emit("getTweets", { page });
  // };

  useEffect(() => {
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    // spearfishing ? widenet
    socket.on("mode", setMethod);

    // TODO - move into dashboard
    socket.on("kws", (keyWords: { _id?: string; kw_string: string }[]) => {
      setKeywords(keyWords);
      setIsLoading(false);
    });

    // tweet data - move to tweets component
    socket.on("tweets", (data: { newTweets: Tweet[]; totalPages: number; currentPage: number }) => {
      setTweets(data);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("mode");
      socket.off("kws");
      socket.off("tweets");
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        transport,
        method,
        keywords,
        isLoading,
        tweets,
        // fetchPage,
      }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};
