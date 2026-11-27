import type { Messages } from "../i18n";

// Turkish. Turkish nouns stay singular after a number, so plural pairs use
// the same text for "one" and "other".
export const tr: Messages = {
  // App shell
  "app.title": "OpenFeed — Dikkatiniz, sizin seçiminiz",
  "app.opening": "OpenFeed açılıyor…",
  "language.label": "Dil",

  // Sidebar
  "sidebar.workspace": "KİŞİSEL ÇALIŞMA ALANI",
  "nav.feed": "Akışınız",
  "nav.creators": "Üreticiler",
  "nav.saved": "Sonraya kaydedilenler",
  "nav.noted": "Not alınanlar",
  "nav.playlists": "Oynatma listeleri",
  "nav.links": "Linkler",
  "sidebar.logout": "Çıkış yap · {username}",
  "sidebar.topics": "KONULARINIZ",
  "topics.all": "Tüm konular",
  "sidebar.manageTopics": "Konuları yönet",
  "sidebar.quietTitle": "Biraz daha az gürültü.",
  "sidebar.quietLine1": "Yalnızca seçtiğiniz kişiler.",
  "sidebar.quietLine2": "Kendi hızınızda.",
  "sidebar.profileCaption": "Kişisel çalışma alanınız",

  // Header
  "header.toggleNav": "Gezinmeyi aç/kapat",
  "header.workspace": "Çalışma alanım",
  "header.personalSpace": "Kişisel alan",

  // Page headings
  "page.eyebrow": "DİKKATİNİZ, SİZİN SEÇİMİNİZ",
  "page.creators.title": "İyi insanlar. Tek bir yerde.",
  "page.creators.subtitle": "Hesapları bağlayın. Kişiyi takip edin.",
  "page.saved.title": "Daha sakin bir an için.",
  "page.saved.subtitle": "Geri dönmek istediğiniz şeyler.",
  "page.noted.title": "Not alındı.",
  "page.noted.subtitle": "Not yazdığınız içerikler.",
  "page.playlists.title": "Her seferinde bir koleksiyon.",
  "page.playlists.subtitle": "Koleksiyonlarınız, hazır olduğunuzda burada.",
  "page.links.title": "Bulduğunuz bağlantılar için bir yer.",
  "page.links.subtitle": "Dikkatinizi çekenleri saklayın.",
  "page.feed.title": "Size ait hissettiren bir akış.",
  "page.feed.topicTitle": "{topic}, sizin kurallarınızla.",
  "page.feed.subtitle":
    "Takip ettiğiniz kişilerden haberdar olun. Gürültüyü geride bırakın.",
  "action.addCreator": "Üretici ekle",
  "action.dismissError": "Hatayı kapat",

  // Creators page
  "creators.heading": "Üreticileriniz",
  "creators.platforms": "YouTube, X, Instagram, TikTok ve daha fazlası",
  "creators.accounts": {
    one: "{count} bağlı hesap",
    other: "{count} bağlı hesap",
  },
  "creators.updated": "Güncellendi: {date}",
  "creators.ready": "Eşitlemeye hazır",
  "creators.manage": "Üreticiyi yönet",
  "creators.notificationsOn": "Bildirimler açık",
  "creators.notificationsMuted": "Bildirimler sessize alındı",
  "creators.muteNotifications": "{name} için bildirimleri sessize al",
  "creators.unmuteNotifications": "{name} için bildirimleri aç",
  "creators.emptyTitle": "Takip etmeyi sevdiğiniz biriyle başlayın.",
  "creators.emptyText":
    "Bir YouTube, X, Instagram, TikTok, Patreon veya LinkedIn üreticisi ekleyin, birkaç konu verin ve bu alanı kendinize göre şekillendirin.",

  // Feed toolbar and filters
  "feed.filters": "Filtreler",
  "feed.refreshing": "Yenileniyor…",
  "feed.refresh": "Yenile",
  "feed.search": "Akışınızda arayın",
  "feed.publicationTime": "Yayın zamanı",
  "time.All": "Tümü",
  "time.1d": "1g",
  "time.2d": "2g",
  "time.3d": "3g",
  "time.5d": "5g",
  "time.1w": "1hf",
  "time.1w+": "1hf+",
  "time.olderThanWeek": "Bir haftadan eski",
  "time.anyTime": "Herhangi bir zaman",
  "time.within": "Son {range} içinde",
  "feed.removed": "İçerik kaldırıldı.",
  "feed.undo": "Geri al",
  "filters.contentType": "İçerik türü",
  "filters.creators": "Üreticiler",
  "filters.inTopic": "{topic} içinde",
  "filters.allCreators": "Bu konudaki tüm üreticiler",
  "filters.noCreators": "Tüm üreticilerin seçimini kaldır",
  "filters.noCreatorsInTopic": "Bu konuda üretici yok.",
  "filters.uncheckHint":
    "Hariç tutmak istediğiniz üreticilerin işaretini kaldırın.",
  "filters.reset": "Filtreleri sıfırla",
  "filter.youtube:video": "YT videoları",
  "filter.youtube:short": "YT Shorts",
  "filter.youtube:community": "YT topluluk",
  "filter.x:post": "X gönderileri / yeniden paylaşımlar",
  "filter.instagram:post": "IG gönderileri / albümler",
  "filter.instagram:video": "IG videoları",
  "filter.instagram:short": "IG Reels",
  "filter.tiktok:video": "TikTok videoları",
  "filter.patreon:post": "Patreon gönderileri",
  "filter.linkedin:post": "LinkedIn gönderileri",
  "feed.sources": "Kaynaklarınız",
  "feed.chronological": "· Kronolojik",
  "feed.markRead": "Bunları okundu olarak işaretle",
  "feed.attention": "Bazı kaynaklar ilgi bekliyor.",
  "feed.syncDetails": "Üretici eşitleme ayrıntılarını gör",
  "feed.loading": "Çalışma alanınız yükleniyor…",
  "feed.emptyTitle": "Burada henüz bir şey yok.",
  "feed.emptyText":
    "Herkese açık gönderileri getirmek için yenileyin veya filtrelerinizi değiştirin.",
  "feed.emptyAction": "Akışı yenile",
  "feed.startTitle": "Akışınız bir kişiyle başlar.",
  "feed.startText":
    "İlk üreticinizi ekleyin. Öneri yok, sonsuz kaydırma yok; yalnızca seçtiğiniz kişiler.",
  "feed.startAction": "İlk üreticinizi ekleyin",
  "feed.showMore": "24 gönderi daha göster",
  "feed.remaining": "{count} kaldı",
  "feed.end": "Sona ulaştınız.",
  "feed.caughtUp": "Hepsini gördünüz.",
  "feed.goMake": "Gidin bir şeyler üretin. Akışınız burada olacak.",
  "feed.sourceNote":
    "Yalnızca herkese açık içerik. YouTube yüklemeleri ve topluluk gönderileri, ayrıca erişilebilen X, Instagram, TikTok ve LinkedIn gönderileri. X'in herkese açık anlık görüntüleri yeni gönderileri atlayabilir. ≈ Yaklaşık tarih; tarihi olmayan gönderiler en sonda görünür. OpenFeed reklam veya öneri eklemez.",
  "empty.promiseApproved": "Onayladığınız kişiler",
  "empty.promiseFinite": "Sonu olan bir akış",
  "empty.promiseTopics": "Kendi konularınız",

  // Read status and order
  "status.label": "Okunma durumu",
  "status.all": "Tüm gönderiler",
  "status.unread": "Okunmamış",
  "status.read": "Okunmuş",
  "order.label": "İçerik sırası",
  "order.newest": "En yeniden en eskiye",
  "order.oldest": "En eskiden en yeniye",

  // Post cards
  "post.dateTikTok": "TikTok video kimliğinden tahmini tarih",
  "post.dateYouTube": "YouTube’un göreli zaman bilgisinden tahmini tarih",
  "post.unsave": "Kaydedilenlerden çıkar",
  "post.save": "Sonraya kaydet",
  "post.view": "Görüntüle: {title}",
  "post.images": "{count} görsel",
  "post.locked": "Kilitli",
  "post.isRead": "Okundu",
  "post.markRead": "Okundu olarak işaretle",
  "post.remove": "İçeriği kaldır",
  "post.removeTitle": "Akıştan kaldır",

  // Post labels
  "label.xRepost": "X Yeniden Paylaşım",
  "label.xPost": "X Gönderisi",
  "label.instagramReel": "Instagram Reel",
  "label.instagramVideo": "Instagram Videosu",
  "label.instagramPost": "Instagram Gönderisi",
  "label.tiktokVideo": "TikTok Videosu",
  "label.patreonPost": "Patreon Gönderisi",
  "label.linkedinPost": "LinkedIn Gönderisi",
  "label.youtubeShorts": "YouTube Shorts",
  "label.youtubeCommunity": "YouTube Topluluk",
  "label.youtubeVideo": "YouTube Videosu",

  // Relative time
  "time.unavailable": "Tarih bilinmiyor",
  "time.justNow": "az önce",
  "time.y": "{count} yıl önce",
  "time.mo": "{count} ay önce",
  "time.d": "{count} gün önce",
  "time.h": "{count} sa önce",
  "time.m": "{count} dk önce",

  // Sync types
  "sync.video": "Videolar",
  "sync.short": "Shorts",
  "sync.community": "Topluluk gönderileri",
  "sync.post": "Gönderiler",
  "sync.repost": "Yeniden paylaşımlar",
  "sync.reels": "Reels",
  "sync.from": "{platform} kaynağından eşitlenecek içerik",
  "sync.paused": "Bu kaynak için eşitleme duraklatıldı",

  // Creator modal
  "modal.close": "Kapat",
  "modal.eyebrow": "KÖŞENİZİ DÜZENLEYİN",
  "modal.editTitle": "Üreticinizle tanışın.",
  "modal.newTitle": "Takip etmeye değer biri.",
  "modal.intro": "Tek kişi. Tüm hesapları. Sizin seçiminiz.",
  "modal.source": "Kaynak",
  "modal.account.x": "X hesabı",
  "modal.account.instagram": "Instagram hesabı",
  "modal.account.tiktok": "TikTok hesabı",
  "modal.account.patreon": "Patreon üreticisi",
  "modal.account.linkedin": "LinkedIn profili",
  "modal.account.youtube": "YouTube kanalı",
  "modal.placeholder.x": "@kullanıcıadı veya bir X profil URL'si",
  "modal.placeholder.instagram":
    "@kullanıcıadı veya bir Instagram profil URL'si",
  "modal.placeholder.tiktok": "@kullanıcıadı veya bir TikTok profil URL'si",
  "modal.placeholder.patreon": "Üretici adı veya bir Patreon profil URL'si",
  "modal.placeholder.youtube": "@mkbhd veya bir YouTube kanal URL'si",
  "modal.hint.patreon":
    "Üye gönderileri sunucunun Patreon oturumunu kullanır; diğer hesaplar herkese açık önizlemeleri görür.",
  "modal.hint.public":
    "Yalnızca herkese açık hesaplar. Platform erişimi engelleyebilir; aşağıdaki kaynak ayrıntılarına bakın.",
  "modal.hint.youtube":
    "Yalnızca herkese açık kanallar. Oturum açma veya API anahtarı gerekmez.",
  "modal.displayName": "Görünen ad",
  "modal.optional": "(isteğe bağlı)",
  "modal.displayNamePlaceholder": "Kanal adını kullan",
  "modal.topics": "Konular",
  "modal.topicsPlaceholder": "Teknoloji, Tasarım, Öğrenme",
  "modal.topicsHint":
    "Konuları virgülle ayırın. Bir üretici birden fazla konuya ait olabilir.",
  "modal.notifications": "Yeni içerik bildirimleri",
  "modal.notificationsHint":
    "Bu üreticiyi saatlik yenileme bildirimlerine dahil et.",
  "modal.youtubeOptional": "YouTube kanalı (isteğe bağlı)",
  "modal.youtubePlaceholder": "@kullanıcıadı veya bir YouTube kanal URL'si",
  "modal.publicContent": "Herkese açık içerik",
  "modal.youtubeHint":
    "Nelerin getirileceğini seçin. Mevcut gönderiler ve notlar korunur.",
  "modal.xLabel": "X kullanıcı adı veya profil URL'si",
  "modal.xHint":
    "Sınırlı herkese açık görüntü: X eski gönderileri döndürüp yenilerini atlayabilir. Oturum açma gerekmez.",
  "modal.instagramLabel": "Instagram kullanıcı adı veya profil URL'si",
  "modal.instagramHint":
    "Giriş gerekmez. Herkese açık profil yerleştirmeleri genellikle 6 gönderilik küçük bir önizleme gösterir. Gönderiler albümleri, Shorts ise Reels'i kapsar. Bazı profiller yerleştirmeyi kapatır.",
  "modal.otherAccounts": "Diğer hesaplar",
  "modal.otherPlaceholder": "Kullanıcı adı veya profil URL'si",
  "modal.tiktokHint":
    "Herkese açık videolar yenilemede eşitlenir. TikTok erişimi kısıtlayabilir.",
  "modal.linkedinHint":
    "Yalnızca herkese açık profil, oturum açılmaz. LinkedIn yaklaşık 5 yeni gönderi gösterir; yeniden paylaşımlar ve yorumlar dahil değildir.",
  "modal.patreonPhoneHint":
    "Telefon kısayolunuzdan eşitlendi. Okunmamış gönderiler siz okuyana kadar kalır.",
  "modal.patreonHint":
    "Son birkaç günün gönderileri yenilemede eşitlenir. Okunmamış gönderiler siz okuyana kadar kalır.",
  "modal.confirmUnfollow": "Takipten çıkmayı ve gönderileri silmeyi onayla",
  "modal.unfollow": "Takipten çık",
  "modal.saving": "Kaydediliyor…",
  "modal.save": "Değişiklikleri kaydet",
  "modal.follow": "Üreticiyi takip et",

  // Auth
  "auth.signupIntro": "Seçtiğiniz içerikler için kişisel bir alan.",
  "auth.loginIntro": "Kişisel akışınıza tekrar hoş geldiniz.",
  "auth.username": "Kullanıcı adı",
  "auth.password": "Parola",
  "auth.passwordHint": "En az 12 karakter.",
  "auth.setupToken": "Çalışma alanı kurulum anahtarı",
  "auth.setupTokenHint":
    "Mevcut çalışma alanını sahiplenmek için sunucu yapılandırmanızdaki OPENFEED_SETUP_TOKEN değerini kullanın.",
  "auth.usernameHint": "3–40 harf, rakam, nokta, tire veya alt çizgi.",
  "auth.createThisAccount": "Bu kullanıcı adıyla hesap oluştur",
  "auth.wait": "Lütfen bekleyin…",
  "auth.createAccount": "Hesap oluştur",
  "auth.login": "Giriş yap",
  "auth.toLogin": "Zaten hesabınız var mı? Giriş yapın",
  "auth.toSignup": "Hesap oluşturun",

  // Library
  "library.playlistsHeading": "Oynatma listeleriniz",
  "library.linksHeading": "Bağlantılarınız",
  "library.playlistsIntro":
    "Bir YouTube oynatma listesi ekleyin ve kendi hızınızda izleyin.",
  "library.linksIntro":
    "Bir YouTube, X, Instagram, TikTok veya LinkedIn içerik bağlantısı yapıştırın.",
  "library.kept": "Buradaki öğeler ne kadar eski olursa olsun saklanır.",
  "library.playlistLink": "Oynatma listesi bağlantısı",
  "library.contentLink": "İçerik bağlantısı",
  "library.importing": "İçe aktarılıyor…",
  "library.addPlaylist": "Oynatma listesi ekle",
  "library.addLink": "Bağlantı ekle",
  "library.videos": { one: "{count} video", other: "{count} video" },
  "library.refreshPlaylist": "Oynatma listesini yenile",
  "library.removePlaylist": "Oynatma listesini kaldır",
  "library.undatedLinks":
    "Eklenme tarihi bilinmeyen öğeler, özgün sıralarıyla en sonda görünür.",
  "library.undatedPlaylist":
    "Yayın tarihi bilinmeyen öğeler, özgün sıralarıyla en sonda görünür.",
  "library.showMore": "Daha fazla göster · {count} kaldı",
  "library.noMatch": "Bu filtreyle eşleşen video yok.",
  "library.selectPlaylist":
    "Videolarını görmek için bir oynatma listesi ekleyin veya seçin.",
  "library.emptyLinks": "Eklediğiniz bağlantılar burada görünecek.",

  // Link actions
  "link.copyTitle": "Kaynak bağlantısını kopyala",
  "link.copied": "Kopyalandı",
  "link.copy": "Bağlantıyı kopyala",
  "link.openTitle": "Kaynağı yeni sekmede aç",
  "link.open": "Kaynağı aç",
  "link.copyThis": "Bu bağlantıyı kopyalayın",
  "link.source": "Kaynak bağlantısı",

  // Install
  "install.button": "Uygulamayı yükle",
  "install.help":
    "iPhone veya iPad'de Safari ile açın, Paylaş'a ve ardından Ana Ekrana Ekle'ye dokunun. Android'de tarayıcı menüsünden Uygulamayı yükle veya Ana ekrana ekle'yi seçin.",

  // Notifications
  "notifications.on": "Bildirimler: Açık",
  "notifications.off": "Bildirimler: Kapalı",
  "notifications.blocked": "Bildirimler: Engellendi",
  "notifications.updating": "Güncelleniyor…",
  "notifications.iosInstallHelp":
    "iPhone veya iPad'de bildirimleri açmak için OpenFeed'i Ana Ekrana ekleyin (Paylaş → Ana Ekrana Ekle) ve uygulamayı oradan açın.",
  "notifications.deniedHelp":
    "Bu site için bildirimler engellenmiş. Tarayıcı veya cihaz ayarlarınızdan izin verip tekrar deneyin.",
  "notifications.permissionNeeded":
    "Saatlik yenileme özetlerini almak için istendiğinde bildirim izni verin.",

  // Notes
  "notes.saved": "Kaydedildi",
  "notes.saving": "Kaydediliyor…",
  "notes.unsaved": "Kaydedilmedi",
  "notes.draftKept": "{message} Taslağınız bu tarayıcıda saklanıyor.",
  "notes.heading": "Notlarınız",
  "notes.intro": "Bir düşünce, bir soru, saklanacak bir şey.",
  "notes.addTimestamp": "Geçerli zaman damgasını ekle",
  "notes.label": "İçerik notları",
  "notes.placeholder": "Dikkatinizi ne çekti?",
  "notes.autosaved": "Yerel olarak otomatik kaydedildi · {count}/{max}",
  "notes.saveNow": "Şimdi kaydet",
  "notes.jump": "BİR NOTA ATLA",

  // Phone sync
  "phone.copy": "Kopyala: {label}",
  "phone.loadError": "Telefon eşitlemesi yüklenemedi.",
  "phone.setup": "Telefon eşitleme kurulumu",
  "phone.saveFirst":
    "Önce bu üreticiyi kaydedin, ardından telefon eşitleme kurulumunu yeniden açın.",
  "phone.lookupIntro":
    "Sunucu bu üreticiyi aramak için Patreon'a ulaşamıyor, bu yüzden kampanya kimliğini bir kez girin. Aramayı bir tarayıcıda açın ve şunun ardından gelen sayıyı kopyalayın:",
  "phone.openLookup": "Patreon aramasını aç",
  "phone.campaignId": "Patreon kampanya kimliği",
  "phone.campaignPlaceholder": "ör. 6460488",
  "phone.saveCampaign": "Kampanya kimliğini kaydet",
  "phone.lastUpload": "Son telefon yüklemesi: {date}.",
  "phone.noUpload": "Henüz telefon yüklemesi yok.",
  "phone.explain":
    "Kısayol, en son Patreon gönderilerini telefonunuzun oturumuyla indirir ve buraya yükler.",
  "phone.patreonUrl": "1 · Patreon URL'si",
  "phone.uploadUrl": "2 · OpenFeed yükleme URL'si",
  "phone.header": "3 · Authorization başlık değeri (bir kez gösterilir)",
  "phone.tokenExists":
    "Bir telefon anahtarı zaten var. Yenisini oluşturmak eskisinin yerini alır.",
  "phone.tokenCreate":
    "Kısayolun Authorization başlığı için bir anahtar oluşturun.",
  "phone.replaceToken": "Telefon anahtarını değiştir",
  "phone.createToken": "Telefon anahtarı oluştur",

  // Viewer
  "viewer.tiktokError":
    "TikTok bu videoyu oynatamadı. Tekrar deneyin veya kaynağı açın.",
  "viewer.embedDisabled":
    "Bu üretici yerleşik oynatmayı kapatmış. YouTube'da izlemek için Kaynağı aç'ı kullanın.",
  "viewer.unavailable": "Bu video kullanılamıyor veya gizli.",
  "viewer.youtubeError":
    "YouTube bu videoyu oynatamadı (hata {code}). Tekrar deneyin veya kaynağı açın.",
  "viewer.playButtonHint":
    "Oynatmayı başlatmak için videonun oynat düğmesini kullanın.",
  "viewer.noCaptions": "Bu videoda kullanılabilir altyazı yok.",
  "viewer.captionsHint":
    "Altyazı olup olmadığı videoya bağlıdır. Altyazı görünmezse oynatıcının CC düğmesini kullanın.",
  "viewer.playerFocused":
    "Oynatıcı odakta. Altyazıları açıp kapatmak için C'ye basın.",
  "viewer.close": "Görüntüleyiciyi kapat",
  "viewer.exitFullscreen": "Tam ekrandan çık",
  "viewer.fullscreenVideo": "Videoyu tam ekran yap",
  "viewer.fullscreenImage": "Görseli tam ekran yap",
  "viewer.tiktokFallback":
    "TikTok’un yerleşik oynatıcısı kullanılıyor. Bu oynatıcıda hız ayarları yok.",
  "viewer.videoError":
    "Bu video yüklenemedi. Tekrar deneyin veya kaynağı açın.",
  "viewer.selectVideo": "Video seç",
  "viewer.videoN": "Video {n}",
  "viewer.loadingVideo": "Video yükleniyor…",
  "viewer.retryPlayer": "Oynatıcıyı yeniden dene",
  "viewer.position": "Oynatma konumu",
  "viewer.rewind": "5 saniye geri sar",
  "viewer.pauseVideo": "Videoyu duraklat",
  "viewer.playVideo": "Videoyu oynat",
  "viewer.pause": "Duraklat",
  "viewer.play": "Oynat",
  "viewer.forward": "5 saniye ileri sar",
  "viewer.toggleCaptions": "Altyazıları aç/kapat",
  "viewer.captions": "Altyazılar",
  "viewer.speed": "Oynatma hızı",
  "viewer.tiktokSpeed": "TikTok’un yerleşik oynatıcısında hız ayarı yok.",
  "viewer.imageError": "Bu görsel yüklenemedi.",
  "viewer.retryImage": "Görseli yeniden dene",
  "viewer.imageAlt": "{name} gönderisi, görsel {n}/{total}",
  "viewer.previousImage": "Önceki görsel",
  "viewer.nextImage": "Sonraki görsel",
  "viewer.showImage": "{n}. görseli göster",
  "viewer.instagramNoVideo":
    "Instagram bu gönderi için oynatılabilir bir video sunmadı. İzlemek için Kaynağı aç'ı kullanın.",
  "viewer.hideNotes": "Notları gizle",
  "viewer.notes": "Notlar",
  "viewer.xTruncated": "X kısaltılmış bir önizleme döndürdü.",
  "viewer.xReadFull": "Gönderinin tamamını X'te okuyun",
  "viewer.locked": "Bu gönderi bu hesap için kilitli.",
  "viewer.openPatreon": "Patreon'da açın",
  "viewer.swipe": "İçeriği değiştirmek için burada sola / sağa kaydırın",
  "viewer.previousContent": "Önceki içerik",
  "viewer.previous": "Önceki",
  "viewer.nextContent": "Sonraki içerik",
  "viewer.next": "Sonraki",
  "viewer.count": "{n} / {total}",
  "viewer.keyContent": "içerik",
  "viewer.keySeek": "5 sn sar",
  "viewer.keyImages": "görseller",
  "viewer.keySpace": "Boşluk",
  "viewer.keyPlay": "oynat",
  "viewer.keyCaptions": "altyazılar",
  "viewer.keyClose": "kapat",
  "viewer.iframeHelp":
    "Akış kısayollarını kullanmak için başlığa tıklayın. Oynatıcının içinde tuşları YouTube yönetir. Not yazarken kısayollar duraklatılır.",
};
