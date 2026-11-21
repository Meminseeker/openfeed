import type { tiktokNotices } from "../../notices/tiktok.ts";

export const tiktokNoticesTr: Record<keyof typeof tiktokNotices, string> = {
  "tiktok.invalidUrl":
    "Bir TikTok kullanıcı adı veya HTTPS profil bağlantısı kullanın.",
  "tiktok.videoUrl":
    "Video bağlantısı değil, bir TikTok profil bağlantısı kullanın.",
  "tiktok.invalidUsername":
    "Geçerli bir TikTok kullanıcı adı girin (en fazla 24 karakter).",
  "tiktok.profileNoVideos":
    "TikTok herkese açık video göstermedi. Profil boş ya da gizli olabilir veya TikTok erişimi engellemiş olabilir. Daha sonra yenilemeyi deneyin; mevcut gönderiler korunur.{end}",
  "tiktok.profileCoverage":
    "TikTok, herkese açık profilinde gösterilen son videoları içe aktarır; eksiksiz bir zaman akışı garanti edilmez.",
  "tiktok.embedNoList":
    "TikTok içerik üreticisi yerleştirmesi herkese açık bir video listesi döndürmedi.{end}",
  "tiktok.embedNoUsable":
    "TikTok içerik üreticisi yerleştirmesi bu hesaba ait kullanılabilir herkese açık video içermiyordu.{end}",
  "tiktok.embedCoverage":
    "TikTok içerik üreticisi yerleştirmeleri en fazla 10 güncel videoyu gösterir; tarihler video kimliklerinden tahmin edilir.",
  "tiktok.privateAccount": "Gizli TikTok hesapları desteklenmiyor.",
  "tiktok.httpStatus": "HTTP {status}{end}",
  "tiktok.blocked": "TikTok isteği engelledi{end}",
  "tiktok.requestFailure": "{message}{end}",
  "tiktok.refreshFailed": "TikTok yenilemesi başarısız oldu:",
  "tiktok.postsKept": "Mevcut gönderiler korunur.",
} as const;
