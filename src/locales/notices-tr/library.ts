import type { libraryNotices } from "../../notices/library.ts";

export const libraryNoticesTr: Record<keyof typeof libraryNotices, string> = {
  "library.invalidUrl": "Geçersiz bağlantı",
  "library.httpsLinkRequired":
    "YouTube, X, Instagram, TikTok veya LinkedIn’den bir HTTPS bağlantısı yapıştırın.",
  "library.unsupportedLink":
    "Herkese açık bir YouTube videosu, X gönderisi, Instagram gönderisi/Reel’i, TikTok videosu veya LinkedIn gönderisi bağlantısı kullanın.",
  "library.youtubeVideoLinkRequired":
    "Bir YouTube video bağlantısı yapıştırın. Oynatma listesi bağlantıları için Oynatma listeleri sayfasını kullanın.",
  "library.invalidTikTokRedirect": "Geçersiz TikTok yönlendirmesi.",
  "library.youtubeCommunityUnavailable":
    "YouTube bu topluluk gönderisini göstermedi.",
  "library.instagramNotExposed":
    "Instagram bu herkese açık gönderiyi göstermedi. Gizli veya yalnızca oturum açılarak görülebilen içerik içe aktarılamaz.",
  "library.instagramUnavailable": "Instagram içeriği kullanılamıyor.",
  "library.tiktokNotExposed":
    "TikTok bu videoyu göstermedi. Video kullanılamıyor olabilir veya oturum açmayı gerektirebilir.",
  "library.playlistLinkRequired":
    "Herkese açık bir YouTube oynatma listesi bağlantısı yapıştırın.",
  "library.playlistPagesFailed":
    "Oynatma listesinin bazı sayfaları yüklenemedi. Tekrar denemek için bu oynatma listesini yenileyin.",
  "library.playlistPageLimit":
    "Yalnızca ilk 21 sayfa içe aktarıldı. Bu oynatma listesi içe aktarma sınırını aşıyor.",
  "library.playlistEmpty":
    "Oynatılabilir video bulunamadı. Herkese açık veya liste dışı bir YouTube oynatma listesi kullanın.",
  "library.playlistDatesMissing":
    "{count} videonun kesin yayın tarihi alınamadı; bu videoların kronolojik sırası yaklaşık olabilir. Tekrar denemek için yenileyin.",
};
