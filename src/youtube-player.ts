export interface YouTubePlayer {
  destroy(): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, ahead: boolean): void;
  getIframe(): HTMLIFrameElement;
  loadModule?(module: string): void;
  unloadModule?(module: string): void;
  getOption?(module: string, option: string): any;
  setOption?(module: string, option: string, value: unknown): void;
}
interface YouTubeAPI {
  Player: new (
    el: HTMLElement,
    config: Record<string, unknown>,
  ) => YouTubePlayer;
}
declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let loading: Promise<YouTubeAPI> | undefined;
export function loadYouTube(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => fail(), 15000);
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      loading = undefined;
      window.onYouTubeIframeAPIReady = previous;
      reject(
        new Error(
          "The YouTube player could not load. Check your connection or open the source.",
        ),
      );
    };
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}
