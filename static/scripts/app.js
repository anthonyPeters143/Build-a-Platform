// ----------------------------------------
// Purpose:
//   - Main client-side script to:
//       • Initialize timezones and clock display
//       • Load/post messages and location summaries from/to the server
//       • Apply filters, sorting, and show/hide controls
//       • Manage hidden messages/summaries in localStorage
//       • Integrate with globe-three.js to plot pins and find coordinates
//
// Imports Summary:
//   - formatCoord, toSignedCoord, showLoader, hideLoader from utility.js
//
// High-level Overview:
//   • Query common DOM elements (buttons, selects, containers)
//   • Initialize timezone list and formatters
//   • Define helper functions for filters and element creation
//   • Define async functions to load messages/summaries and fetch from server
//   • Attach event listeners for user interactions
// ----------------------------------------

// Import utility functions
import {formatCoord, toSignedCoord, showLoader, hideLoader} from './utility.js';

// ----------------------------------------
// DOM Element references
// ----------------------------------------
const tzSelect = document.getElementById('tzSelect');
const localTimeEl = document.getElementById('localTime');
const localZoneEl = document.getElementById('localZone');

const messagePostButton = document.getElementById('postBtn');
const msgListEl = document.getElementById('messages');
const clearMsgBtn = document.getElementById('clearMessageBtn');
const resetHiddenMessages = document.getElementById('resetHiddenMessagesBtn');

const sortFieldSelect= document.getElementById('sortField');
const sortDirSelect  = document.getElementById('sortDir');
const resetSortButton = document.getElementById('resetSort');

const fsTogglePanel = document.getElementById('fsTogglePanel');
const fsToggleButton = document.getElementById('fsTogglePanelButton');

const locationSummaryResponsesContainer = document.getElementById('summaryResponses');
const clearLocationSummaryResponses = document.getElementById('clearSummariesBtn');
const resetHiddenLocationSummaryResponse = document.getElementById('resetHiddenSummariesBtn');

// ----------------------------------------
// Timezone set up
// ----------------------------------------
const timeZones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];
const formatters = {};

// ----------------------------------------
// Hidden values
// ----------------------------------------
let hiddenMsgs = JSON.parse(localStorage.getItem('hiddenMsgs') || '[]');
let hiddenSummaries = JSON.parse(localStorage.getItem('hiddenSummaries') || '[]');

// Set constants message
const MAX_MESSAGE_CHARACTERS = 300;



// ----------------------------------------
// Time Keeping Functions
// ----------------------------------------
/**
 * Populate tzSelect dropdown with all supported timezones and store formatters.
 */
function initTimeZones() {
    // Cycle for each timezone value
    timeZones.forEach(tz => {
        // Create formaters for date times
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year:'numeric',
            month:'2-digit',
            day:'2-digit',
            hour:'2-digit',
            minute:'2-digit',
            second:'2-digit',
            hour12:true,
            timeZoneName:'shortOffset'
        });
        formatters[tz]=fmt;

        // Calculate offset from UTC
        const off = fmt.formatToParts(new Date()).find(p => p.type==='timeZoneName')?.value.replace('GMT','UTC') || '';

        // Add timezone selection to the timezone HTML element
        tzSelect.append(new Option(`(${off}) ${tz}`,tz));
    });

    // Determine and store preferred timezone
    const saved = localStorage.getItem('preferredTz');
    if (saved && timeZones.includes(saved)) {
        // Use stored timezone
        tzSelect.value = saved;
        updateLocalTime()

    } 
    else {
        // Choose the user's timezone else set to UTC
        const usr = Intl.DateTimeFormat().resolvedOptions().timeZone;
        tzSelect.value = timeZones.includes(usr) ? usr : 'UTC';

    }
    
}

/**
 * Format a Date or ISO string into the selected timezone’s display format.
 *
 * @param {Date|string} dateOrIso - Date object or ISO string
 * @param {string} tz             - IANA timezone identifier
 * @returns {string}              - Formatted timestamp (e.g., "01/23/2025, 04:56:07 PM UTC-05:00")
 */
function formatTimestamp(dateOrIso, tz) {
    // Format timedate
    const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso.replace(/([^Z+-])$/,'$1Z'));
    
    // Return formatted datetime
    return formatters[tz].format(d);

}

/**
 * Update the displayed local time and timezone name.
 */
function updateLocalTime() {
    const tz=tzSelect.value;
    localZoneEl.textContent=tz;
    localTimeEl.textContent=formatTimestamp(new Date(),tz);

}

