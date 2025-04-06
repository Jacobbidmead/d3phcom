export interface DataProps {
  mode: string;
  keywords: {
    _id?: string;
    kw_string: string;
  }[];
  tweets: {
    newTweets: Tweet[];
    totalPages: number;
    currentPage: number;
  };
}

export interface Tweet {
  _id: string;
  post_date: string;
  created_at: string;
  text: string;
  query_kw: string;
  tweet_id: string;
  convo_id: string;
  author_id: string;
  __v: number;
}

export interface PaginatedCardListProps {
  tweets: Tweet[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export interface TweetMetricProps {
  impressions: { post_date: string; num_impressions: number }[];
  likes: { post_date: string; num_likes: number }[];
  retweets: { post_date: string; num_retweets: number }[];
  replies: { post_date: string; num_replies: number }[];
}

export interface Hval {
  _id?: string;
  final_gauge: number;
  post_date: string;
}

export interface DashboardProps {
  gauge: number;
  keywords: {
    _id?: string;
    kw_string: string;
  }[];
  isLoading: boolean;
  hvals: {
    _id?: string;
    final_gauge: number;
    post_date: string;
  }[];
}
