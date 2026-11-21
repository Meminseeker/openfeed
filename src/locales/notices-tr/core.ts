import type { coreNotices } from "../../notices/core.ts";

export const coreNoticesTr: Record<keyof typeof coreNotices, string> = {
  "core.hostNotAllowed": "Ana makineye veya kaynağa izin verilmiyor.",
  "core.endpointNotFound": "Uç nokta bulunamadı",
  "core.notFound": "Bulunamadı",
  "core.invalidSyncTypes": "Bu kaynak için geçersiz içerik türleri.",
  "core.alreadyFollowing": "Bu hesabı zaten takip ediyorsunuz.",
  "core.alreadyFollowingYoutubeElsewhere":
    "Bu YouTube hesabını zaten başka bir üretici altında takip ediyorsunuz.",
  "core.alreadyFollowingElsewhere":
    "Bu hesabı zaten başka bir üretici altında takip ediyorsunuz.",
  "core.refreshInProgress": "Bir yenileme zaten devam ediyor.",
  "core.xRefreshFailed": "X yenilemesi başarısız oldu.",
  "core.syncFailed": "Eşitleme başarısız oldu",
  "core.importFailed": "İçe aktarma başarısız oldu",
  "core.notesTooLong": "Notlar en fazla 50.000 karakterlik metin olmalıdır.",
  "core.videoNotFound": "Video bulunamadı.",
  "core.invalidVideoRange": "Geçersiz video aralığı.",
  "core.xVideoUnavailable":
    "X videosu kullanılamıyor. Kaynağı yenilemeyi deneyin.",
  "core.xVideoNotVideo": "X bir video döndürmedi.",
  "core.xVideoLoadFailed": "X videosu yüklenemedi.",
  "core.patreonCampaignHelp":
    "Patreon, sunucunun üretici aramasını engelledi. Kampanya kimliğini telefon eşitleme kurulumunda girin.",
  "core.invalidPhoneSyncToken": "Geçersiz telefon eşitleme anahtarı.",
  "core.noPatreonCampaignMatch":
    "Bu kampanyayla eşleşen ve takip ettiğiniz bir Patreon üreticisi yok.",
  "core.enterCampaignId": "Sayısal Patreon kampanya kimliğini girin.",
  "core.savePatreonFirst": "Önce bu Patreon hesabını kaydedin.",
  "core.campaignIdInUse":
    "Bu kampanya kimliğini başka bir Patreon hesabı zaten kullanıyor.",
};
