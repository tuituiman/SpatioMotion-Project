// compare.js - Logic for Map Comparison Feature

let compareMaps = [];
let compareLayers = [];
let isCompareMode = false;

document.getElementById('open-compare-btn').addEventListener('click', () => {
    if (typeof weeks === 'undefined' || weeks.length === 0) {
        alert("กรุณาอัปโหลดข้อมูลและรอให้ประมวลผลเสร็จก่อนเข้าโหมดเปรียบเทียบ");
        return;
    }

    document.getElementById('compare-view').style.display = 'flex';
    isCompareMode = true;

    initCompareMaps();
    populateCompareDropdowns();
});

document.getElementById('exit-compare-btn').addEventListener('click', () => {
    document.getElementById('compare-view').style.display = 'none';
    isCompareMode = false;
});

// Update grid based on select
document.getElementById('compare-count-select').addEventListener('change', (e) => {
    const count = parseInt(e.target.value);
    const grid = document.getElementById('compare-grid');
    if (count === 2) {
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gridTemplateRows = '1fr';
        document.getElementById('panel-2').style.display = 'none';
        document.getElementById('panel-3').style.display = 'none';
    } else {
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gridTemplateRows = '1fr 1fr';
        document.getElementById('panel-2').style.display = 'block';
        document.getElementById('panel-3').style.display = 'block';
    }

    // Invalidate size for all maps after layout change
    setTimeout(() => {
        compareMaps.forEach(m => {
            if (m) m.invalidateSize();
        });
    }, 100);
});

function initCompareMaps() {
    for (let i = 0; i < 4; i++) {
        if (!compareMaps[i]) {
            compareMaps[i] = L.map(`compare-map-${i}`, {
                zoomControl: false,
                attributionControl: false
            });
            L.control.zoom({ position: 'topright' }).addTo(compareMaps[i]);

            // Add tile layer
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(compareMaps[i]);

            // Create panes to match main map
            compareMaps[i].createPane('subdistrictBackground');
            compareMaps[i].getPane('subdistrictBackground').style.zIndex = 300;

            compareMaps[i].createPane('choropleth');
            compareMaps[i].getPane('choropleth').style.zIndex = 400;

            compareMaps[i].createPane('maskPane');
            compareMaps[i].getPane('maskPane').style.zIndex = 450;

            compareMaps[i].createPane('borders');
            compareMaps[i].getPane('borders').style.zIndex = 600;

            // Add white background for the whole country
            if (window.DATA_TH_SUBDISTRICTS) {
                L.geoJSON(window.DATA_TH_SUBDISTRICTS, {
                    pane: 'subdistrictBackground',
                    style: { fillColor: "#ffffff", fillOpacity: 1.0, color: "transparent", weight: 0 },
                    interactive: false
                }).addTo(compareMaps[i]);
            }

            // Add province and district borders
            if (window.DATA_TH_PROVINCES) {
                L.geoJSON(window.DATA_TH_PROVINCES, {
                    pane: 'borders',
                    style: (f) => ({ color: isFeatureInScope(f) ? "#000000" : "transparent", weight: 1.8, opacity: 1.0, fillOpacity: 0 }),
                    interactive: false
                }).addTo(compareMaps[i]);
            }
            if (window.DATA_TH_DISTRICTS) {
                L.geoJSON(window.DATA_TH_DISTRICTS, {
                    pane: 'borders',
                    style: (f) => ({ color: isFeatureInScope(f) ? "#000000" : "transparent", weight: 1.2, opacity: 0.8, fillOpacity: 0 }),
                    interactive: false
                }).addTo(compareMaps[i]);
            }

            // Sync logic: When map i moves, move others
            compareMaps[i].on('drag', syncMaps);
            compareMaps[i].on('zoom', syncMaps);
        }
    }

    // Initial view sync with main map
    setTimeout(() => {
        compareMaps.forEach(m => {
            if (m) {
                m.invalidateSize();
                m.setView(map.getCenter(), map.getZoom(), { animate: false });
            }
        });
        syncCompareMasks();
    }, 100);
}

let compareMaskLayers = [null, null, null, null];

