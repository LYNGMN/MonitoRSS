import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  FeedSubscriber,
  FeedSubscriberModel,
  FeedSubscriberType,
} from './entities/feed-subscriber.entity';

interface CreateFeedSubscriberDetails {
  type: FeedSubscriberType;
  discordId: string;
  feedId: string;
}

interface UpdateFeedSubscriberDetails {
  filters?: Array<{ category: string; value: string }>;
}

@Injectable()
export class FeedSubscribersService {
  constructor(
    @InjectModel(FeedSubscriber.name)
    private readonly feedSubscriber: FeedSubscriberModel,
  ) {}

  async getSubscribersOfFeed(
    feedId: string | Types.ObjectId,
  ): Promise<FeedSubscriber[]> {
    const subscribers = await this.feedSubscriber
      .find({
        feed: feedId,
      })
      .lean();

    return subscribers;
  }

  async createFeedSubscriber(
    details: CreateFeedSubscriberDetails,
  ): Promise<FeedSubscriber> {
    const subscriber = await this.feedSubscriber.create({
      type: details.type,
      id: details.discordId,
      feed: details.feedId,
    });

    return subscriber;
  }

  async remove(subscriberId: Types.ObjectId | string) {
    await this.feedSubscriber.deleteOne({
      _id: subscriberId,
    });
  }

  async findById(id: Types.ObjectId | string) {
    return this.feedSubscriber.findById(id).lean();
  }

  async updateOne(
    subscriberId: Types.ObjectId | string,
    { filters }: UpdateFeedSubscriberDetails,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoUpdate: Record<string, any> = {};

    if (filters) {
      mongoUpdate.$addToSet = {};
      filters.forEach(({ category, value }) => {
        const addToSetKey = `filters.${category}`;
        const currentArr = mongoUpdate.$addToSet[addToSetKey]?.$each;

        if (!currentArr) {
          mongoUpdate.$addToSet[addToSetKey] = { $each: [value] };
        } else {
          mongoUpdate.$addToSet[addToSetKey].$each.push(value);
        }
      });
    }

    return this.feedSubscriber
      .findOneAndUpdate({ _id: subscriberId }, mongoUpdate, {
        new: true,
      })
      .lean();
  }
}
