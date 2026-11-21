import { useEffect, useState } from "react";
import { useI18n } from "./LocaleProvider";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function InstallApp() {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches,
  );
  useEffect(() => {
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (installed) return null;
  return (
    <div className="install-app">
      <button
        onClick={async () => {
          if (!prompt) {
            setHelp(!help);
            return;
          }
          await prompt.prompt();
          await prompt.userChoice;
          setPrompt(null);
        }}
      >
        {t("install.button")}
      </button>
      {help && <p>{t("install.help")}</p>}
    </div>
  );
}