function syncCompareMasks() {
    compareMaskLayers.forEach((ml, i) => {
        if (ml && compareMaps[i]) compareMaps[i].removeLayer(ml);
    });

    if (!currentScope || (currentScope.region === 'all' && currentScope.province === 'all' && currentScope.district === 'all')) return;

    const worldCoords = [[90, -180], [90, 180], [-90, 180], [-90, -180], [90, -180]];
    const targetHoles = [];
    let featuresToUse = [];

    if (currentScope.district !== 'all') {
        const data = window.DATA_TH_DISTRICTS;
        if (data) {
            featuresToUse = data.features.filter(f =>
                normalizeThaiName(f.properties.A_Name_T || f.properties.AM_TN) === normalizeThaiName(currentScope.district) &&
                normalizeThaiName(f.properties.P_Name_T || f.properties.PV_TN) === normalizeThaiName(currentScope.province)
            );
        }
    } else if (currentScope.province !== 'all') {
        const data = window.DATA_TH_PROVINCES;
        if (data) {
            featuresToUse = data.features.filter(f =>
                normalizeThaiName(f.properties.P_Name_T || f.properties.PV_TN) === normalizeThaiName(currentScope.province)
            );
        }
    } else if (currentScope.region !== 'all') {
        const data = window.DATA_TH_PROVINCES;
        const provincesInRegion = (TH_HEALTH_REGIONS[currentScope.region] || []).map(p => normalizeThaiName(p));
        if (data) {
            featuresToUse = data.features.filter(f =>
                provincesInRegion.includes(normalizeThaiName(f.properties.P_Name_T || f.properties.PV_TN))
            );
        }
    }

    featuresToUse.forEach(f => {
        const coords = f.geometry.coordinates;
        const addHole = (rings) => rings.forEach(ring => targetHoles.push(ring.map(c => [c[1], c[0]])));
        if (f.geometry.type === 'Polygon') addHole(coords);
        else if (f.geometry.type === 'MultiPolygon') coords.forEach(poly => addHole(poly));
    });

    if (targetHoles.length > 0) {
        compareMaps.forEach((m, i) => {
            if (m) {
                compareMaskLayers[i] = L.polygon([worldCoords, ...targetHoles], {
                    fillColor: '#0b0f19', fillOpacity: 0.95, color: 'none', weight: 0,
                    interactive: false, pane: 'maskPane'
                }).addTo(m);
            }
        });
    }
}

let isSyncing = false;
function syncMaps(e) {
    if (!isCompareMode || isSyncing) return;

    isSyncing = true;
    const center = e.target.getCenter();
    const zoom = e.target.getZoom();

    compareMaps.forEach(m => {
        if (m && m !== e.target) {
            m.setView(center, zoom, { animate: false });
        }
    });

    isSyncing = false;
}

function populateCompareDropdowns() {
    const selects = document.querySelectorAll('.compare-period-select');
    selects.forEach(select => {
        const val = select.value; // Remember previous choice
        select.innerHTML = '<option value="">-- เลือกช่วงเวลา --</option>';
        weeks.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w;
            opt.textContent = groupedData[w].label || w;
            select.appendChild(opt);
        });

        // Restore value if still exists, otherwise leave empty
        if (val && weeks.includes(val)) {
            select.value = val;
            renderCompareMap(parseInt(select.dataset.index), val);
        } else {
            // Default select some items based on index
            const defaultIndex = Math.min(parseInt(select.dataset.index), weeks.length - 1);
            if (weeks[defaultIndex]) {
                select.value = weeks[defaultIndex];
                renderCompareMap(parseInt(select.dataset.index), weeks[defaultIndex]);
            }
        }

        // Add event listener once
        if (!select.dataset.listenerAdded) {
            select.addEventListener('change', (ev) => {
                const index = parseInt(ev.target.dataset.index);
                const weekKey = ev.target.value;
                renderCompareMap(index, weekKey);
            });
            select.dataset.listenerAdded = 'true';
        }
    });
}