// ----------------------------------------
// Filter Construction
// ----------------------------------------
/**
 * Read filter inputs from DOM and convert them into an object suitable for query parameters.
 *
 * @returns {?Object}  - Object with keys: start, end, lat_min, lat_max, lng_min, lng_max, or null if invalid
 */
function getFilters() {
    // Create filter list
    const f={};

    // Determine element values from filter input values
    const startDateTime=document.getElementById('startDateTime').value;
    const endDateTime=document.getElementById('endDateTime').value;

    const latMin=document.getElementById('latMin').value;
    const latMax=document.getElementById('latMax').value;

    const latMinDir = document.getElementById('latMinDir').value;
    const latMaxDir = document.getElementById('latMaxDir').value;

    const lngMin=document.getElementById('lngMin').value;
    const lngMax=document.getElementById('lngMax').value;

    const lngMinDir = document.getElementById('lngMinDir').value;
    const lngMaxDir = document.getElementById('lngMaxDir').value;

    // Checks if each coordinate value is not empty and then onvert coordinate inputs into signed floats based on direction value
    let formattedLatMin = latMin ? toSignedCoord(parseFloat(latMin), latMinDir, 'N', 'S') : null;
    let formattedLatMax = latMax ? toSignedCoord(parseFloat(latMax), latMaxDir, 'N', 'S') : null;
    let formattedLngMin = lngMin ? toSignedCoord(parseFloat(lngMin), lngMinDir, 'E', 'W') : null;
    let formattedLngMax = lngMax ? toSignedCoord(parseFloat(lngMax), lngMaxDir, 'E', 'W') : null;

    // Parse and validate start/end datetimes
    let formatedStartDateTime= startDateTime ? new Date(startDateTime) : null;
    let formatedEndDateTime= endDateTime ? new Date(endDateTime) : null;
    if (formatedStartDateTime && formatedEndDateTime && formatedStartDateTime > formatedEndDateTime) {
        // Throw alert if invalid order
        alert('Start must be before End');
        return null;
    }
    
    // Check if the formated start and end timedate are not null, convert into ISO format, then store as start and end 
    if (formatedStartDateTime) {
        f.start=formatedStartDateTime.toISOString();
    }
    if (formatedEndDateTime) {
        f.end=formatedEndDateTime.toISOString();
    }

    // Determine lat/lng min/max keys
    if (formattedLatMin && formattedLatMax) {
        // Set min and max lat values for range based on size (incase of negative values)
        f.lat_min = Math.min(formattedLatMin, formattedLatMax);
        f.lat_max = Math.max(formattedLatMin, formattedLatMax);
    } 
    // Check if there is only lat min
    else if (formattedLatMin) {
        // Set min lat value
        f.lat_min = formattedLatMin;

    }
    // Check if there is only lat max
    else if (formattedLatMax) {
        // Set max lat value
        f.lat_max = formattedLatMax;

    }

    if (formattedLngMin && formattedLngMax) {
        // Set min and max lng values for range based on size (incase of negative values)
        f.lng_min = Math.min(formattedLngMin, formattedLngMax);
        f.lng_max = Math.max(formattedLngMin, formattedLngMax);

    } 
    // Check if there is only lng min
    else if (formattedLngMin) {
        // Set min lng value
        f.lng_min = formattedLngMin;

    }
    // Check if there is only lng max
    else if (formattedLngMax) {
        // Set max lng value
        f.lng_max = formattedLngMax;

    }
    
    // Return filter list
    return f;

}

// ----------------------------------------
// MESSAGE HANDLING
// ----------------------------------------
/**
 * Persist hiddenMsgs to localStorage when it changes.
 */
function saveHiddenMessage() {
    // Update local storage with new hidden messages list
    localStorage.setItem('hiddenMsgs', JSON.stringify(hiddenMsgs));

}

/**
 * Hide a message from the list and refresh displayed messages.
 *
 * @param {Object} m                   - Message object with .id property
 * @param {HTMLElement} messageContainer - Corresponding container element to remove
 */
function hideMessage(m, messageContainer) {
    // Store message id in hidden messages list
    hiddenMsgs.push(m.id); 
    saveHiddenMessage();

    // Update messagee elements
    messageContainer.remove();
    loadMessages();

}

/**
 * Create a single message <li> element and append it to msgListEl.
 *
 * @param {Object} m - Message data: { id, message, lat, lng, posted_at }
 * @param {string} tz - Timezone for formatting the timestamp
 */
