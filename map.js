/* EGC TÉRKÉP FUNKCIÓK */
        let map;
        let currentMarker = null;
        let currentMode = 'EOV';

        // LocationIQ API Access Token (saját API kulcs!)
        const LOCATIONIQ_TOKEN = 'pk.1ca7fd6f810b4099498c155c2db4aa05';

        proj4.defs("EPSG:23700", "+proj=somerc +lat_0=47.14439372222222 +lon_0=19.04857177777778 +k_0=0.99993 +x_0=650000 +y_0=200000 +ellps=GRS67 +towgs84=52.17,-71.82,-14.9,0,0,0,0 +units=m +no_defs");

        function initMap() {
            map = L.map('map').setView([47.1625, 19.5033], 7);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);
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
                showNotification('X és Y felcserélve!');
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
                showNotification('Lat és Lng felcserélve!');
            }

            const eov = wgs84ToEov(latNum, lngNum);
            displayOnMap(latNum, lngNum, eov.y, eov.x, label);
        }

        // --- Címkeresõ funkció LocationIQ API segítségével ---
        function searchAddress(query) {
            showNotification('Cím keresése...');
            
            // LocationIQ Search API hívás (Magyarországra szűkítve, házszám részletekkel)
            const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(query)}&countrycodes=hu&format=json&addressdetails=1&limit=1`;

            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Hiba a keresési válaszban');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && data.length > 0) {
                        const result = data[0];
                        const lat = parseFloat(result.lat);
                        const lng = parseFloat(result.lon);
                        
                        // Átváltás EOV-ra és megjelenítés
                        const eov = wgs84ToEov(lat, lng);
                        displayOnMap(lat, lng, eov.y, eov.x, result.display_name.split(',')[0]);
                        showNotification('Cím megtalálva!');
                    } else {
                        showNotification('A megadott cím nem található.');
                    }
                })
                .catch(err => {
                    showNotification('Hiba történt a keresés során.');
                }); 
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
            const notif = document.getElementById('notification');
            document.getElementById('notificationText').textContent = text;
            notif.classList.remove('hidden');
            setTimeout(() => notif.classList.add('hidden'), 3000);
        }

        // Címkeresõ ûrlap beküldése
        document.getElementById('addressForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const query = document.getElementById('addressInput').value;
            if (query.trim()) {
                searchAddress(query);
            }
        });

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
            document.getElementById('addressForm').reset();
            document.getElementById('resultsPanel').classList.add('hidden');
            if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
            map.setView([47.1625, 19.5033], 7);
        });

        window.onload = function() {
            initMap();
            setPreset(649885, 240347, 'Budapest Országház');
        };
