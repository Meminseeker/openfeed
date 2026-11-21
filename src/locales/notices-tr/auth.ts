import type { authNotices } from "../../notices/auth.ts";

export const authNoticesTr: Record<keyof typeof authNotices, string> = {
  "auth.invalidUsername":
    "Kullanıcı adı 3–40 karakter olmalı ve yalnızca harf, rakam, nokta, tire veya alt çizgi içermelidir.",
  "auth.invalidPassword": "Parola 12–128 karakter olmalıdır.",
  "auth.noAccount":
    "“{username}” kullanıcı adıyla bir hesap yok. Yazımı kontrol edin veya önce bir hesap oluşturun.",
  "auth.wrongPassword": "“{username}” için parola yanlış.",
  "auth.usernameTaken": "Bu kullanıcı adı zaten kullanılıyor.",
  "auth.claimRequired":
    "Kayıt açılmadan önce sahibinin mevcut çalışma alanını OPENFEED_SETUP_TOKEN ile sahiplenmesi gerekir.",
  "auth.tooManyAttempts":
    "Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin.",
  "auth.accountChangedLogout":
    "Hesabınız değişti. Çıkış yapmadan önce sayfayı yenileyin.",
  "auth.accountChangedSave":
    "Hesabınız değişti. Kaydetmeden önce sayfayı yenileyin.",
  "auth.loginRequired": "Lütfen giriş yapın.",
};