function createMessageElement(m, tz) {
    // Check message is not hidden
    if (!hiddenMsgs.includes(m.id)) {
        // Create HTML elements 
        // Message container
        const messageContainer = document.createElement('li');
        messageContainer.className = "message-container"

        // Message id
        messageContainer.id = `message-${m.id}`;

        // Message button container
        const messageButtonContainer = document.createElement('div');
        messageButtonContainer.className = 'message-btn-container'

        // Datetime
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        messageHeader.textContent = `[${formatTimestamp(m.posted_at, tz)} ${tz}]`;

        // Coordinates
        const messageCoordinates = document.createElement('div');
        messageCoordinates.className = 'message-coords';
        messageCoordinates.textContent = 
            `latitude : ${formatCoord(m.lat, 'N', 'S')}, longitude : ${formatCoord(m.lng, 'E', 'W')}`;

        // Body
        const messageBody = document.createElement('div');
        messageBody.className = 'message-body';
        messageBody.textContent = m.message;

        // Find button
        const messageBtnFind = document.createElement('button');
        messageBtnFind.className = 'message-button';
        messageBtnFind.textContent = 'Find';
        messageBtnFind.onclick = () => {
            findOnThreeGlobe(m.lat, m.lng);
        };

        // Info button
        const messageBtnInfo = document.createElement('button');
        messageBtnInfo.className = 'message-button'; 
        messageBtnInfo.textContent = 'Info';
        messageBtnInfo.onclick = () => {
            getLocationInfo(m.lat, m.lng)
        };

        // Hide button
        const messageBtnHide = document.createElement('button');
        messageBtnHide.className = 'message-button';
        messageBtnHide.textContent = 'Hide';
        messageBtnHide.onclick = () => {
            hideMessage(m, messageContainer)
        };

        // Place buttons in button container
        messageButtonContainer.append(messageBtnInfo, messageBtnFind, messageBtnHide);

        // Place message info in message container
        messageContainer.append(messageHeader, messageCoordinates, messageBody, messageButtonContainer);
        msgListEl.appendChild(messageContainer);
    }

}

/**
 * Fetch messages from server (with filters), sort them, and render visible ones.
 * Also update globe pins via window.plotPinsOnThreeGlobe.
 */
async function loadMessages() {
    // Show loading spinner
    showLoader();

    // Determine timezone and filters
    const tz = tzSelect.value;
    const filters = getFilters(); 
    
    // Check the filters were returned
    if(filters) {
        // Create url for queuing for messages from messages route
        const url = new URL('/api/messages', window.location.origin);

        // Convert filters into an array and cycle through each of them
        Object.entries(filters).forEach(
            // Append each key value pair to the end of the url
            ([key,value]) => url.searchParams.append(key,value)

        );

        // Attach CSRF token to fetch
        url.headers = {
            'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content
        }

        // Await and store a fetch from the messages url and conversion of the response into to a JSON  
        const msgs = await (await fetch(url)).json();

        // Filter hidden messages so that only current ID are kept
        hiddenMsgs = hiddenMsgs.filter(id => msgs.some(m => m.id === id));

        // Update hidden message local storage
        saveHiddenMessage();

        // Sort messages based on selected field and direction
        msgs.sort((a, b) => {
            let valA, valB;
            switch (sortFieldSelect.value) {
                case 'date':
                valA = Date.parse(a.posted_at);
                valB = Date.parse(b.posted_at);
                break;

                case 'length':
                valA = a.message.length;
                valB = b.message.length;
                break;

                case 'lat':
                valA = a.lat;
                valB = b.lat;
                break;

                case 'lng':
                valA = a.lng;
                valB = b.lng;
                break;
            }
            return sortDirSelect.value === 'asc' ? valA - valB : valB - valA;
        });

        // Clear and reload visible messages
        msgListEl.innerHTML='';
        const visibleMsgs = msgs.filter(m => !hiddenMsgs.includes(m.id));
        visibleMsgs.forEach(m=>{
            // Create message HMTL elements
            createMessageElement(m, tz);            
        });

        // PLot points on globe for visible messages
        const points = visibleMsgs.map((m) => ({
            id: m.id,
            lat: m.lat,
            lng: m.lng,
            color: 'red',
            message: m.message
        }));
        window.plotPinsOnThreeGlobe(points);

        // Hide loading spinner
        hideLoader();
    }

}

// ----------------------------------------
// SUMMARY HANDLING
// ----------------------------------------

/**
 * Save the JSON of hidden summries objects in local storage
 */
function saveHiddenSummaries() {
  localStorage.setItem('hiddenSummaries', JSON.stringify(hiddenSummaries));

}

/**
 * Adds a summary to the hiddenSummaries storage, then updates storage and remove the HTML element
 */
function hideSummary(summaryObj, summaryContainer) {
  hiddenSummaries.push(summaryObj.id);
  saveHiddenSummaries();
  summaryContainer.remove();

}

