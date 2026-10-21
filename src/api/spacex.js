class SpaceX {

    constructor(baseUrl = "https://api.spacexdata.com/v4/") {
        this.baseUrl = baseUrl;
    }

    _get(path) {
        return fetch(`${this.baseUrl}${path}`).then(response => {
            if (!response.ok) {
                throw new Error(`SpaceX API error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        });
    }

    launches() {
        return this._get("launches");
    }

    // Task 1: methods to extract launchpads
    launchpads() {
        return this._get("launchpads");
    }

    launchpad(id) {
        return this._get(`launchpads/${id}`);
    }

}

export {SpaceX}
