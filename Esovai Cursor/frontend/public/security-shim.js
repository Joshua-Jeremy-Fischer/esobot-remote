/**
 * Security Shim - laeuft VOR dem Vite/React-Bundle.
 * Faengt SecurityErrors beim cross-origin iframe-Zugriff ab (Base44-Preview).
 */
(function () {
  "use strict";

  function makeWindowProxy(win) {
    if (!win) return win;
    return new Proxy(win, {
      get: function (target, prop) {
        if (prop === "document") {
          try { return target.document; }
          catch (e) {
            if (e.name === "SecurityError") {
              console.warn("[shim] .document blocked->stub");
              return {
                body: null, documentElement: null, head: null,
                getElementById: function () { return null; },
                querySelector: function () { return null; },
                querySelectorAll: function () { return []; },
                addEventListener: function () {}, removeEventListener: function () {},
              };
            }
            throw e;
          }
        }
        try { var v = target[prop]; return typeof v === "function" ? v.bind(target) : v; }
        catch (e) { if (e.name === "SecurityError") return undefined; throw e; }
      }
    });
  }

  function patchContentWindow(Ctor) {
    if (!Ctor) return;
    var d = Object.getOwnPropertyDescriptor(Ctor.prototype, "contentWindow");
    if (!d || typeof d.get !== "function") return;
    var orig = d.get;
    Object.defineProperty(Ctor.prototype, "contentWindow", {
      get: function () {
        try { return makeWindowProxy(orig.call(this)); }
        catch (e) { if (e.name === "SecurityError") return null; throw e; }
      },
      configurable: true
    });
  }

  patchContentWindow(typeof HTMLIFrameElement !== "undefined" ? HTMLIFrameElement : null);
  patchContentWindow(typeof HTMLFrameElement !== "undefined" ? HTMLFrameElement : null);

  function patchWindowRef(prop) {
    var d = Object.getOwnPropertyDescriptor(Window.prototype, prop);
    if (!d || typeof d.get !== "function") return;
    var orig = d.get;
    Object.defineProperty(Window.prototype, prop, {
      get: function () {
        var w;
        try { w = orig.call(this); } catch (e) { return window; }
        if (!w || w === this) return w;
        return makeWindowProxy(w);
      },
      configurable: true,
      enumerable: !!d.enumerable,
    });
  }
  patchWindowRef("parent");
  patchWindowRef("top");

  var origOpen = Window.prototype.open;
  if (typeof origOpen === "function") {
    Window.prototype.open = function () {
      var w = origOpen.apply(this, arguments);
      return makeWindowProxy(w);
    };
  }

  try {
    var mpd = Object.getOwnPropertyDescriptor(MessagePort.prototype, "onmessage");
    if (mpd && mpd.set) {
      var origSet = mpd.set;
      Object.defineProperty(MessagePort.prototype, "onmessage", {
        set: function (fn) {
          origSet.call(this, function (e) {
            try { fn.call(this, e); }
            catch (err) {
              if (err.name === "SecurityError") { console.warn("[shim] MessagePort SecurityError suppressed"); }
              else { throw err; }
            }
          });
        },
        get: mpd.get,
        configurable: true
      });
    }
  } catch (_) {}

  (function patchMessagePortEvents() {
    var wrapMap = new WeakMap();
    var origAdd = MessagePort.prototype.addEventListener;
    var origRemove = MessagePort.prototype.removeEventListener;
    if (typeof origAdd !== "function") return;

    MessagePort.prototype.addEventListener = function (type, listener, options) {
      if (type === "message" && typeof listener === "function") {
        var wrapped = wrapMap.get(listener);
        if (!wrapped) {
          wrapped = function (ev) {
            try { return listener.call(this, ev); }
            catch (err) {
              if (err && err.name === "SecurityError") {
                console.warn("[shim] MessagePort message listener SecurityError suppressed");
                return;
              }
              throw err;
            }
          };
          wrapMap.set(listener, wrapped);
        }
        return origAdd.call(this, type, wrapped, options);
      }
      return origAdd.call(this, type, listener, options);
    };

    if (typeof origRemove === "function") {
      MessagePort.prototype.removeEventListener = function (type, listener, options) {
        if (type === "message" && typeof listener === "function" && wrapMap.has(listener)) {
          return origRemove.call(this, type, wrapMap.get(listener), options);
        }
        return origRemove.call(this, type, listener, options);
      };
    }
  })();

  var PATTERNS = ["cross-origin", "blocked a frame", "failed to read a named property"];
  function isFrameErr(msg, err) {
    if (err && err.name === "SecurityError") return true;
    if (!msg) return false;
    var l = msg.toLowerCase();
    return PATTERNS.some(function (p) { return l.indexOf(p) !== -1; });
  }
  window.addEventListener("error", function (e) {
    if (isFrameErr(e.message, e.error)) {
      e.preventDefault(); e.stopImmediatePropagation();
      console.warn("[shim] global SecurityError suppressed");
      return true;
    }
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    if (e.reason && isFrameErr(e.reason.message, e.reason)) { e.preventDefault(); }
  });
})();
