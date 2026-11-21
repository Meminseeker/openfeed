import type { commonNotices } from "../../notices/common.ts";

export const commonNoticesTr: Record<keyof typeof commonNotices, string> = {
  "common.requestFailed": "İstek başarısız oldu",
  "common.timeout": "Kaynak çok geç yanıt verdi. Daha sonra tekrar deneyin.",
  "common.network": "Kaynağa ulaşılamadı. Daha sonra tekrar deneyin.",
  "common.invalidUrl": "Geçersiz URL",
};
