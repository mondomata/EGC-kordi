/* EGC TÉRKÉP FUNKCIÓK */
let map;
let currentMarker = null;
let currentMode = 'EOV';

// A felugró Google Maps ablak hivatkozása és időzítője
let googleWindow = null;
let googleWindowTimer = null;
let notificationTimer = null;

// EOV EPSG:23700 definíció proj4-hez
if (typeof proj4 !== 'undefined') {
    proj4.defs("EPSG:23700", "+proj=somerc +lat_0=47.14439372222222 +lon_0=19.04857177777778 +k_0=0.99993 +x_0=650000 +y_0=200000 +ellps=GRS67 +towgs84=52.17,-71.82,-14.9,0,0,0,0 +units=m +no_defs");
}

function initMap() {
    // 1. Standard OpenStreetMap
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    });

    // 2. OpenTopoMap
    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '&copy; OpenTopoMap'
    });

    // 3. Esri World Imagery
    const esriSatLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: 'Tiles &copy; Esri'
    });

    // Magyarország földrajzi határai (Délnyugat és Északkelet sarkok)
    const hungaryBounds = L.latLngBounds(
        L.latLng(45.7, 16.0), // Délnyugat
        L.latLng(48.6, 22.9)  // Északkelet
    );

    // Térkép inicializálása korlátozásokkal
    map = L.map('map', {
        center: [47.1625, 19.5033],
        zoom: 7,
        minZoom: 7,
        maxBounds: hungaryBounds,
        maxBoundsViscosity: 1.0,
        layers: [osmLayer]
    });

    // Rétegválasztó a jobb felső sarokban
    const baseMaps = {
        "OpenStreetMap Standard": osmLayer,
        "Topográfiai (Külterület)": topoLayer,
        "Műholdkép (Esri)": esriSatLayer
    };

    L.control.layers(baseMaps).addTo(map);
}

function toggleSearchMode() {
    if (currentMode === 'EOV') {
        currentMode = 'GPS';
        document.getElementById('formTitle').textContent = 'GPS Koordináta';
        document.getElementById('toggleModeLink').textContent = 'EOV?';
        document.getElementById('eovFields').classList.add('hidden');
        document.getElementById('gpsFields').classList.remove('hidden');
        document.getElementById('yCoord').required = false;
        document.getElementById('xCoord').required = false;
        document.getElementById('latCoord').required = true;
        document.getElementById('lngCoord').required = true;
    } else {
        currentMode = 'EOV';
        document.getElementById('formTitle').textContent = 'EOV Koordináta';
        document.getElementById('toggleModeLink').textContent = 'GPS?';
        document.getElementById('gpsFields').classList.add('hidden');
        document.getElementById('eovFields').classList.remove('hidden');
        document.getElementById('latCoord').required = false;
        document.getElementById('lngCoord').required = false;
        document.getElementById('yCoord').required = true;
        document.getElementById('xCoord').required = true;
    }
}

function eovToWgs84(y, x) {
    const converted = proj4("EPSG:23700", "EPSG:4326", [parseFloat(y), parseFloat(x)]);
    return { lat: parseFloat(converted[1].toFixed(6)), lng: parseFloat(converted[0].toFixed(6)) };
}

function wgs84ToEov(lat, lng) {
    const converted = proj4("EPSG:4326", "EPSG:23700", [parseFloat(lng), parseFloat(lat)]);
    return { y: Math.round(converted[0]), x: Math.round(converted[1]) };
}

function setPreset(y, x, name) {
    if (currentMode !== 'EOV') toggleSearchMode();
    document.getElementById('yCoord').value = y;
    document.getElementById('xCoord').value = x;
    processEov(y, x, name);
}

function processEov(y, x, label = 'EOV Pont') {
    let yNum = parseFloat(y);
    let xNum = parseFloat(x);

    if (isNaN(yNum) || isNaN(xNum)) return;

    if (yNum < xNum) {
        const temp = yNum; yNum = xNum; xNum = temp;
        document.getElementById('yCoord').value = yNum;
        document.getElementById('xCoord').value = xNum;
        showNotification('X és Y felcserélve.');
    }

    const gps = eovToWgs84(yNum, xNum);
    displayOnMap(gps.lat, gps.lng, yNum, xNum, label);
}

function processGps(lat, lng, label = 'GPS Pont') {
    let latNum = parseFloat(lat);
    let lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) return;

    if (latNum < lngNum) {
        const temp = latNum; latNum = lngNum; lngNum = temp;
        document.getElementById('latCoord').value = latNum;
        document.getElementById('lngCoord').value = lngNum;
        showNotification('Lat és Lng felcserélve.');
    }

    const eov = wgs84ToEov(latNum, lngNum);
    displayOnMap(latNum, lngNum, eov.y, eov.x, label);
}

