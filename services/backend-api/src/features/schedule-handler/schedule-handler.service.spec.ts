import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { TestingModule } from "@nestjs/testing";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";

import { Types } from "mongoose";
import { ScheduleHandlerModule } from "./schedule-handler.module";
import { ScheduleHandlerService } from "./schedule-handler.service";
import {
  FeedSchedule,
  FeedScheduleModel,
} from "../feeds/entities/feed-schedule.entity";
import {
  UserFeed,
  UserFeedFeature,
  UserFeedModel,
} from "../user-feeds/entities";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../user-feeds/types";

jest.mock("../../utils/logger");

describe("handle-schedule", () => {
  let module: TestingModule;
  let userFeedModel: UserFeedModel;
  let feedScheduleModel: FeedScheduleModel;
  let service: ScheduleHandlerService;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests({
      providers: [],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([UserFeedFeature]),
        ScheduleHandlerModule,
      ],
    });

    ({ module } = await init());
    userFeedModel = module.get<UserFeedModel>(getModelToken(UserFeed.name));
    feedScheduleModel = module.get<FeedScheduleModel>(
      getModelToken(FeedSchedule.name)
    );
    service = module.get<ScheduleHandlerService>(ScheduleHandlerService);
    service.defaultRefreshRateSeconds = 600;
  });

  beforeEach(async () => {
    await userFeedModel.deleteMany();
    await feedScheduleModel.deleteMany();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
    await module?.close();
  });

  describe("handleRefreshRate", () => {
    it("calls the handlers for feeds with default refresh rate", async () => {
      const createdFeeds = await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
      ]);

      const urlHandler = jest.fn();
      const feedHandler = jest.fn();

      await service.handleRefreshRate(service.defaultRefreshRateSeconds, {
        urlHandler,
        feedHandler,
      });

      expect(urlHandler).toHaveBeenCalledWith("new-york-times.com");
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[0].title,
        })
      );
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[1].title,
        })
      );
    });

    it("calls the handlers for feeds with non-default refresh rates", async () => {
      const createdSchedule = await feedScheduleModel.create({
        name: "something",
        keywords: ["york"],
        refreshRateMinutes: 4,
      });
      const createdFeeds = await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
      ]);

      const urlHandler = jest.fn();
      const feedHandler = jest.fn();

      await service.handleRefreshRate(createdSchedule.refreshRateMinutes * 60, {
        urlHandler,
        feedHandler,
      });

      expect(urlHandler).toHaveBeenCalledWith("new-york-times.com");
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[0].title,
        })
      );
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[1].title,
        })
      );
    });
  });

  describe("getUrlsMatchingRefreshRate", () => {
    it("does not return duplicate urls for default refresh rate for default rate", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
      ]);

      const urls = await service.getUrlsMatchingRefreshRate(
        service.defaultRefreshRateSeconds
      );

      expect(urls).toEqual(["new-york-times.com"]);
    });

    it("does not return duplicate urls for non-default rates", async () => {
      const createdSchedule = await feedScheduleModel.create({
        name: "something",
        keywords: ["york"],
        refreshRateMinutes: 4,
      });
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
      ]);

      const urls = await service.getUrlsMatchingRefreshRate(
        createdSchedule.refreshRateMinutes * 60
      );

      expect(urls).toEqual(["new-york-times.com"]);
    });
  });

  describe("getFeedsQueryWithScheduleAndUsers", () => {
    describe("schedule keywords", () => {
      it("returns matches", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id",
            },
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id",
            },
          },
        ]);

        const result = await service
          .getFeedsQueryWithScheduleAndUsers(
            [
              {
                name: "new york times",
                keywords: ["YORK"],
                feeds: [],
                refreshRateMinutes: 10,
              },
            ],
            []
          )
          .lean();

        expect(result).toHaveLength(1);
        expect(result[0].url).toEqual(created[0].url);
      });

      it("does not return if they are disabled", async () => {
        await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id",
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: ["YORK"],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result).toEqual([]);
      });
    });

    describe("schedule feed ids", () => {
      it("returns matches", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "new-york-times.com",
              user: {
                discordUserId: "user-id",
              },
            },
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id",
              },
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[1]._id],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result[0].url).toEqual(created[1].url);
      });

      it("does not return if they are disabled", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id",
              },
              disabledCode: UserFeedDisabledCode.BadFormat,
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result).toEqual([]);
      });

      it("does not return if they are failed", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id",
              },
              healthStatus: UserFeedHealthStatus.Failed,
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result).toEqual([]);
      });
    });

    describe("user ids", () => {
      it("returns matches", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-2",
            },
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[1].user.discordUserId]
        );

        expect(result[0].url).toEqual(created[1].url);
      });

      it("does not return if they are disabled", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-2",
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[1].user.discordUserId]
        );

        expect(result).toEqual([]);
      });

      it("does not return if they are failed", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-1",
            },
            healthStatus: UserFeedHealthStatus.Failed,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[0].user.discordUserId]
        );

        expect(result).toEqual([]);
      });
    });

    it("returns nothing if no results are found", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
        {
          title: "feed-title",
          url: "yahoo-news.com",
          user: {
            discordUserId: "user-id",
          },
        },
      ]);

      const result = await service.getFeedsQueryWithScheduleAndUsers(
        [
          {
            name: "bloomberg news",
            keywords: ["bloomberg"],
            feeds: [new Types.ObjectId().toString()],
            refreshRateMinutes: 10,
          },
        ],
        ["irrelevant-guild-id"]
      );

      expect(result).toEqual([]);
    });
  });

  describe("getScheduleFeedQueryExcluding", () => {
    describe("schedule keywords", () => {
      it("returns the correct matches", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-1",
            },
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: ["YORK"],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result).toHaveLength(1);
        expect(result[0].url).toEqual(created[1].url);
      });

      it("does not return feeds that are not healthy", async () => {
        await userFeedModel.create([
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-1",
            },
            healthStatus: UserFeedHealthStatus.Failed,
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: ["yahoo"],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result).toEqual([]);
      });

      it("does not return if they are disabled", async () => {
        await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "discord-user",
            },
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "discord-user",
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: ["YORK"],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result).toEqual([]);
      });
    });

    describe("schedule feed ids", () => {
      it("returns correctly based on feed id", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "new-york-times.com",
              user: {
                discordUserId: "user-id-1",
              },
            },
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id-1",
              },
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[1]._id],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result[0].url).toEqual(created[0].url);
      });

      it("does not return if they are disabled", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "new-york-times.com",
              user: {
                discordUserId: "user-id-1",
              },
            },
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id-1",
              },
              disabledCode: UserFeedDisabledCode.BadFormat,
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result).toHaveLength(0);
      });

      it("does not return if they are failed", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "new-york-times.com",
              user: {
                discordUserId: "user-id-1",
              },
            },
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id-1",
              },
              healthStatus: UserFeedHealthStatus.Failed,
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          []
        );

        expect(result).toHaveLength(0);
      });
    });

    describe("user ids", () => {
      it("returns correctly", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-2",
            },
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[1].user.discordUserId]
        );

        expect(result).toHaveLength(1);
        expect(result[0].url).toEqual(created[0].url);
      });

      it("does not return if they are disabled", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-2",
            },
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[1].user.discordUserId]
        );

        expect(result).toHaveLength(0);
      });

      it("does not return if they are failed", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
            healthStatus: UserFeedHealthStatus.Failed,
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-2",
            },
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[1].user.discordUserId]
        );

        expect(result).toHaveLength(0);
      });
    });

    it("returns nothing if no results are found", async () => {
      const created = await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id-1",
          },
        },
        {
          title: "feed-title",
          url: "yahoo-news.com",
          user: {
            discordUserId: "user-id-2",
          },
        },
      ]);

      const result = await service.getScheduleFeedQueryExcluding(
        [
          {
            name: "bloomberg news",
            keywords: ["bloomberg"],
            feeds: [new Types.ObjectId().toString()],
            refreshRateMinutes: 10,
          },
        ],
        ["irrelevant-user-id-to-exclude"]
      );

      const resultUrls = result.map((feed) => feed.url);

      expect(resultUrls).toHaveLength(2);
      expect(resultUrls).toEqual(
        expect.arrayContaining([created[0].url, created[1].url])
      );
    });
  });
});
