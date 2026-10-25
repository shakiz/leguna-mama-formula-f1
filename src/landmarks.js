// Landmark set pieces along the route (filled in by the landmarks work)
export function spawnLandmark(scene, f, ry) { return false; } // f = feature {type,d,d1?,side?,text?}; true if handled
export function drawLandmarks(road) {}                         // called by RoadRenderer.draw() after the pavements, before kerbs
export function sideTaken(d) { return { left: false, right: false }; } // a landmark occupies that roadside at route distance d
export function landmarkTick(scene, dy) {}                     // per frame, dy = route distance moved