function renderCompareMap(index, weekKey) {
    const cmap = compareMaps[index];
    if (!cmap) return;

    // Clear old layers
    if (compareLayers[index]) {
        cmap.removeLayer(compareLayers[index]);
    }

    if (!weekKey || !groupedData[weekKey]) return;

    const data = groupedData[weekKey];
    const counts = displayValueMode === 'cumulative' ? data.cumulativeCounts : data.counts;

    // Create new geojson layer from the appropriate source
    let sourceGeoJSON = null;
    let propKeys = [];
    if (currentDataLevel === 'subdistrict') {
        sourceGeoJSON = window.DATA_TH_SUBDISTRICTS;
        propKeys = ["tambon", "T_Name_T"];
    } else if (currentDataLevel === 'district') {
        sourceGeoJSON = window.DATA_TH_DISTRICTS;
        propKeys = ["A_Name_T", "name"];
    } else {
        sourceGeoJSON = window.DATA_TH_PROVINCES;
        propKeys = ["ADM1_TH", "P_Name_T"];
    }

    if (!sourceGeoJSON) return;

    compareLayers[index] = L.geoJSON(sourceGeoJSON, {
        pane: 'choropleth',
        style: function (feature) {
            if (!isFeatureInScope(feature)) {
                return { fillOpacity: 0, color: "transparent", weight: 0 };
            }

            const fp = feature.properties;
            let val = 0;

            if (window._matchMode === 'code') {
                const geoCode = getGeoJSONCode(fp, currentDataLevel);
                if (geoCode && counts[geoCode] !== undefined) val = counts[geoCode];
            }

            if (val === 0) {
                const compoundKey = buildGeoJSONNameKey(fp, currentDataLevel);
                if (compoundKey && counts[compoundKey] !== undefined) {
                    val = counts[compoundKey];
                }

                if (val === 0) {
                    for (let key of propKeys) {
                        if (fp[key]) {
                            const name = fp[key].toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, "").trim();
                            if (name && counts[name] !== undefined) {
                                val = counts[name];
                                break;
                            }
                        }
                    }
                }
            }

            const zeroColor = window._zeroColor;
            return {
                fillColor: val > 0 ? getColor(val) : (zeroColor || "transparent"),
                fillOpacity: val > 0 ? 0.75 : (zeroColor ? 0.75 : 0),
                color: "transparent",
                weight: 0
            };
        },
        onEachFeature: function (feature, layer) {
            if (!isFeatureInScope(feature)) return;

            const fp = feature.properties;
            let val = 0;
            let name = "";

            if (window._matchMode === 'code') {
                const geoCode = getGeoJSONCode(fp, currentDataLevel);
                if (geoCode && counts[geoCode] !== undefined) val = counts[geoCode];
            }

            if (val === 0) {
                const compoundKey = buildGeoJSONNameKey(fp, currentDataLevel);
                if (compoundKey && counts[compoundKey] !== undefined) {
                    val = counts[compoundKey];
                    name = compoundKey.split('|').pop();
                }

                if (val === 0) {
                    for (let key of propKeys) {
                        if (fp[key]) {
                            const rawName = fp[key].toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, "").trim();
                            if (rawName && counts[rawName] !== undefined) {
                                val = counts[rawName];
                                name = rawName;
                                break;
                            }
                        }
                    }
                }
            }

            if (val > 0) {
                const pName = (fp.P_Name_T || fp.PV_TN || "").toString().trim();
                const aName = (fp.A_Name_T || fp.AM_TN || "").toString().trim();
                const tName = (fp.T_Name_T || fp.TB_TN || "").toString().trim();

                const addPrefix = (n, type) => {
                    if (!n) return "";
                    if (type === 'p') return (n.includes("จังหวัด") || n.includes("จ.")) ? n : "จ." + n;
                    if (type === 'a') return (n.includes("อำเภอ") || n.includes("อ.")) ? n : "อ." + n;
                    if (type === 't') return (n.includes("ตำบล") || n.includes("ต.")) ? n : "ต." + n;
                    return n;
                };

                let fullName = "";
                if (tName) fullName = `${addPrefix(tName, 't')} ${addPrefix(aName, 'a')} ${addPrefix(pName, 'p')}`;
                else if (aName) fullName = `${addPrefix(aName, 'a')} ${addPrefix(pName, 'p')}`;
                else fullName = addPrefix(pName, 'p');

                const displayLabel = displayValueMode === 'cumulative' ? 'จำนวนสะสม' : 'จำนวน';
                layer.bindTooltip(`
                    <div style="text-align: center;">
                        <div style="font-weight: bold; margin-bottom: 4px; color: #3b82f6;">${fullName || name}</div>
                        <div style="font-size: 1.1rem;">${displayLabel}: <span style="color: #ef4444; font-weight: bold;">${val.toLocaleString()}</span></div>
                    </div>
                `, { sticky: true, direction: 'auto', className: 'custom-tooltip' });

                layer.on('mouseover', function () {
                    this.setStyle({ fillOpacity: 0.9, color: "#3b82f6", weight: 2 });
                });

                layer.on('mouseout', function () {
                    this.setStyle({ fillOpacity: 0.75, color: "transparent", weight: 0 });
                });
            }
        }
    }).addTo(cmap);
}
