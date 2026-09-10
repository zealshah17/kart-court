export interface CustomerSummaryTopic {
  name: string;
  sentiment: "positive" | "negative" | "mixed" | null;
  mentions: number | null;
  positiveMentions: number | null;
  negativeMentions: number | null;
  summary: string | null;
}

export interface CustomerSummary {
  text: string;
  source: "amazon_ai_generated";
  capturedFrom: "product_page" | "user_screenshot" | "user_html" | "serpapi";
  topics: CustomerSummaryTopic[];
}

export interface ProductInfo {
  asin: string;
  url: string;
  title: string | null;
  price: string | null;
  currency: string | null;
  rating: number | null;
  ratingCount: number | null;
  imageUrl: string | null;
  images: string[];
  bulletPoints: string[];
  description: string | null;
  specifications: Record<string, string>;
  availability: string | null;
  customerSummary: CustomerSummary | null;
}

export interface ProductReview {
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  date: string | null;
  verifiedPurchase: boolean;
  id: string | null;
}

export interface ProductLookupResult {
  product: ProductInfo;
  reviews: ProductReview[];
  extraction: {
    fetchedAt: string;
    provider?: "serpapi";
    reviewSourceUrl: string;
    reviewScope: "visible_sample";
    warnings: string[];
  };
}
