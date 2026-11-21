import type { instagramNotices } from "../../notices/instagram.ts";

export const instagramNoticesTr: Record<keyof typeof instagramNotices, string> =
  {
    "instagram.invalidProfileUrl":
      "Bir Instagram kullanıcı adı veya HTTPS profil URL'si kullanın.",
    "instagram.invalidUsername":
      "Geçerli bir Instagram profil kullanıcı adı girin (en fazla 30 karakter).",
    "instagram.noPublicPosts":
      "Instagram herkese açık gönderi göstermedi. Profil gizli olabilir, yerleştirmeleri kapatmış olabilir veya oturum açmayı gerektiriyor olabilir. Oturum açılarak erişim denenmez.",
    "instagram.privateAccount": "Gizli Instagram hesapları desteklenmiyor.",
    "instagram.embedNoPosts":
      "Instagram'ın herkese açık profil yerleştirmesi hiç gönderi göstermedi.",
    "instagram.embedPreviewOnly":
      "Instagram profil yerleştirmeleri yalnızca son gönderilerin küçük bir önizlemesini (genellikle 6 gönderi) gösterir; tam bir zaman akışı garanti edilmez.",
    "instagram.videoDetailsUnavailable":
      "Bazı video ayrıntıları alınamadı; Kaynağı aç'ı kullanın.",
    "instagram.apiCredentialsMissing":
      "Meta Business Discovery için hem INSTAGRAM_ACCESS_TOKEN hem de INSTAGRAM_USER_ID değerini ayarlayın.",
    "instagram.apiVersionMissing":
      "INSTAGRAM_GRAPH_VERSION değerini Meta uygulamanız için yapılandırılmış Graph API sürümüne ayarlayın (örneğin v24.0).",
    "instagram.apiUnavailable":
      "Instagram API'sine ulaşılamıyor (HTTP {status}). Meta izinlerini, token'ı ve herkese açık profesyonel hesap uygunluğunu kontrol edin.",
    "instagram.apiNoPosts":
      "Meta bu hesabın herkese açık gönderilerini döndürmedi. Yalnızca uygun, herkese açık Business/Creator hesapları desteklenir.",
    "instagram.apiLatestOnly":
      "Instagram yalnızca son 30 öğeyi içe aktarır; eski gönderiler geriye dönük olarak alınmaz.",
    "instagram.profileUnavailable":
      "Instagram herkese açık profiline ulaşılamıyor (HTTP {status}).",
    "instagram.postUnavailable":
      "Instagram gönderisine ulaşılamıyor (HTTP {status}).",
    "instagram.postMediaMissing":
      "Instagram bu gönderinin medyasını göstermedi.",
  };
