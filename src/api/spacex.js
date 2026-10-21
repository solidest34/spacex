// Launch Library 2 (The Space Devs) client.
// Docs: https://ll.thespacedevs.com/docs/
//
// The public API is rate limited for anonymous users (roughly 15 requests/hour),
// so everything goes through one cached loader:
//  - launches already contain their `pad` (with latitude/longitude), so launchpads
//    are extracted from the same responses - no extra requests;
//  - the normalized result is cached in localStorage for `ttl` ms;
//  - concurrent calls share a single in-flight request;
//  - if the API fails (e.g. HTTP 429), the stale cache is used when available.

const CACHE_KEY = "spacex:ll2:v1";
const HOUR = 60 * 60 * 1000;

function defaultStorage() {
    try {
        return globalThis.localStorage || null;
    } catch (e) {
        return null; // storage can be blocked by browser settings
    }
}

class SpaceX {

    constructor(baseUrl = "https://ll.thespacedevs.com/2.3.0/", options = {}) {
        this.baseUrl = baseUrl;
        this.ttl = options.ttl ?? HOUR;           // cache lifetime
        this.maxPages = options.maxPages ?? 3;    // 100 launches per page
        this.storage = options.storage === undefined ? defaultStorage() : options.storage;
        this._pending = null;
    }

    launches() {
        return this._load().then(data => data.launches);
    }

    // Task 1: launchpads are extracted from the launches response
    launchpads() {
        return this._load().then(data => data.launchpads);
    }

    launchpad(id) {
        return this.launchpads().then(pads => pads.find(pad => pad.id === id) || null);
    }

    clearCache() {
        this._pending = null;
        try {
            this.storage && this.storage.removeItem(CACHE_KEY);
        } catch (e) { /* ignore */ }
    }

    // ---- internals ----

    _readCache() {
        try {
            const raw = this.storage && this.storage.getItem(CACHE_KEY);
            const cached = raw && JSON.parse(raw);
            return cached && cached.data ? cached : null;
        } catch (e) {
            return null;
        }
    }

    _writeCache(data) {
        try {
            this.storage && this.storage.setItem(CACHE_KEY, JSON.stringify({time: Date.now(), data}));
        } catch (e) { /* quota exceeded / storage blocked: just skip caching */ }
    }

    _load() {
        if (this._pending) return this._pending;

        const cached = this._readCache();
        if (cached && Date.now() - cached.time < this.ttl) {
            this._pending = Promise.resolve(cached.data);
            return this._pending;
        }

        this._pending = this._fetchAll()
            .then(data => {
                this._writeCache(data);
                return data;
            })
            .catch(error => {
                this._pending = null; // allow a retry on the next call
                if (cached) {
                    console.warn("SpaceX API request failed, using stale cache:", error);
                    return cached.data;
                }
                throw error;
            });
        return this._pending;
    }

    async _fetchAll() {
        let url = `${this.baseUrl}launches/previous/?lsp__name=SpaceX&mode=normal&limit=100`;
        const launches = new Map();
        const pads = new Map();

        for (let page = 0; url && page < this.maxPages; page++) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Launch Library API error: ${response.status} ${response.statusText}`);
            }
            const json = await response.json();
            json.results.forEach(item => {
                const pad = item.pad;
                launches.set(item.id, {
                    id: item.id,
                    name: item.name,
                    net: item.net,
                    launchpad: pad ? pad.id : null
                });
                if (pad && pad.latitude != null && pad.longitude != null) {
                    pads.set(pad.id, {
                        id: pad.id,
                        name: pad.name,
                        full_name: pad.location ? `${pad.name}, ${pad.location.name}` : pad.name,
                        latitude: Number(pad.latitude),
                        longitude: Number(pad.longitude)
                    });
                }
            });
            url = json.next ? json.next.replace(/^http:/, "https:") : null;
        }
        return {launches: [...launches.values()], launchpads: [...pads.values()]};
    }

}

export {SpaceX}