// --- Google Térkép Integrációs Funkciók ---

function openInGoogleMaps() {
    const query = document.getElementById('googleAddressInput').value.trim();
    if (!query) {
        showNotification('&#9757; Kérlek, adj meg egy címet.');
        return;
    }

    // Előző futó ablakbezárási időzítő törlése gombnyomásra
    clearTimeout(googleWindowTimer);

    // Ha már nyitva van egy ablak, bezárjuk mielőtt újat nyitnánk
    if (googleWindow && !googleWindow.closed) {
        googleWindow.close();
    }

    const googleUrl = `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
    
    const width = 600;
    const height = 600;
    const left = window.screen.width - width - 300;
    const top = 200;

    googleWindow = window.open(
        googleUrl, 
        'GoogleMapsPopup', 
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );

    // Biztonsági időzítő: 15 mp múlva automatikusan bezárja a Google ablakot, ha nem nyúltak hozzá
    googleWindowTimer = setTimeout(() => {
        if (googleWindow && !googleWindow.closed) {
            googleWindow.close();
            googleWindow = null;
        }
    }, 15000);

    showNotification('&#9757; Kattints a kis térképen <i>jobb-gombbal</i> a &#128205; gombostűn + GPS koordinátán (másolás), majd kattints a <span style="background:#28a745;color:white;padding:2px 4px;border-radius:3px;">GPS beilleszt</span>-re');
}

// Vágólap kiolvasása, feldolgozás és a felugró ablak automatikus bezárása
async function pasteFromGoogle() {
    try {
        const text = await navigator.clipboard.readText();
        const match = text.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);
        
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            
            if (currentMode !== 'GPS') {
                toggleSearchMode();
            }
            
            document.getElementById('latCoord').value = lat;
            document.getElementById('lngCoord').value = lng;
            
            const addressText = document.getElementById('googleAddressInput').value || 'Google Maps Pont';
            processGps(lat, lng, addressText);
            
            // Sikeres beillesztés után azonnal bezárjuk a Google ablakot és töröljük az időzítőjét
            clearTimeout(googleWindowTimer);
            if (googleWindow && !googleWindow.closed) {
                googleWindow.close();
                googleWindow = null;
            }

            showNotification('GPS koordináta sikeresen beillesztve.');
        } else {
            showNotification('Nincs felismerhető GPS koordináta a vágólapon.');
        }
    } catch (err) {
        console.error('Vágólap elrési hiba:', err);
        showNotification('&#9757; Nincs engedély a vágólaphoz a böngészőben!');
    }
}

function displayOnMap(lat, lng, y, x, label) {
    if (currentMarker) map.removeLayer(currentMarker);

    currentMarker = L.marker([lat, lng]).addTo(map)
        .bindPopup(`<b>${label}</b><br>EOV Y: ${y} m<br>EOV X: ${x} m<br>GPS: ${lat}, ${lng}`)
        .openPopup();

    map.flyTo([lat, lng], 15, { duration: 1.2 });

    document.getElementById('resY').textContent = y.toLocaleString() + ' m';
    document.getElementById('resX').textContent = x.toLocaleString() + ' m';
    document.getElementById('resLat').textContent = lat + '°';
    document.getElementById('resLng').textContent = lng + '°';
    document.getElementById('resultsPanel').classList.remove('hidden');
}

function showNotification(text) {
    // Biztosítjuk, hogy új üzenet érkezésekor a 15 másodperc újrainduljon
    clearTimeout(notificationTimer);

    const notif = document.getElementById('notification');
    document.getElementById('notificationText').innerHTML = text; 
    notif.classList.remove('hidden');

    notificationTimer = setTimeout(() => {
        notif.classList.add('hidden');
    }, 15000);
}

// Form beküldések kezelése és inicializálás
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    setPreset(649885, 240347, 'Budapest Országház');

    document.getElementById('coordForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (currentMode === 'EOV') {
            processEov(document.getElementById('yCoord').value, document.getElementById('xCoord').value, 'Egyedi EOV Pont');
        } else {
            processGps(document.getElementById('latCoord').value, document.getElementById('lngCoord').value, 'Egyedi GPS Pont');
        }
    });

    document.getElementById('clearBtn').addEventListener('click', function() {
        document.getElementById('coordForm').reset();
        document.getElementById('googleSearchForm').reset();
        document.getElementById('resultsPanel').classList.add('hidden');
        if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
        map.setView([47.1625, 19.5033], 7);
    });
});