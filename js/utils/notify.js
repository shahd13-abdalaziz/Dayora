// Browser notifications for Dayora: the little pop-ups from the browser, even when the tab is in the background.
//
//   Notify.supported            does this browser have notifications at all?
//   Notify.permission()         "granted" | "denied" | "default" (not asked yet)
//   Notify.enabled()            true only if the browser allows it AND the person did not switch it off in Settings
//   await Notify.enable()       asks the browser for permission (call it from a click: browsers insist on that)
//   Notify.disable()            switches it off for Dayora (the browser's own permission stays as it is)
//   Notify.show(title, body)    shows one, if enabled. Returns true when it was shown.
//
// Notifications need the page to be open in some tab (this is not "push"), and a secure page (https or localhost).

const Notify = (() => {
  const PREF = 'dayora_notify';                                      // "on" | "off" (unset = on, once permission is granted)
  const supported = 'Notification' in window;

  // the logo, found from where this file lives (js/utils/ -> imgs/)
  const icon = new URL('../../imgs/file_00000000322c8210980e21a958c092d7.png', document.currentScript ? document.currentScript.src : location.href).href;

  const permission = () => (supported ? Notification.permission : 'denied');
  const switchedOff = () => { try { return localStorage.getItem(PREF) === 'off'; } catch { return false; } };

  return {
    supported,
    permission,
    enabled: () => supported && permission() === 'granted' && !switchedOff(),

    async enable() {
      if (!supported) return 'denied';
      const result = permission() === 'default' ? await Notification.requestPermission() : permission();
      try { localStorage.setItem(PREF, result === 'granted' ? 'on' : 'off'); } catch { /* private mode: still works for this visit */ }
      return result;
    },

    disable() {
      try { localStorage.setItem(PREF, 'off'); } catch { /* ignore */ }
    },

    /** tag: a second notification with the same tag replaces the first one instead of piling up. */
    show(title, body, { tag } = {}) {
      if (!this.enabled()) return false;
      try {
        const n = new Notification(title, { body, icon, tag });
        n.onclick = () => { window.focus(); n.close(); };           // clicking it brings the tab back
        setTimeout(() => n.close(), 15000);
        return true;
      } catch {
        return false;                                              // some phones only allow notifications from a service worker
      }
    },
  };
})();
