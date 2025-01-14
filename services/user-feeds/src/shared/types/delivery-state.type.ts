import {
  ArticleDeliveryErrorCode,
  ArticleDeliveryRejectedCode,
} from "../constants";
import { ArticleDeliveryContentType } from "./article-delivery-content-type.type";

export enum ArticleDeliveryStatus {
  // The article is being delivered
  PendingDelivery = "pending-delivery",
  Sent = "sent",
  // An error happened within this service
  Failed = "failed",
  // Discord returns a 400 for example. Requires user action.
  Rejected = "rejected",
  // Filters blocked the article from getting delivered
  FilteredOut = "filtered-out",
  // Rate limit enforced by this service
  RateLimited = "rate-limited",
}

interface BaseArticleDeliveryState {
  id: string;
  mediumId: string;
  articleIdHash: string | undefined;
}

interface ArticleDeliveryPendingDeliveryState extends BaseArticleDeliveryState {
  contentType: ArticleDeliveryContentType;
  status: ArticleDeliveryStatus.PendingDelivery;
  parent?: string;
}

interface ArticleDeliverySentState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.Sent;
  contentType?: ArticleDeliveryContentType;
  parent?: string;
}

interface ArticleDeliveryRateLimitState extends BaseArticleDeliveryState {
  id: string;
  mediumId: string;
  status: ArticleDeliveryStatus.RateLimited;
}

interface ArticleDeliveryRejectedState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.Rejected;
  errorCode: ArticleDeliveryRejectedCode;
  internalMessage: string;
}

interface ArticleDeliveryFailureState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.Failed;
  /**
   * User-facing error code.
   */
  errorCode: ArticleDeliveryErrorCode;
  /**
   * Used for internal troubleshooting.
   */
  internalMessage: string;
}

interface ArticleDeliveryFilteredOutState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.FilteredOut;
}

export type ArticleDeliveryState =
  | ArticleDeliveryPendingDeliveryState
  | ArticleDeliverySentState
  | ArticleDeliveryFailureState
  | ArticleDeliveryFilteredOutState
  | ArticleDeliveryRejectedState
  | ArticleDeliveryRateLimitState;
