import type { xNotices } from "../../notices/x.ts";

export const xNoticesTr: Record<keyof typeof xNotices, string> = {
  "x.invalidProfileUrl":
    "Bir X kullanıcı adı veya https://x.com profil bağlantısı girin.",
  "x.invalidUsername":
    "Geçerli bir X kullanıcı adı girin (en fazla 15 harf, rakam veya alt çizgi).",
  "x.timelineUnavailable":
    "X'in herkese açık zaman akışına ulaşılamıyor. Daha sonra tekrar deneyin veya profili X'te açın.",
  "x.timelineFormatChanged":
    "X, herkese açık zaman akışının biçimini değiştirdi.",
  "x.timelineHidden":
    "X bu profilin herkese açık gönderilerini göstermedi. Gizli hesaplar desteklenmez.",
  "x.privateAccount": "Gizli X hesapları desteklenmez.",
  "x.accountNotFound": "X hesabı bulunamadı.",
  "x.refreshFailed": "X yenilenemedi.",
  "x.publicTimelineHttp":
    "X'in herkese açık zaman akışına ulaşılamıyor (HTTP {status}). Daha sonra tekrar deneyin.",
  "x.snapshotLimited":
    "X yalnızca sınırlı, çoğu zaman eski gönderiler içeren herkese açık bir görünüm sunar; son gönderiler ve eksiksiz bir zaman akışı garanti edilmez.",
  "x.apiHttp":
    "X API isteği başarısız oldu (HTTP {status}). Bearer token'ı, API erişimini ve kullanım sınırlarını kontrol edin.",
  "x.apiIncomplete":
    "X API eksik veri döndürdü. Hesabın erişilebilirliğini ve API erişimini kontrol edin.",
  "x.apiNoTimeline": "X API kullanılabilir bir zaman akışı döndürmedi.",
  "x.apiLimited":
    "X yenilemesi en fazla 30 yeni gönderi/yeniden paylaşımla sınırlıdır. Maliyeti ve hacmi düşük tutmak için fazla olan eski öğeler atlandı.",
  "x.socialDataBalance":
    "SocialData bakiyesi boş. X'i yenilemek için socialdata.tools üzerinden bakiye yükleyin.",
  "x.socialDataKey": "SocialData API anahtarını reddetti (SOCIALDATA_API_KEY).",
  "x.socialDataHttp":
    "SocialData isteği başarısız oldu (HTTP {status}). Daha sonra tekrar deneyin.",
  "x.socialDataSkipped":
    "Bir yenilemenin okuyabileceğinden daha fazla yeni X gönderisi geldi; en eskileri atlandı.",
  "x.socialDataFallbackWait":
    "SocialData araması başarısız oluyor. Bunun yerine hesabın zaman akışı en fazla 6 saatte bir kullanılır; bir sonraki deneme {time} UTC'den sonra.",
  "x.socialDataFallbackUsed":
    "SocialData araması başarısız olduğu için bunun yerine bu hesabın zaman akışı okundu (en fazla 6 saatte bir).",
  "x.socialDataNoUserId": "SocialData bu X hesabının kimliğini döndürmedi.",
  "x.invalidPostUrl": "Geçersiz X gönderi bağlantısı.",
  "x.postUnavailable":
    "X gönderisine ulaşılamıyor. Lütfen daha sonra tekrar deneyin.",
  "x.postNotReturned": "X bu herkese açık gönderiyi döndürmedi.",
};
