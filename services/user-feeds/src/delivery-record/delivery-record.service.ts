import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { ArticleDeliveryState, ArticleDeliveryStatus } from "../shared";
import { DeliveryRecord } from "./entities";
import dayjs from "dayjs";
import { MikroORM } from "@mikro-orm/core";

const { Failed, Rejected, Sent, PendingDelivery } = ArticleDeliveryStatus;

@Injectable()
export class DeliveryRecordService {
  constructor(
    @InjectRepository(DeliveryRecord)
    private readonly recordRepo: EntityRepository<DeliveryRecord>,
    private readonly orm: MikroORM // Required for @UseRequestContext()
  ) {}

  async store(
    feedId: string,
    articleStates: ArticleDeliveryState[],
    flush = true
  ) {
    const records = articleStates.map((articleState) => {
      const { status: articleStatus } = articleState;

      let record: DeliveryRecord;

      if (articleStatus === Sent) {
        record = new DeliveryRecord({
          id: articleState.id,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          content_type: articleState.contentType,
          article_id_hash: articleState.articleIdHash,
          parent: articleState.parent
            ? ({ id: articleState.parent } as never)
            : null,
        });
      } else if (articleStatus === Failed || articleStatus === Rejected) {
        record = new DeliveryRecord({
          id: articleState.id,
          feed_id: feedId,
          status: articleStatus,
          error_code: articleState.errorCode,
          internal_message: articleState.internalMessage,
          medium_id: articleState.mediumId,
          article_id_hash: articleState.articleIdHash,
        });
      } else if (articleStatus === PendingDelivery) {
        record = new DeliveryRecord({
          id: articleState.id,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          parent: articleState.parent
            ? ({
                id: articleState.parent,
              } as never)
            : null,
          content_type: articleState.contentType,
          article_id_hash: articleState.articleIdHash,
        });
      } else {
        record = new DeliveryRecord({
          id: articleState.id,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          article_id_hash: articleState.articleIdHash,
        });
      }

      return record;
    });

    if (flush) {
      await this.orm.em.persistAndFlush(records);
    } else {
      this.orm.em.persist(records);
    }
  }

  async updateDeliveryStatus(
    id: string,
    details: {
      status: ArticleDeliveryStatus;
      errorCode?: string;
      internalMessage?: string;
      externalDetail?: string;
      articleId?: string;
    }
  ) {
    const { status, errorCode, internalMessage, externalDetail } = details;

    const record = await this.recordRepo.findOneOrFail(id);

    record.status = status;
    record.error_code = errorCode;
    record.internal_message = internalMessage;
    record.external_detail = externalDetail;

    await this.recordRepo.persistAndFlush(record);

    return record;
  }

  async countDeliveriesInPastTimeframe(
    { mediumId, feedId }: { mediumId?: string; feedId?: string },
    secondsInPast: number
  ) {
    // Convert initial counts to the same query below
    const subquery = this.recordRepo
      .createQueryBuilder()
      .count()
      .where({
        ...(mediumId
          ? {
              medium_id: mediumId,
            }
          : {}),
        ...(feedId
          ? {
              feed_id: feedId,
            }
          : {}),
      })
      .andWhere({
        status: {
          $in: [Sent, Rejected],
        },
      })
      .andWhere({
        created_at: {
          $gte: dayjs().subtract(secondsInPast, "second").toDate(),
        },
      })
      .groupBy("article_id_hash");

    const query = await this.recordRepo
      .createQueryBuilder()
      .count()
      .from(subquery, "subquery")
      .execute("get");

    return Number(query.count);
  }
}
