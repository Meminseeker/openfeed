import type { NoticeCode } from "../../notices/index.ts";
import { commonNoticesTr } from "./common.ts";
import { authNoticesTr } from "./auth.ts";
import { coreNoticesTr } from "./core.ts";
import { youtubeNoticesTr } from "./youtube.ts";
import { xNoticesTr } from "./x.ts";
import { instagramNoticesTr } from "./instagram.ts";
import { tiktokNoticesTr } from "./tiktok.ts";
import { patreonNoticesTr } from "./patreon.ts";
import { linkedinNoticesTr } from "./linkedin.ts";
import { libraryNoticesTr } from "./library.ts";

export const noticesTr: Record<NoticeCode, string> = {
  ...commonNoticesTr,
  ...authNoticesTr,
  ...coreNoticesTr,
  ...youtubeNoticesTr,
  ...xNoticesTr,
  ...instagramNoticesTr,
  ...tiktokNoticesTr,
  ...patreonNoticesTr,
  ...linkedinNoticesTr,
  ...libraryNoticesTr,
};
