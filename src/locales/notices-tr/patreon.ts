import type { patreonNotices } from "../../notices/patreon.ts";

export const patreonNoticesTr: Record<keyof typeof patreonNotices, string> = {
  "patreon.invalidUrl":
    "Bir Patreon kullanıcı adı veya HTTPS profil URL'si kullanın.",
  "patreon.postUrl": "Gönderi URL'si değil, Patreon üreticisi URL'si kullanın.",
  "patreon.invalidUsername":
    "Geçerli bir Patreon üreticisi kullanıcı adı girin.",
  "patreon.blocked":
    "Patreon isteği engelledi veya erişilemiyor (HTTP {status}). Mevcut gönderiler korunuyor.",
  "patreon.notFound": "Patreon üreticisi bulunamadı.",
  "patreon.phoneNoData":
    "Telefon Patreon verisi göndermedi. Patreon isteği engellemiş veya oturumun süresi dolmuş olabilir.",
  "patreon.phoneError":
    "Patreon telefondaki isteğe bir hata döndürdü: {detail}.",
  "patreon.phoneUnexpected": "Telefon beklenmeyen bir Patreon yanıtı gönderdi.",
  "patreon.campaignMismatch":
    "{campaignId} numaralı kampanya {username} değil, {vanity} adlı Patreon üreticisine ait. Telefon eşitleme kurulumundaki kampanya kimliğini kontrol edin.",
  "patreon.phoneAllLocked":
    "Tüm Patreon gönderileri kilitli. Telefon kısayolundaki session_id değerini güncelleyin.",
  "patreon.campaignUnresolved": "Patreon kampanyası belirlenemedi.",
  "patreon.publicOnly":
    "Yalnızca herkese açık Patreon önizlemeleri gösteriliyor; üyelere özel gönderiler kilitli.",
  "patreon.sessionExpired":
    "Patreon oturumunun süresi dolmuş veya bu üyelik bu gönderilerin kilidini açmıyor. PATREON_SESSION_ID değerini güncelleyin.",
  "patreon.pageCap":
    "Yalnızca en yeni {count} Patreon gönderisi kontrol edildi.",
  "patreon.postMissing": "Patreon bu gönderiyi döndürmedi.",
};
