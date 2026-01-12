var l = (t, e, n) => {
    if (!e.has(t))
        throw TypeError("Cannot " + n)
}
;
var s = (t, e, n) => (l(t, e, "read from private field"),
n ? n.call(t) : e.get(t))
  , a = (t, e, n) => {
    if (e.has(t))
        throw TypeError("Cannot add the same private member more than once");
    e instanceof WeakSet ? e.add(t) : e.set(t, n)
}
  , o = (t, e, n, h) => (l(t, e, "write to private field"),
h ? h.call(t, n) : e.set(t, n),
n);
var d = (t, e, n) => (l(t, e, "access private method"),
n);
import {E as C, l as P} from "./log.d0ac6dbb.js";
function v(t, e) {
    var n = typeof e == "object";
    return new Promise(function(h, p) {
        var g = !1, w;
        t.subscribe({
            next: function(b) {
                w = b,
                g = !0
            },
            error: p,
            complete: function() {
                g ? h(w) : n ? h(e.defaultValue) : p(new C)
            }
        })
    }
    )
}
var r, i, c, u, m, f;
class D {
    constructor(e, n) {
        a(this, m);
        a(this, r, void 0);
        a(this, i, void 0);
        a(this, c, void 0);
        a(this, u, void 0);
        if (!e.name)
            throw new Error("port name is required");
        o(this, c, e.name),
        o(this, u, n?.onConnect ?? ( () => {}
        )),
        o(this, r, d(this, m, f).call(this))
    }
    postMessage(e) {
        s(this, i) || o(this, r, d(this, m, f).call(this)),
        s(this, r).postMessage(e)
    }
    get connected() {
        return s(this, i)
    }
    get sender() {
        return s(this, r).sender
    }
    get disconnect() {
        return s(this, r).disconnect
    }
    get onDisconnect() {
        return s(this, r).onDisconnect
    }
    get onMessage() {
        return s(this, r).onMessage
    }
    get name() {
        return s(this, r).name
    }
}
r = new WeakMap,
i = new WeakMap,
c = new WeakMap,
u = new WeakMap,
m = new WeakSet,
f = function() {
    const e = chrome.runtime.connect({
        name: s(this, c)
    });
    return o(this, i, !0),
    P(`chrome port ${s(this, c)} connected`),
    e.onDisconnect.addListener( () => {
        o(this, i, !1),
        P(`chrome port ${s(this, c)} connected`)
    }
    ),
    s(this, u).call(this, e),
    e
}
;
export {D as P, v as l};