/**
 * Create and prepend a location summary element for a stored summary record.
 *
 * @param {number} id
 * @param {number} lat
 * @param {number} lng
 * @param {string} description
 * @param {string} summary
 * @param {string} posted_at
 * @param {string} tz
 */
function createLocationSummaryElement(id, lat, lng, description, summary) {
    // Check that description and summary are not null and the summary is not hidden
    if (description != null && summary != null && !hiddenSummaries.includes(id)) {
        // Create HTML elements 
        // Location summary container
        const locationSummaryContainer = document.createElement('div');
        locationSummaryContainer.className = 'location-summary-container';

        // Location
        const locationSummaryLocation = document.createElement('div');
        locationSummaryLocation.className = 'location-summary-location';
        locationSummaryLocation.textContent = `Location: ${description}`;

        // Summary
        const locationSummarySummary = document.createElement('textarea');
        locationSummarySummary.className = 'location-summary-summary';
        locationSummarySummary.readOnly = true;
        locationSummarySummary.textContent = summary;

        // Find button
        const locationSummaryBtnFind = document.createElement('button');
        locationSummaryBtnFind.classList = 'location-summary-button'
        locationSummaryBtnFind.textContent = 'Find';
        locationSummaryBtnFind.onclick = () => {
            // findOnGlobe(lat, lng);
            window.findOnThreeGlobe(lat, lng);
        };

        // Hide button
        const locationSummaryBtnHide = document.createElement('button');
        locationSummaryBtnHide.classList = 'location-summary-button';
        locationSummaryBtnHide.textContent = 'Hide';
        locationSummaryBtnHide.onclick = () => {
            hideSummary({ id }, locationSummaryContainer);
        }

        // Place summary info into container
        locationSummaryContainer.append(
            locationSummaryLocation,
            locationSummarySummary, 
            locationSummaryBtnFind,
            locationSummaryBtnHide
        );

        // Insert at top of container
        locationSummaryResponsesContainer.prepend(locationSummaryContainer);

        // Focus on new location summary
        locationSummarySummary.focus();

    }
    
}

/**
 * Fetch all stored summaries, filter, sort, and render them.
 */
async function loadSummaries() {
    // Show loader spinner
    showLoader();

    // Determine and apply filters
    const filters = getFilters(); 
    if(filters) {
        // Create url for queuing for summaries from summary route
        const url = new URL('/api/summaries', window.location.origin);

        // Convert filters into an array and cycle through each of them
        Object.entries(filters).forEach(
            // Append each key value pair to the end of the url
            ([key,value]) => url.searchParams.append(key,value)

        );

        // Attach CSRF token to fetch
        url.headers = {
            'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content
        }

        // Await and fetch summaries from /api/summaries
        const res = await fetch(url);
        
        // Check if response is okay
        if (res.ok) {
            // Conversion of response into a json (id, summary, lat, lng, location, posted_at)
            const summaries = await res.json();

            // Filter and update hidden summaries so that only current ID are kept
            hiddenSummaries = hiddenSummaries.filter(id => summaries.some(s => s.id === id));
            saveHiddenSummaries();

            // Sort summaries
            summaries.sort((a, b) => {
                let valA, valB;
                switch (sortFieldSelect.value) {
                    case 'date':
                    valA = Date.parse(a.posted_at);
                    valB = Date.parse(b.posted_at);
                    break;

                    case 'length':
                    valA = a.summaries.length;
                    valB = b.summaries.length;
                    break;

                    case 'lat':
                    valA = a.lat;
                    valB = b.lat;
                    break;

                    case 'lng':
                    valA = a.lng;
                    valB = b.lng;
                    break;
                }
                return sortDirSelect.value === 'asc' ? valA - valB : valB - valA;
            });

            // Rerendered summaries
            locationSummaryResponsesContainer.innerHTML = '';
            summaries.forEach((s) => {
                createLocationSummaryElement(s.id, s.lat, s.lng, s.location, s.summary);
            });

            // Hide loading spinner
            hideLoader();

        } else {
            // Hide loading spinner
            hideLoader();

            // Throw alert loading summaires
            return alert('Error loading stored summaries');
        }
    }

}

/**
 * Fetch or generate a new summary for a given lat/lng from /api/location-summary,
 * then render it.
 *
 * @param {number} lat
 * @param {number} lng
 */
