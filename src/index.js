import {SpaceX} from "./api/spacex";
import * as d3 from "d3";
import * as Geo from './geo.json'
import sampleData from './sample-data.json'

document.addEventListener("DOMContentLoaded", setup)

function setup() {
    const spaceX = new SpaceX();
    Promise.all([spaceX.launches(), spaceX.launchpads()])
        .then(([launches, launchpads]) => render(launches, launchpads))
        .catch(error => {
            // The public API is rate limited and may be unavailable:
            // fall back to bundled sample data so the UI still works.
            console.warn("Launch Library API unavailable, using bundled sample data:", error);
            render(sampleData.launches, sampleData.launchpads, true);
        })
}

function render(launches, launchpads, isSample = false) {
    const listContainer = document.getElementById("listContainer")
    renderLaunches(launches, listContainer);
    drawMap(launchpads);
    if (isSample) {
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "API is unavailable or rate limited - showing sample data.";
        listContainer.before(note);
    }
}

function renderLaunches(launches, container) {
    const list = document.createElement("ul");
    launches.forEach(launch => {
        const item = document.createElement("li");
        item.innerHTML = launch.name;
        // Task 3: highlight the launchpad of this launch while hovering the item
        item.addEventListener("mouseenter", () => highlightLaunchpad(launch.launchpad, true));
        item.addEventListener("mouseleave", () => highlightLaunchpad(launch.launchpad, false));
        list.appendChild(item);
    })
    container.replaceChildren(list);
}

// Task 2: launchpads as GeoJSON points
function launchpadsToGeoJSON(launchpads) {
    return {
        type: "FeatureCollection",
        features: launchpads
            .filter(pad => pad.longitude != null && pad.latitude != null)
            .map(pad => ({
                type: "Feature",
                properties: {id: pad.id, name: pad.full_name || pad.name},
                geometry: {type: "Point", coordinates: [pad.longitude, pad.latitude]}
            }))
    };
}

function highlightLaunchpad(launchpadId, active) {
    if (!launchpadId) return;
    d3.selectAll("circle.launchpad")
        .filter(d => d.properties.id === launchpadId)
        .classed("active", active)
        .attr("r", active ? 8 : 4)
        .raise();
}

function drawMap(launchpads) {
    const width = 640;
    const height = 480;
    const margin = {top: 20, right: 10, bottom: 40, left: 100};
    const svg = d3.select('#map').append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");
    const projection = d3.geoMercator()
        .scale(70)
        .center([0, 20])
        .translate([width / 2 - margin.left, height / 2]);

    svg.append("g")
        .selectAll("path")
        .data(Geo.features)
        .enter()
        .append("path")
        .attr("class", "topo")
        .attr("d", d3.geoPath()
            .projection(projection)
        )
        .attr("fill", "#cccccc")
        .style("opacity", .7)

    const pads = launchpadsToGeoJSON(launchpads);
    svg.append("g")
        .selectAll("circle")
        .data(pads.features)
        .enter()
        .append("circle")
        .attr("class", "launchpad")
        .attr("cx", d => projection(d.geometry.coordinates)[0])
        .attr("cy", d => projection(d.geometry.coordinates)[1])
        .attr("r", 4)
        .append("title")
        .text(d => d.properties.name);
}
