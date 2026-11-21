import type { linkedinNotices } from "../../notices/linkedin.ts";

export const linkedinNoticesTr: Record<keyof typeof linkedinNotices, string> = {
  "linkedin.invalidUrl": "Geçersiz URL",
  "linkedin.profileNameOrUrl":
    "Bir LinkedIn profil adı veya HTTPS profil URL’si kullanın.",
  "linkedin.personalProfilesOnly":
    "Yalnızca kişisel LinkedIn profilleri (linkedin.com/in/…) desteklenir.",
  "linkedin.profileUrlNotPost":
    "Gönderi veya başka bir sayfa değil, bir LinkedIn profil URL’si kullanın.",
  "linkedin.invalidProfileName": "Geçerli bir LinkedIn profil adı girin.",
  "linkedin.invalidProfileNameHint":
    "Geçerli bir LinkedIn profil adı girin (linkedin.com/in/ sonrasındaki kısım).",
  "linkedin.noPublicProfile":
    "LinkedIn herkese açık bir profil döndürmedi. Profil gizli olabilir, oturum açmamış ziyaretçilerden gizlenmiş olabilir veya bu sunucu için engellenmiş olabilir. Mevcut gönderiler korunur.",
  "linkedin.limitedCoverage":
    "LinkedIn, oturum açmamış ziyaretçilere yalnızca son birkaç gönderiyi (genellikle 5) gösterir; yeniden paylaşımlar ve yorumlar dahil değildir.",
  "linkedin.postNotExposed":
    "LinkedIn bu gönderiyi herkese açık olarak sunmadı. Gönderi gizli, silinmiş veya yalnızca üyelere açık olabilir.",
  "linkedin.postHttpError": "LinkedIn bu gönderi için HTTP {status} döndürdü.",
  "linkedin.noPublicEmbed":
    "LinkedIn bu gönderinin herkese açık gömülü sürümünü döndürmedi.",
  "linkedin.signInWall":
    "LinkedIn herkese açık profili göstermek yerine oturum açılmasını istedi. Bu sunucudan gelen istekleri sınırlıyor olabilir; mevcut gönderiler korunur.",
  "linkedin.profileNotFound": "LinkedIn profili bulunamadı.",
  "linkedin.refused":
    "LinkedIn isteği reddetti (HTTP {status}). Profil mevcut olmayabilir veya LinkedIn bu sunucudan gelen istekleri sınırlıyor olabilir. Mevcut gönderiler korunur.",
  "linkedin.refreshFailed":
    "LinkedIn yenilemesi başarısız oldu (HTTP {status}). Mevcut gönderiler korunur.",
  "linkedin.pastePostLink": "Bir LinkedIn gönderi bağlantısı yapıştırın.",
};