async function getLocationInfo(lat, lng) {
    // Show loading spinner
    showLoader();

    // Create url for queuing for getting location infomation
    const url = new URL(`/api/location-summary?lat=${lat}&lng=${lng}`, window.location.origin);

    // Attach CSRF token to fetch
    url.headers = {
        'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content
    }

    // Await for response from server
    const res = await fetch(url);

    // Check if response is okay
    if (res.ok) { 
        // Create location summary element using response
        const {id, lat, lng, description, summary} = await res.json();
        createLocationSummaryElement(id, lat, lng, description, summary);

    }
    else {
        // Throw alert loading location info
        return alert("Error loading location info");
    }

    // Hide loading spinner
    hideLoader();

}

// ----------------------------------------
// Event Listeners
// ----------------------------------------

// Page loads event
document.addEventListener('DOMContentLoaded', () => {
    initTimeZones();
    updateLocalTime();
    loadMessages();
    loadSummaries();
    
    // Keep the clock updating every second
    setInterval(updateLocalTime, 1000);

});

// Timezone option selected event
tzSelect.addEventListener('change', () => {
    // Store timezone as preferred
    localStorage.setItem('preferredTz', tzSelect.value);

    // Updates time
    updateLocalTime();

    // Updates messages
    loadMessages();

});

// Apply filter event
document.getElementById('applyFilters').addEventListener('click', loadMessages);

// Reset filter event
document.getElementById('resetFilters').addEventListener('click',()=>{
    ['startDateTime','endDateTime','latMin','latMax','lngMin','lngMax'].forEach(id => document.getElementById(id).value='');
    loadMessages();

});

// Reset sort event
resetSortButton.addEventListener('click', () => {
    sortFieldSelect.value = 'date';
    sortDirSelect.value = 'asc';
    loadMessages();

});

// Sorting events
sortFieldSelect.addEventListener('change', loadMessages);
sortDirSelect.addEventListener('change', loadMessages);

// Post message event
messagePostButton.onclick = async () => {
    // Get values from html elements
    const lat= document.getElementById('latDeg').value;
    const latDir= document.getElementById('latDir').value;
    const lng= document.getElementById('lngDeg').value;
    const lngDir= document.getElementById('lngDir').value;
    const message = document.getElementById('msg').value;

    // Checks if both coordinate values are not empty and then converts the lat and long values based on direction selected else sets them to null
    let formattedLat = lat ? toSignedCoord(parseFloat(lat), latDir, 'N', 'S') : null;
    let formattedLng = lng ? toSignedCoord(parseFloat(lng), lngDir, 'E', 'W') : null;

    // Checks if the message value is not null, less than or equal to the max characer limit, and only includes alphanumeric characers and spaces
    let formattedMessage = message && message.length <= MAX_MESSAGE_CHARACTERS && /^[A-Za-z0-9\.\,\!\?\- ]+$/.test(message) ? message.trim() : null

    // Check if the message body, lat, long are not null
    if (formattedLat != null && formattedLng != null && formattedMessage != null)
    {
        // Create message payload 
        const payload= {
            message: formattedMessage,
            lat: formattedLat,
            lng: formattedLng
        };

        // Await for response
        const res = await fetch(
            '/api/messages', {
                method:'POST',
                headers:{
                    'Content-Type':'application/json',
                    'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content
                },
                body:JSON.stringify(payload)
            }
        );

        // Check if response is okay
        if (res.ok) {
            ['msg','latDeg','lngDeg'].forEach(id => 
                document.getElementById(id).value='');
                document.getElementById('latDir').value='N';
                document.getElementById('lngDir').value='E';

                // Update messages
                await loadMessages();
        }
        else 
        {
            // Throw alert Error with response
            alert("Error posting - " + await res.text());
        }
    }
    else
    {
        // Throw alert error with input
        return alert("Enter valid degrees for both lat and lng and only alphanumeric characters (spaces are allowed) less than " + 
            MAX_MESSAGE_CHARACTERS + " charcters");
    }

};

// Side panel toggle event
fsToggleButton.addEventListener('click', () => {
    fsTogglePanel.classList.toggle('open');

});

// Clear location summaries button event
clearLocationSummaryResponses.addEventListener('click', () => {
    locationSummaryResponsesContainer.innerHTML = '';

});

// Clear messsages button event
clearMsgBtn.addEventListener('click', () => {
    msgListEl.innerHTML = '';

});

// Reset hidden summaries event
resetHiddenLocationSummaryResponse.addEventListener('click', () => {
    // Clear hidden summaries and store to local storage
    hiddenSummaries = [];
    saveHiddenSummaries();
    loadSummaries();

})

// Reset hidden messages button
resetHiddenMessages.addEventListener('click', () => {
    // Clear hidden messages and store to local storage
    hiddenMsgs = [];
    saveHiddenMessage();
    loadMessages();

})