import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const Ctx = createContext(null);
export const useInstall = () => useContext(Ctx);

const DISMISS = 'ddt.install.dismissed';
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isMobile = () =>
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || window.matchMedia('(max-width: 760px)').matches;

export function InstallProvider({ children }) {
  const [evt, setEvt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => {
    try { return Date.now() - Number(localStorage.getItem(DISMISS) || 0) < 7 * 864e5; } catch { return false; }
  });

  useEffect(() => {
    const onPrompt = e => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!evt) return false;
    evt.prompt();
    const { outcome } = await evt.userChoice;
    setEvt(null);
    return outcome === 'accepted';
  }, [evt]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS, String(Date.now())); } catch { /* ignore */ }
    setDismissed(true);
  }, []);

  const value = { installed, canPrompt: Boolean(evt), promptInstall, dismissed, dismiss, ios: isIOS() };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Bottom sheet that invites mobile-browser users to install the app. */
export function InstallBanner({ show }) {
  const { installed, canPrompt, promptInstall, dismissed, dismiss, ios } = useInstall();
  if (!show || installed || dismissed || !isMobile()) return null;
  return (
    <div className="install" role="dialog" aria-label="Install app">
      <img src="assets/icon-192.png" alt="" />
      <div className="grow">
        <b>Install DD_Treasure26</b>
        {canPrompt
          ? <small>Add it to your home screen for faster shopping and order updates.</small>
          : ios
            ? <small>Tap <b>Share</b> then <b>Add to Home Screen</b>.</small>
            : <small>Open the browser menu <b>⋮</b> then <b>Install app</b> / <b>Add to Home screen</b>.</small>}
      </div>
      {canPrompt && <button className="btn small" onClick={promptInstall}>Install</button>}
      <button className="link" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
