import { useEffect, useState } from "react";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function InstallApp() {
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
        Install app
      </button>
      {help && (
        <p>
          On iPhone or iPad, open in Safari, tap Share, then Add to Home Screen.
          On Android, choose Install app or Add to Home Screen in your browser
          menu.
        </p>
      )}
    </div>
  );
}
