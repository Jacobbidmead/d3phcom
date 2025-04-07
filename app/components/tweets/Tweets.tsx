"use client";

import { socket } from "@/app/socket";
import { useState, useEffect } from "react";
import { PaginatedCardList } from "./components/PaginatedCardList";

const Tweets: React.FC = () => {
  const [tweets, setTweets] = useState({
    newTweets: [],
    totalPages: 1,
    currentPage: 1,
  });
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch tweets for the current page
  const fetchTweets = (page: number) => {
    setIsLoading(true);
    socket.emit("getTweets", { page, limit: 9 });
  };

  // Listen for tweets from the server
  useEffect(() => {
    socket.on("tweets", (data) => {
      setTweets(data);
      setCurrentPageIndex(data.currentPage);
      setIsLoading(false);
    });

    fetchTweets(currentPageIndex);

    return () => {
      socket.off("tweets");
    };
  }, [currentPageIndex]);

  const handlePageChange = (page: number) => {
    setCurrentPageIndex(page);
    fetchTweets(page);
  };

  return (
    <div className='bg-black  flex align-middle justify-center text-gray-400 m:mt-8 xxs:pt-10 xl:pt-20 '>
      <div className='p-4 flex items-center'>
        <PaginatedCardList tweets={tweets} onPageChange={handlePageChange} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default Tweets;
