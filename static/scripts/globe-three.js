// ----------------------------------------
// Purpose:
//   - Render a 3D Earth using Three.js and plot interactive pins at given coordinates
//   - Handle raycasting on pins and the globe surface to interact with DOM elements/form fields
//
// Imports Summary:
//   - THREE, OrbitControls: core Three.js library and camera controls
//   - highlightElement: utility to flash/highlight a DOM element
//
// High-level Overview:
//   • Sets up scene, camera, renderer, and lights
//   • Defines functions to:
//       - Convert lat/lng to 3D coordinates and vice versa
//       - Create and clear pins on the globe
//       - Handle pointer clicks (select pin vs select globe surface)
//       - Animate camera and handle window resize
//       - Rotate/zoom/position camera to focus on a lat/lng (findOnThreeGlobe)
// ----------------------------------------

import * as THREE from "../vendor/three/three.module.js";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { highlightElement } from './utility.js';

(() => {
  // ----------------------------------------
  // Canvas, Scene, and Camera Setup
  // ----------------------------------------
  const canvas = document.getElementById("threeGlobeCanvas");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 3);

  // ----------------------------------------
  // Renderer Setup
  // ----------------------------------------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  // ----------------------------------------
  // OrbitControls Setup
  // ----------------------------------------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableZoom = true;
  controls.enablePan = false;
  controls.rotateSpeed = 0.7;
  controls.target.set(0, 0, 0);
  controls.update();

  // ----------------------------------------
  // Lights
  // ----------------------------------------
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(5, 3, 5);
  scene.add(dirLight);

  // ----------------------------------------
  // Earth Mesh
  // ----------------------------------------
  const RADIUS = 1;
  const earthGeom = new THREE.SphereGeometry(RADIUS, 64, 64);
  const earthTex = new THREE.TextureLoader().load(
    "static/assets/images/2k_earth_daymap.jpg"
  );
  const earthMat = new THREE.MeshPhongMaterial({
    map: earthTex,
    specular: 0x222222,
    shininess: 5,
  });
  const earthMesh = new THREE.Mesh(earthGeom, earthMat);
  scene.add(earthMesh);

  // ----------------------------------------
  // Conversion Functions: Lat/Lng and Vector3
  // ----------------------------------------
  /**
   * Convert geographic latitude/longitude to a 3D Vector on a sphere.
   * @param {number} lat   - Latitude in degrees
   * @param {number} lon   - Longitude in degrees
   * @param {number} radius - Sphere radius
   * @returns {THREE.Vector3} 3D coordinates on sphere
   */
  function latLonToVector3(lat, lon, radius) {
    const φ = (lat * Math.PI) / 180;
    const θ = (lon * Math.PI) / 180;
    const cosφ = Math.cos(φ);
    const x = radius * cosφ * Math.cos(θ);
    const y = radius * Math.sin(φ);
    const z = -radius * cosφ * Math.sin(θ);
    return new THREE.Vector3(x, y, z);
  }

  /**
   * Convert a 3D Vector on the sphere to geographic latitude/longitude.
   * @param {THREE.Vector3} v - Vector on the sphere
   * @returns {{lat: number, lon: number}}  Object with lat/lon in degrees
   */
  function vector3ToLatLon(v) {
    const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    const latRad = Math.asin(THREE.MathUtils.clamp(v.y / r, -1, 1));
    const lonRad = Math.atan2(-v.z, v.x);
    const lat = (latRad * 180) / Math.PI;
    const lon = (lonRad * 180) / Math.PI;
    return { lat, lon };
  }

  // ----------------------------------------
  // Pin Management
  // ----------------------------------------
  const pinsGroup = new THREE.Group();
  scene.add(pinsGroup);

  /**
   * Create a pin (sphere + cylinder) at given lat/lon and return as a Group.
   *
   * @param {string|number} id       - Unique identifier for this pin
   * @param {number} lat             - Latitude
   * @param {number} lon             - Longitude
   * @param {number} [color=0xff0000] - Hex color for pin material
   * @param {string} [message=""]    - Associated message text
   * @returns {THREE.Group} Group containing head and stem meshes
   */
  function createPin(id, lat, lon, color = 0xff0000, message = "") {
    // Position slightly above the surface
    const pos = latLonToVector3(lat, lon, RADIUS + 0.01);
    const pinGroup = new THREE.Group();

    // Pin Head
    const headGeom = new THREE.SphereGeometry(0.015, 8, 8);
    const headMat = new THREE.MeshPhongMaterial({ color });
    const headMesh = new THREE.Mesh(headGeom, headMat);
    headMesh.position.copy(pos.clone().multiplyScalar(1.005));
    pinGroup.add(headMesh);

    // Pin Stem
    const stemHeight = 0.05;
    const stemGeom = new THREE.CylinderGeometry(0.003, 0.003, stemHeight, 6);
    const stemMat = new THREE.MeshBasicMaterial({ color });
    const stemMesh = new THREE.Mesh(stemGeom, stemMat);

    // Align cylinder so it extends outward from the globe
    const surfacePt = latLonToVector3(lat, lon, RADIUS);
    const dir = surfacePt.clone().normalize();
    const midPt = surfacePt.clone().add(dir.clone().multiplyScalar(stemHeight / 2));
    stemMesh.position.copy(midPt);
    stemMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir
    );
    pinGroup.add(stemMesh);

    // Store metadata for raycasting
    pinGroup.userData = {
      id,
      lat,
      lon,
      message
    };
    return pinGroup;
  }

  /**
   * Remove all pins from the globe and free resources.
   */
  function clearPins() {
    while (pinsGroup.children.length) {
      const c = pinsGroup.children.shift();
      pinsGroup.remove(c);
      if (c.geometry) {
        c.geometry.dispose()
      };
      if (c.material) {
        c.material.dispose()
      };
    }
  }

  /**
   * Given an array of point objects {id, lat, lng, color, message},
   * create and add each pin to the globe.
   *
   * @param {Array} points - Array of pin data
   */
  function plotPins(points) {
    clearPins();
    points.forEach((p) => {
      const pin = createPin(
        p.id,
        p.lat, 
        p.lng, 
        p.color || 0xff0000,
        p.message);
      pinsGroup.add(pin);
    });
  }
  window.plotPinsOnThreeGlobe = plotPins;

  // ----------------------------------------
  // Raycasting and “Click on Earth” Handler
  // ----------------------------------------
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  /**
   * Handle pointerdown events: first check if a pin was clicked,
   * if yes, scroll the matching DOM message into view and highlight it.
   * Otherwise, if the earth surface is clicked, update lat/lng inputs.
   *
   * @param {MouseEvent} event
   */
  function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Pin intersection
    const pinHits = raycaster.intersectObjects(pinsGroup.children, true);
    if (pinHits.length > 0) {
      const hitPin = pinHits[0].object.parent;
      const {id, lat, lon} = hitPin.userData;
      
      // Scroll to message in DOM
      const msgElement = document.getElementById(`message-${id}`);
      if (msgElement) {
        msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight element
        highlightElement(msgElement, 2000);

      } else {
        console.warn(`Could not find DOM element for message-${id}`);
      }

      // Move camera to focus on this lat/lon
      findOnThreeGlobe(lat, lon);
      return;
    }

    // Check for earth surface intersection
    const earthHits = raycaster.intersectObject(earthMesh);
    if (earthHits.length > 0) {
      const pt = earthHits[0].point;
      const { lat, lon } = vector3ToLatLon(pt);
      const absLat = Math.abs(lat).toFixed(4);
      const absLon = Math.abs(lon).toFixed(4);

      // Update input fields
      document.getElementById("latDeg").value = absLat;
      document.getElementById("latDir").value = lat < 0 ? "S" : "N";
      document.getElementById("lngDeg").value = absLon;
      document.getElementById("lngDir").value = lon < 0 ? "W" : "E";
      document.getElementById("msg").focus();
    }
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);

  // ----------------------------------------
  // Animation Loop
  // ----------------------------------------
  /**
   * Main render loop. Updates controls and renders scene.
   */
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // ----------------------------------------
  // Resize Handling
  // ----------------------------------------
  /**
   * Handle window resize: adjust camera aspect and renderer size.
   */
  function onWindowResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener("resize", onWindowResize);
  onWindowResize();

  // ----------------------------------------
  // Camera Animation to Focus on Lat/Lon
  // ----------------------------------------
  /**
   * Smoothly move camera to point directly over (lat, lon).
   *
   * @param {number} lat - target latitude
   * @param {number} lon - target longitude
   */
  function findOnThreeGlobe(lat, lon) {
    // Compute target positions
    const camPos  = latLonToVector3(lat, lon, RADIUS * 2);
    const fromCam = camera.position.clone();
    const fromTarget = controls.target.clone();
    const toTarget   = new THREE.Vector3(0, 0, 0);

    // Set up animiation options
    const start = performance.now();
    const duration = 800;

    // Animation
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t * t * (3 - 2 * t);

      // Interpolate camera and target positions
      camera.position.lerpVectors(fromCam, camPos, ease);
      controls.target.lerpVectors(fromTarget, toTarget, ease);
      controls.update();
      if (t < 1) {
        requestAnimationFrame(step)
      };
    }

    requestAnimationFrame(step);
  }
  window.findOnThreeGlobe = findOnThreeGlobe;
})();
