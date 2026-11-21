import type { youtubeNotices } from "../../notices/youtube.ts";

export const youtubeNoticesTr: Record<keyof typeof youtubeNotices, string> = {
  "youtube.pageDataUnavailable":
    "YouTube sayfa verileri alınamadı. Lütfen daha sonra tekrar deneyin.",
  "youtube.pageDataIncomplete": "YouTube sayfa verileri eksik.",
  "youtube.httpStatus":
    "YouTube HTTP {status} döndürdü. Daha sonra tekrar deneyin.",
  "youtube.invalidChannelInput":
    "Bir YouTube kanal URL'si, kullanıcı adı veya kanal kimliği girin.",
  "youtube.notChannelUrl":
    "Video veya oynatma listesi URL'si yerine kanal URL'si kullanın.",
  "youtube.invalidHandle":
    "Bir YouTube @kullanıcıadı veya /channel/ URL'si girin.",
  "youtube.channelNotFound": "Bu herkese açık YouTube kanalı bulunamadı.",
  "youtube.uploadFeedUnavailable": "Yükleme akışı kullanılamıyor",
  "youtube.uploadFeedUnavailableMore": "Yükleme akışı kullanılamıyor;",
  "youtube.videosTabUnavailable": "Videolar sekmesi kullanılamıyor",
  "youtube.videosTabUnavailableMore": "Videolar sekmesi kullanılamıyor;",
  "youtube.shortsTabUnavailable": "Shorts sekmesi kullanılamıyor",
  "youtube.shortsTabUnavailableMore": "Shorts sekmesi kullanılamıyor;",
  "youtube.communityTabUnavailable":
    "Topluluk gönderileri sekmesi kullanılamıyor",
  "youtube.communityTabUnavailableMore":
    "Topluluk gönderileri sekmesi kullanılamıyor;",
  "youtube.pageRedirectLoop":
    "{platform} eksik veya döngüye giren bir yönlendirme döndürdü. Daha sonra tekrar deneyin.",
  "youtube.pageRedirectedAway":
    "{platform} istenen herkese açık içerik yerine başka bir sayfaya yönlendirdi. Onay veya oturum açma gerektiriyor olabilir.",
  "youtube.pageHttpStatus": "{platform} HTTP {status} döndürdü.",
  "youtube.pageMayBeBlocking":
    "Bu sunucudan gelen istekleri engelliyor veya sınırlıyor olabilir.",
  "youtube.tryAgainLater": "Daha sonra tekrar deneyin.",
  "youtube.consentRequired":
    "YouTube bu sunucuda etkileşimli bir onay seçimi istiyor. Oynatma listesi otomatik olarak içe aktarılamadı.",
  "youtube.pageConnectFailed":
    "OpenFeed sunucusu 3 denemeden sonra {platform} ile bağlantı kuramadı. Sunucunun dışa giden ağ/DNS erişimini kontrol edip tekrar deneyin.",
  "youtube.pageConnectFailedCode":
    "OpenFeed sunucusu 3 denemeden sonra {platform} ile bağlantı kuramadı ({code}). Sunucunun dışa giden ağ/DNS erişimini kontrol edip tekrar deneyin.",
  "youtube.pageLoadFailed": "{platform} yüklenemedi.",
};
