// ----------------------------------------
// Purpose:
//   - Provide helper functions for DOM manipulation, loader spinner, and coordinate formatting.
//   - Used by both globe-three.js and app.js.
// ----------------------------------------

/**
 * The overlay element that covers the app while loading.
 * @type {HTMLElement|null}
 */
const loadingOverlay = document.getElementById('loadingOverlay');

/**
 * Show the loading spinner by setting its display to 'flex'.
 */
export function showLoader() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }
}

/**
 * Hide the loading spinner by setting its display to 'none'.
 */
export function hideLoader() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

/**
 * Format a latitude or longitude numeric value with a cardinal suffix.
 *
 * @param {number} value     - The coordinate (can be negative).
 * @param {string} pos       - Symbol for positive values (e.g., 'N' or 'E').
 * @param {string} neg       - Symbol for negative values (e.g., 'S' or 'W').
 * @param {number} [decimals=4] - How many decimal places to print.
 * @returns {string}         - Formatted coordinate (e.g., "12.3456N" or "45.6789W").
 */
export function formatCoord(value, pos, neg, decimals = 4) {
    const abs = Math.abs(value).toFixed(decimals);
    return `${abs}${value < 0 ? neg : pos}`;
}

/**
 * Convert a numeric value and a cardinal direction into a signed coordinate.
 *
 * @param {number} value - The numeric value (always positive).
 * @param {string} dir   - The direction (one of pos or neg).
 * @param {string} pos   - Positive direction symbol (e.g., 'N' or 'E').
 * @param {string} neg   - Negative direction symbol (e.g., 'S' or 'W').
 * @returns {number}     - Signed coordinate; positive if dir===pos, negative if dir===neg.
 * @throws {Error}       - If value is invalid or dir is unknown.
 */
export function toSignedCoord(value, dir, pos, neg) {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new Error("Invalid number value.");
    }
    if (typeof dir !== 'string' || dir.length !== 1) {
        throw new Error("Invalid direction.");
    }

    // Determine if value should be positive or negtive based on passed value
    const direction = dir.toUpperCase();
    
    if (direction === pos.toUpperCase()) {
      // Positive value  
      return Math.abs(value);

    } else if (direction === neg.toUpperCase()) {
      // Negtive value  
      return -Math.abs(value);

    } else {
      throw new Error(`Unknown direction: ${dir}`);
    }
}

/**
 * Temporarily highlight a DOM element by toggling a 'highlighted' CSS class.
 *
 * @param {HTMLElement} element            - The element to highlight.
 * @param {number} timeInMilliseconds      - Duration the highlight class remains.
 */
export function highlightElement(element, timeInMilliseconds) {
  //Add highlight class to element class list
  element.classList.add('highlighted');

  // Set delayed removal of highlight class from class list
  setTimeout(() => {
    element.classList.remove('highlighted');
  }, timeInMilliseconds);
}