/**
 * GeoPatient Pro - Core Logic (Refined for Subdistrict & North 8)
 */

// --- Configuration & State ---
let map;
let patientData = [];
let groupedData = {};
let weeks = [];
let currentWeekIndex = 0;
let isPlaying = false;
let playInterval;
let markerLayer;
let geojsonLayers = {
    provinces: null,
    districts: null,
    subdistricts: null,
    provinceBorder: null,
    districtBorder: null,
    subdistrictBorder: null,
    background: null
};

// --- Epi Week Settings ---
let customEpiSettings = {
    enabled: false,
    year: 2568,
    startDate: null,
    maxWeeks: 52
};

// Area Scope State
let currentScope = { region: 'all', province: 'all', district: 'all' };

const TH_HEALTH_REGIONS = {
    '1': ['เชียงใหม่', 'เชียงราย', 'ลำพูน', 'ลำปาง', 'พะเยา', 'แพร่', 'น่าน', 'แม่ฮ่องสอน'],
    '2': ['พิษณุโลก', 'ตาก', 'เพชรบูรณ์', 'สุโขทัย', 'อุตรดิตถ์'],
    '3': ['นครสวรรค์', 'อุทัยธานี', 'กำแพงเพชร', 'พิจิตร', 'ชัยนาท'],
    '4': ['สระบุรี', 'ลพบุรี', 'พระนครศรีอยุธยา', 'อ่างทอง', 'สิงห์บุรี', 'นนทบุรี', 'ปทุมธานี', 'นครนายก'],
    '5': ['ราชบุรี', 'กาญจนบุรี', 'สุพรรณบุรี', 'นครปฐม', 'สมุทรสาคร', 'สมุทรสงคราม', 'เพชรบุรี', 'ประจวบคีรีขันธ์'],
    '6': ['ระยอง', 'ฉะเชิงเทรา', 'ชลบุรี', 'จันทบุรี', 'ตราด', 'สระแก้ว', 'ปราจีนบุรี', 'สมุทรปราการ'],
    '7': ['ขอนแก่น', 'ร้อยเอ็ด', 'กาฬสินธุ์', 'มหาสารคาม'],
    '8': ['อุดรธานี', 'สกลนคร', 'นครพนม', 'หนองคาย', 'เลย', 'หนองบัวลำภู', 'บึงกาฬ'],
    '9': ['นครราชสีมา', 'ชัยภูมิ', 'บุรีรัมย์', 'สุรินทร์'],
    '10': ['อุบลราชธานี', 'ศรีสะเกษ', 'ยโสธร', 'มุกดาหาร', 'อำนาจเจริญ'],
    '11': ['สุราษฎร์ธานี', 'นครศรีธรรมราช', 'ภูเก็ต', 'กระบี่', 'พังงา', 'ระนอง', 'ชุมพร'],
    '12': ['สงขลา', 'สตูล', 'ตรัง', 'พัทลุง', 'ปัตตานี', 'ยะลา', 'นราธิวาส'],
    '13': ['กรุงเทพมหานคร']
};

let currentDataLevel = 'province'; // 'province', 'district', or 'subdistrict'
let classCount = 5;
let currentBreaks = []; // เก็บขอบบนของแต่ละชั้น (ชั้นแรกคือ 0 เสมอ)
let globalStats = {}; // สถิติรวมทั้งไฟล์
let dataKeys = { date: '', location: '', patients: '' }; // เก็บชื่อ Column ที่ตรวจพบ
let locationToProvinceMap = {}; // Cache สำหรับหาจังหวัดของพื้นที่ต่างๆ
let legendControl = null;
let statsControl = null;
let dataGroupingMode = 'weekly'; // 'daily', 'weekly', 'monthly', 'yearly'
let displayValueMode = 'periodic'; // 'periodic', 'cumulative'
let dataWorker = null;

const monthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthsFull = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];


// ชุดสีสำหรับแผนที่ choropleth
const COLOR_PALETTES = {
    'YlOrRd': { name: 'ส้ม-แดง', colors: ['#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'] },
    'Blues': { name: 'น้ำเงิน', colors: ['#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'] },
    'Greens': { name: 'เขียว', colors: ['#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'] },
    'Purples': { name: 'ม่วง', colors: ['#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'] },
    'Reds': { name: 'แดง', colors: ['#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'] },
    'YlGnBu': { name: 'ฟ้า-เขียว', colors: ['#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'] }
};
let activePalette = 'YlOrRd';

const CONFIG = {
    animationSpeed: 1000,
    north8Provinces: ["เชียงใหม่", "เชียงราย", "น่าน", "พะเยา", "แพร่", "แม่ฮ่องสอน", "ลำปาง", "ลำพูน"],
    colorRange: COLOR_PALETTES['YlOrRd'].colors,
    colors: []
};

// --- Initialization ---
window.onload = async () => {
    initMap();
    setupEventListeners();
    initScopeSelectors();
    await loadGeoJSONLayers();
};

function initMap() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: true
    }).setView([13.7367, 100.5231], 6);

    // 1. แผนที่โลกสีเข้มเหมือนเดิม
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);



    // Create marker layer
    markerLayer = L.layerGroup().addTo(map);

    // สร้าง Panes เพื่อควบคุมลำดับการซ้อนทับ (Z-Index)
    // ลำดับ: tiles(200) -> subdistrictBackground(300) -> choropleth(400) -> mask(450) -> borders(600)
    map.createPane('subdistrictBackground');
    map.getPane('subdistrictBackground').style.zIndex = 300;

    map.createPane('choropleth');
    map.getPane('choropleth').style.zIndex = 400;

    map.createPane('maskPane');
    map.getPane('maskPane').style.zIndex = 450; // อยู่เหนือพื้นขาว เพื่อบังจังหวัดที่ไม่ได้เลือก

    map.createPane('borders');
    map.getPane('borders').style.zIndex = 600; // เส้นขอบอยู่บนสุดเสมอ

    L.control.zoom({ position: 'topright' }).addTo(map);
}



async function loadGeoJSONLayers() {
    showLoader("กำลังเตรียมแผนที่พื้นหลัง...");
    console.log("Starting loadGeoJSONLayers...");

    try {
        // Ensure data is on window if loaded via const script (fallback mechanism)
        if (typeof DATA_TH_PROVINCES !== 'undefined') window.DATA_TH_PROVINCES = DATA_TH_PROVINCES;
        if (typeof DATA_TH_DISTRICTS !== 'undefined') window.DATA_TH_DISTRICTS = DATA_TH_DISTRICTS;

        // --- 1. ล้างเลเยอร์เดิมทิ้งทั้งหมด ---
        Object.keys(geojsonLayers).forEach(key => {
            if (geojsonLayers[key]) {
                map.removeLayer(geojsonLayers[key]);
                geojsonLayers[key] = null;
            }
        });

        const provVar = 'DATA_TH_PROVINCES';
        const distVar = 'DATA_TH_DISTRICTS';

        // พยายามดึงข้อมูลจาก window หรือตัวแปรตรงๆ
        let provinceData = window[provVar] || (typeof DATA_TH_PROVINCES !== 'undefined' ? DATA_TH_PROVINCES : null);
        let districtData = window[distVar] || (typeof DATA_TH_DISTRICTS !== 'undefined' ? DATA_TH_DISTRICTS : null);

        // แก้ encoding สำหรับทุก GeoJSON (Windows-874 → UTF-8)
        if (provinceData) {
            provinceData = fixGeoJSONEncoding(provinceData);
            window[provVar] = provinceData;
        }
        if (districtData) {
            districtData = fixGeoJSONEncoding(districtData);
            window[distVar] = districtData;
        }

        console.log("Map Resources Check:", {
            provinces: !!provinceData,
            districts: !!districtData,
            protocol: window.location.protocol
        });

        // --- 2. วาดขอบเขตจังหวัด (เส้นสีดำชัดเจน) ---
        if (provinceData) {
            geojsonLayers.provinceBorder = L.geoJSON(provinceData, {
                pane: 'borders',
                style: (f) => {
                    const inScope = isFeatureInScope(f);
                    return {
                        color: inScope ? "#000000" : "transparent",
                        weight: 1.8,
                        opacity: 1.0,
                        fillOpacity: 0
                    };
                },
                interactive: false
            }).addTo(map);

            geojsonLayers.provinces = L.geoJSON(provinceData, {
                pane: 'choropleth',
                style: { fillOpacity: 0, color: "transparent" }
            }).addTo(map);

            if (currentScope.region === 'all' && !map._initialSet) {
                map.setView([13.7367, 100.5231], 6);
                map._initialSet = true;
            }
        }

        // --- 3. วาดขอบเขตอำเภอ (เส้นสีดำบาง) ---
        if (districtData) {
            geojsonLayers.districtBorder = L.geoJSON(districtData, {
                pane: 'borders',
                style: (f) => {
                    const inScope = isFeatureInScope(f);
                    return {
                        color: inScope ? "#000000" : "transparent",
                        weight: 1.2,
                        opacity: 0.8,
                        fillOpacity: 0
                    };
                },
                interactive: false
            }).addTo(map);

            geojsonLayers.districts = L.geoJSON(districtData, {
                pane: 'choropleth',
                style: { fillOpacity: 0, color: "transparent" }
            }).addTo(map);
        }

    } catch (err) {
        console.error("❌ Critical error in loadGeoJSONLayers:", err);
    } finally {
        hideLoader();
    }

    // --- 4. โหลดพื้นหลังระดับตำบล (ต้องโหลดก่อน updateMap!) ---
    const subVar = 'DATA_TH_SUBDISTRICTS';
    let subdistrictData = window[subVar] || (typeof DATA_TH_SUBDISTRICTS !== 'undefined' ? DATA_TH_SUBDISTRICTS : null);

    if (subdistrictData) {
        renderSubdistrictLayer(subdistrictData);
    } else {
        // Fallback fetch...
        fetch('thailand_subdistricts_super_small.geojson')
            .then(res => res.json())
            .then(data => { window[subVar] = data; renderSubdistrictLayer(data); });
    }

    // --- 5. อัปเดตแผนที่ (ตอนนี้ subdistricts พร้อมแล้ว) ---
    if (weeks.length > 0) updateMapForCurrentWeek();

    console.log("v2.2: Map layers loaded, subdistricts ready before choropleth.");
}

// แก้ไข encoding: browser อ่าน UTF-8 file ด้วย Windows-874 codepage ผ่าน file:// protocol
function fixGeoJSONEncoding(data) {
    if (!data || !data.features || data.features.length === 0) return data;

    // ตรวจ encoding จาก property ไทยใดๆ ที่มี
    const fp = data.features[0].properties;
    const testVal = fp.T_Name_T || fp.tambon || fp.A_Name_T || fp.amphur || fp.P_Name_T || fp.changwat || "";
    // ตรวจว่ามีภาษาไทย Unicode ปกติ (0E00-0E7F range) ใน pattern ที่ควรมี
    const hasProperThai = /[\u0E01-\u0E3A\u0E40-\u0E4D]/.test(testVal) && !/\u0E40\u0E18/.test(testVal);
    if (hasProperThai || !testVal) {
        console.log("✅ GeoJSON encoding OK");
        return data;
    }

    console.warn("⚠️ GeoJSON encoding broken (Windows-874→UTF-8 mismatch), fixing...");

    // แปลง Unicode char กลับเป็น Windows-874 byte value
    function charToWin874Byte(code) {
        if (code < 0x80) return code; // ASCII
        if (code >= 0x0E01 && code <= 0x0E3A) return code - 0x0E01 + 0xA1;
        if (code >= 0x0E3F && code <= 0x0E5B) return code - 0x0E3F + 0xDF;
        // Windows-874 special chars (0x80-0x9F range)
        const sp = {
            0x20AC: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92,
            0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96,
            0x2014: 0x97, 0x00A0: 0xA0, 0x0160: 0x8A, 0x0161: 0x9A
        };
        return sp[code] !== undefined ? sp[code] : (code <= 0xFF ? code : 0x3F);
    }

    function fixStr(s) {
        if (!s || typeof s !== 'string') return s;
        try {
            const bytes = new Uint8Array(s.length);
            for (let i = 0; i < s.length; i++) {
                bytes[i] = charToWin874Byte(s.charCodeAt(i));
            }
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) { return s; }
    }

    const propsToFix = ['T_Name_T', 'T_Name_E', 'A_Name_T', 'A_Name_E', 'P_Name_T', 'P_Name_E',
        'tambon', 'amphur', 'changwat', 'Source_Nam'];
    data.features.forEach(f => {
        propsToFix.forEach(key => {
            if (f.properties[key] && typeof f.properties[key] === 'string') {
                f.properties[key] = fixStr(f.properties[key]);
            }
        });
    });

    console.log("✅ Encoding fixed! Sample:", data.features[0].properties.T_Name_T);
    return data;
}

function renderSubdistrictLayer(data) {
    // แก้ encoding ก่อนวาด
    data = fixGeoJSONEncoding(data);
    // อัปเดต global reference ด้วย
    window.DATA_TH_SUBDISTRICTS = data;

    if (geojsonLayers.background) map.removeLayer(geojsonLayers.background);

    // วาดพื้นหลังขาวทั้งประเทศไทย (ไม่ filter scope)
    // mask จะบังส่วนที่ไม่ได้เลือกทีหลัง
    geojsonLayers.background = L.geoJSON(data, {
        pane: 'subdistrictBackground',
        style: () => {
            return {
                fillColor: "#ffffff",
                fillOpacity: 1.0,
                color: "transparent",
                weight: 0
            };
        },
        interactive: false
    }).addTo(map);


    geojsonLayers.subdistricts = L.geoJSON(data, {
        pane: 'choropleth',
        style: { fillOpacity: 0, color: "transparent" }
    }).addTo(map);

    // เส้นขอบตำบล
    if (geojsonLayers.subdistrictBorder) map.removeLayer(geojsonLayers.subdistrictBorder);
    geojsonLayers.subdistrictBorder = L.geoJSON(data, {
        pane: 'borders',
        style: (f) => {
            const inScope = isFeatureInScope(f);
            return {
                color: inScope ? "#555555" : "transparent",
                weight: 0.5,
                opacity: 0.6,
                fillOpacity: 0
            };
        },
        interactive: false
    }).addTo(map);
}



function setupEventListeners() {
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');

    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
    };

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, () => {
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    // Reset Application Button
    const resetAppBtn = document.getElementById('reset-app-btn');
    if (resetAppBtn) {
        resetAppBtn.addEventListener('click', () => {
            if (confirm("คุณต้องการรีเซ็ตแอปพลิเคชันและล้างข้อมูลที่โหลดมาทั้งหมดหรือไม่?")) {
                window.location.reload();
            }
        });
    }

    // Map Scope Toggle
    document.querySelectorAll('input[name="map-scope"]').forEach(radio => {
        radio.onchange = (e) => {
            // Note: This was a potential bug. currentScope is an object.
            // We should only update the specific field or handle as intended.
            // However, looking at the UI, this radio is for 'all' vs others? 
            // Actually, index.html doesn't have name="map-scope" radios anymore.
            // It uses the sliding panel now. I will remove this legacy listener.
        };
    });

    // Class Count Change
    const classCountInput = document.getElementById('class-count');
    if (classCountInput) {
        classCountInput.onchange = (e) => {
            classCount = parseInt(e.target.value);
            generateBreaksUI();
            if (weeks.length > 0) updateMapForCurrentWeek();
        };
    }

    // Palette Picker Init
    const pickerContainer = document.getElementById('palette-picker');
    if (pickerContainer) {
        Object.entries(COLOR_PALETTES).forEach(([key, pal]) => {
            const btn = document.createElement('div');
            btn.title = pal.name;
            btn.dataset.palette = key;
            btn.style.cssText = `cursor:pointer; border-radius:4px; height:22px; border:2px solid ${key === activePalette ? '#3b82f6' : 'transparent'}; background: linear-gradient(to right, ${pal.colors.join(',')}); transition: border-color 0.2s;`;
            btn.onclick = () => {
                activePalette = key;
                CONFIG.colorRange = pal.colors;
                updateColors();
                // Update border highlight
                pickerContainer.querySelectorAll('div').forEach(d => d.style.borderColor = d.dataset.palette === key ? '#3b82f6' : 'transparent');
                if (weeks.length > 0) updateMapForCurrentWeek();
            };
            pickerContainer.appendChild(btn);
        });
    }

    // Timeline Controls
    document.getElementById('week-slider').oninput = (e) => {
        currentWeekIndex = parseInt(e.target.value);
        updateMapForCurrentWeek();
    };

    document.getElementById('play-pause').onclick = togglePlay;

    // Template Modal Controls
    const templateModal = document.getElementById('template-modal');
    document.getElementById('show-template').onclick = () => {
        templateModal.style.display = 'flex';
    };
    document.getElementById('close-template').onclick = () => {
        templateModal.style.display = 'none';
    };
    templateModal.onclick = (e) => {
        if (e.target === templateModal) templateModal.style.display = 'none';
    };

    // Column Mapping Modal
    const colmapModal = document.getElementById('colmap-modal');
    document.getElementById('close-colmap').onclick = () => {
        colmapModal.style.display = 'none';
        _pendingUploadJson = null;
    };
    colmapModal.onclick = (e) => {
        if (e.target === colmapModal) { colmapModal.style.display = 'none'; _pendingUploadJson = null; }
    };
    document.getElementById('colmap-confirm').onclick = () => {
        if (!_pendingUploadJson) return;
        const dateCol = document.getElementById('colmap-date').value;
        const provCol = document.getElementById('colmap-prov').value;
        const distCol = document.getElementById('colmap-dist').value;
        const subCol = document.getElementById('colmap-sub').value;
        const valCol = document.getElementById('colmap-val').value;

        if (!dateCol || !provCol || !valCol) {
            alert("กรุณาเลือกคอลัมน์ วันที่ จังหวัด และจำนวน");
            return;
        }

        // Detect ว่า province column เป็นรหัส (ตัวเลข) หรือชื่อ
        const sampleProv = (_pendingUploadJson[0][provCol] || '').toString().trim();
        const isCodeData = /^\d{2,6}$/.test(sampleProv);

        // Rename columns: ถ้าเป็นรหัสใช้ "รหัสจังหวัด" เพื่อให้ processData detect ได้
        const remapped = _pendingUploadJson.map(row => {
            const newRow = {};
            newRow['วันที่'] = row[dateCol];
            newRow[isCodeData ? 'รหัสจังหวัด' : 'จังหวัด'] = row[provCol];
            if (distCol) newRow[isCodeData ? 'รหัสอำเภอ' : 'อำเภอ'] = row[distCol];
            if (subCol) newRow[isCodeData ? 'รหัสตำบล' : 'ตำบล'] = row[subCol];
            newRow[valCol] = row[valCol];
            return newRow;
        });

        colmapModal.style.display = 'none';
        _pendingUploadJson = null;
        resetState();
        processData(remapped);
    };
}

// --- Data Processing ---
function resetState() {
    patientData = [];
    groupedData = {};
    weeks = [];
    currentWeekIndex = 0;
    if (isPlaying) togglePlay();
    if (markerLayer) markerLayer.clearLayers();
    if (legendControl) {
        map.removeControl(legendControl);
        legendControl = null;
    }
    if (statsControl) {
        map.removeControl(statsControl);
        statsControl = null;
    }
    // Reset custom color state
    window._zeroColor = undefined;
    activePalette = 'YlOrRd';
    CONFIG.colorRange = COLOR_PALETTES['YlOrRd'].colors;
    const picker = document.getElementById('palette-picker');
    if (picker) picker.querySelectorAll('div').forEach(d => d.style.borderColor = d.dataset.palette === 'YlOrRd' ? '#3b82f6' : 'transparent');
}

let _pendingUploadJson = null; // เก็บข้อมูลรอ user เลือก column

function handleFileUpload(file) {
    if (!file) return;

    const warningMsg = `คำแนะนำเพื่อความลื่นไหลในการแสดงผล:
- โหมดรายวัน: ไม่ควรเกิน 6 เดือน
- โหมดรายสัปดาห์: ไม่ควรเกิน 2 ปี
- โหมดรายเดือน: ไม่ควรเกิน 10 ปี
- โหมดรายปี: ไม่จำกัด

หากข้อมูลมีช่วงเวลายาวเกินไป อาจทำให้เบราว์เซอร์ทำงานช้าลงได้
ต้องการดำเนินการต่อหรือไม่?`;

    const confirmUpload = confirm(warningMsg);
    if (!confirmUpload) return;

    showLoader("กำลังอ่านไฟล์ Excel...");
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            if (!json || json.length === 0) { alert("ไฟล์ไม่มีข้อมูล"); hideLoader(); return; }

            // ลอง auto-detect
            const rawKeys = Object.keys(json[0]);
            const keys = rawKeys.map(k => k.replace(/^\ufeff/, '').trim());
            const dateKey = keys.find(k => k.includes('วันที่') || k.toLowerCase().includes('date'));
            const provKey = keys.find(k => k.includes('จังหวัด') || k.toLowerCase().includes('province'));
            const locKey = provKey || keys.find(k => k.includes('อำเภอ') || k.includes('ตำบล') || k.toLowerCase().includes('district'));

            if (dateKey && locKey) {
                // Auto-detect สำเร็จ → process ตรง
                resetState();
                processData(json);
            } else {
                // ไม่เจอ column → แสดง modal ให้ user เลือก
                hideLoader();
                _pendingUploadJson = json;
                _showColumnMappingModal(rawKeys, keys);
            }
        } catch (err) {
            alert("Error reading Excel: " + err.message);
            hideLoader();
        }
    };
    reader.readAsArrayBuffer(file);
}

function _showColumnMappingModal(rawKeys, keys) {
    const modal = document.getElementById('colmap-modal');
    const selects = ['colmap-date', 'colmap-prov', 'colmap-val'];
    const optionalSelects = ['colmap-dist', 'colmap-sub'];

    // Populate selects
    selects.forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '';
        rawKeys.forEach(k => sel.add(new Option(k, k)));
    });
    optionalSelects.forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">— ไม่มี —</option>';
        rawKeys.forEach(k => sel.add(new Option(k, k)));
    });

    // Pre-select by best guess
    const dateGuess = keys.find(k => k.includes('วัน') || k.toLowerCase().includes('date'));
    const provGuess = keys.find(k => k.includes('จังหวัด') || k.toLowerCase().includes('province'));
    const distGuess = keys.find(k => (k.includes('อำเภอ') || k.toLowerCase().includes('district')) && !k.toLowerCase().includes('sub'));
    const subGuess = keys.find(k => k.includes('ตำบล') || k.toLowerCase().includes('subdistrict'));
    const valGuess = keys.find(k => k.includes('จำนวน') || k.includes('ผู้ป่วย') || k.toLowerCase().includes('count') || k.toLowerCase().includes('value') || k.toLowerCase().includes('case') || k.toLowerCase().includes('total'));

    const keyMap = {};
    keys.forEach((ck, i) => keyMap[ck] = rawKeys[i]);

    if (dateGuess) document.getElementById('colmap-date').value = keyMap[dateGuess];
    if (provGuess) document.getElementById('colmap-prov').value = keyMap[provGuess];
    if (distGuess) document.getElementById('colmap-dist').value = keyMap[distGuess];
    if (subGuess) document.getElementById('colmap-sub').value = keyMap[subGuess];
    if (valGuess) document.getElementById('colmap-val').value = keyMap[valGuess];
    else document.getElementById('colmap-val').value = rawKeys[rawKeys.length - 1];

    modal.style.display = 'flex';
}

function processData(json) {
    showLoader("กำลังประมวลผลข้อมูล...");
    patientData = json;

    // ตรวจสอบความละเอียดข้อมูล และเก็บชื่อ Column
    let hasSubdistrict = false;
    let hasDistrict = false;
    dataKeys = { date: '', location: '', patients: '', province: '', district: '', subdistrict: '' };
    // Code matching: ตรวจหาคอลัมน์รหัส
    window._matchMode = 'name'; // default = match ด้วยชื่อ
    window._codeKeys = { province: '', district: '', subdistrict: '', fullCode: '' };

    if (json.length > 0) {
        const first = json[0];
        const rawKeys = Object.keys(first);
        const keys = rawKeys.map(k => k.replace(/^\ufeff/, '').trim());
        const keyMap = {};
        rawKeys.forEach((rk, i) => keyMap[keys[i]] = rk);

        // --- ตรวจหาคอลัมน์ชื่อ ---
        const subKey = keys.find(k => k.includes('ตำบล') || k.toLowerCase().includes('subdistrict'));
        const distKey = keys.find(k => (k.includes('อำเภอ') || k.toLowerCase().includes('district')) && !k.toLowerCase().includes('subdistrict'));
        const provKey = keys.find(k => k.includes('จังหวัด') || k.toLowerCase().includes('province'));
        const dateKey = keys.find(k => k.includes('วันที่') || k.toLowerCase().includes('date'));
        const patKey = keys.find(k => k.includes('จำนวน') || k.includes('ผู้ป่วย') || k.includes('ราย') || k.includes('ปริมาณ') || k.includes('ค่า') || k.includes('อัตรา') || k.includes('สัดส่วน') || k.toLowerCase().includes('patient') || k.toLowerCase().includes('count') || k.toLowerCase().includes('case') || k.toLowerCase().includes('value') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('rate') || k.toLowerCase().includes('total') || k.toLowerCase().includes('number'));

        // --- ตรวจหาคอลัมน์รหัส (Code Matching) ---
        const fullCodeKey = keys.find(k => /^(admin_?code|geocode|รหัส$|รหัสพื้นที่|area_?code)$/i.test(k));
        const provCodeKey = keys.find(k => /^(p_?code|รหัสจังหวัด|prov(ince)?_?code|changwat_?code)$/i.test(k));
        const distCodeKey = keys.find(k => /^(a_?code|pa_?code|รหัสอำเภอ|dist(rict)?_?code|amphoe_?code|amphur_?code)$/i.test(k));
        const subCodeKey = keys.find(k => /^(t_?code|admin_?code|รหัสตำบล|sub(district)?_?code|tambon_?code)$/i.test(k));

        dataKeys.date = keyMap[dateKey] || rawKeys[0];
        dataKeys.patients = keyMap[patKey] || rawKeys[rawKeys.length - 1];

        // --- ตรวจว่ามีรหัสหรือไม่ → เลือก matchMode ---
        if (fullCodeKey && first[keyMap[fullCodeKey]]) {
            // มีรหัสเต็ม (6 หลัก / 4 หลัก / 2 หลัก)
            window._codeKeys.fullCode = keyMap[fullCodeKey];
            window._matchMode = 'code';
            const sampleCode = first[keyMap[fullCodeKey]].toString().replace(/\D/g, '');
            if (sampleCode.length >= 6) currentDataLevel = 'subdistrict';
            else if (sampleCode.length >= 4) currentDataLevel = 'district';
            else currentDataLevel = 'province';
        } else if (subCodeKey && first[keyMap[subCodeKey]]) {
            window._codeKeys.subdistrict = keyMap[subCodeKey];
            window._codeKeys.district = keyMap[distCodeKey] || '';
            window._codeKeys.province = keyMap[provCodeKey] || '';
            window._matchMode = 'code';
            currentDataLevel = 'subdistrict';
        } else if (distCodeKey && first[keyMap[distCodeKey]]) {
            window._codeKeys.district = keyMap[distCodeKey];
            window._codeKeys.province = keyMap[provCodeKey] || '';
            window._matchMode = 'code';
            currentDataLevel = 'district';
        } else if (provCodeKey && first[keyMap[provCodeKey]]) {
            window._codeKeys.province = keyMap[provCodeKey];
            window._matchMode = 'code';
            currentDataLevel = 'province';
        }

        // เก็บ key ทุกระดับไว้สำหรับ compound matching
        if (provKey) dataKeys.province = keyMap[provKey];
        if (distKey) dataKeys.district = keyMap[distKey];
        if (subKey) dataKeys.subdistrict = keyMap[subKey];

        // --- Fallback: ถ้าไม่มีรหัส ใช้ชื่อแบบเดิม ---
        if (window._matchMode === 'name') {
            if (subKey && first[keyMap[subKey]]) {
                hasSubdistrict = true;
                dataKeys.location = keyMap[subKey];
                currentDataLevel = 'subdistrict';
            } else if (distKey && first[keyMap[distKey]]) {
                hasDistrict = true;
                dataKeys.location = keyMap[distKey];
                currentDataLevel = 'district';
            } else {
                dataKeys.location = keyMap[provKey] || rawKeys[Math.min(1, rawKeys.length - 1)];
                currentDataLevel = 'province';
            }
        } else {
            dataKeys.location = keyMap[subKey] || keyMap[distKey] || keyMap[provKey] || rawKeys[Math.min(1, rawKeys.length - 1)];
        }
    }

    console.log("Data Level:", currentDataLevel, "| Match:", window._matchMode);

    resetAllLayers(); // ล้างสไตล์และ Tooltip เก่าออกให้หมด

    // Optimization: สร้าง Map สำหรับหาจังหวัดของแต่ละพื้นที่ไว้ล่วงหน้า
    locationToProvinceMap = {};
    const provKey = Object.keys(json[0] || {}).find(k => k.includes('จังหวัด') || k.toLowerCase().includes('province'));
    if (provKey) {
        json.forEach(p => {
            const loc = (p[dataKeys.location] || "").toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, "").trim();
            const prov = (p[provKey] || "").toString().replace("จังหวัด", "").replace("จ.", "").trim();
            if (loc && prov) locationToProvinceMap[loc] = prov;
        });
    }

    groupDataByWeek();

    if (weeks.length === 0) {
        hideLoader();
        alert("ไม่พบข้อมูลที่ระบุสัปดาห์หรือวันที่ได้");
        return;
    }

    console.log(`Processing complete: ${weeks.length} weeks found.`);
    initTimeline();

    hideLoader();
    document.getElementById('timeline').style.display = 'flex';
    document.getElementById('choro-settings').style.display = 'block';
    document.getElementById('open-compare-btn').style.display = 'flex';

    calculateGlobalStats();
    updateStatsUI(globalStats);
    updateUIElements();
    generateBreaksUI(true);
    updateMapForCurrentWeek();
}

function updateColors() {
    const dataClassCount = classCount - 1; // ไม่นับชั้น 0
    CONFIG.colors = [];

    if (dataClassCount === 1) {
        CONFIG.colors = [CONFIG.colorRange[CONFIG.colorRange.length - 1]];
    } else {
        for (let i = 0; i < dataClassCount; i++) {
            // กระจายตัวเลือกสีตามจำนวนชั้น
            const ratio = i / (dataClassCount - 1);
            const colorIdx = Math.round(ratio * (CONFIG.colorRange.length - 1));
            CONFIG.colors.push(CONFIG.colorRange[colorIdx]);
        }
    }
}

function calculateGlobalStats() {
    let allValues = [];
    let totalSum = 0;
    let maxVal = 0, maxLocationKey = '', maxPeriod = '';

    weeks.forEach(w => {
        const weekData = groupedData[w];
        if (!weekData) return;
        const activeCounts = displayValueMode === 'cumulative' ? weekData.cumulativeCounts : weekData.counts;
        Object.entries(activeCounts).forEach(([loc, val]) => {
            allValues.push(val);
            totalSum += val;
            if (val > maxVal) {
                maxVal = val;
                maxLocationKey = loc;
                maxPeriod = weekData.label || w;
            }
        });
    });

    globalStats = calculateStats(allValues, totalSum);
    globalStats.maxLocation = _resolveLocationName(maxLocationKey);
    globalStats.maxPeriod = maxPeriod;
}

// แปลง matchKey (code/compound) → ชื่อไทยอ่านง่าย
function _resolveLocationName(key) {
    if (!key) return '';

    // ถ้าเป็นตัวเลข (code mode) → lookup จาก GeoJSON
    if (/^\d+$/.test(key)) {
        const code = key;
        const geoSrc = code.length >= 6 ? window.DATA_TH_SUBDISTRICTS
                     : code.length >= 4 ? window.DATA_TH_DISTRICTS
                     : window.DATA_TH_PROVINCES;
        if (geoSrc) {
            const feat = geoSrc.features.find(f => {
                if (code.length >= 6) return (f.properties.Admin_code || '').toString().padStart(6, '0') === code.padStart(6, '0');
                if (code.length >= 4) {
                    const fc = (f.properties.P_code || '').toString().padStart(2, '0') + (f.properties.A_code || '').toString().padStart(2, '0');
                    return fc === code.padStart(4, '0');
                }
                return (f.properties.P_code || '').toString().padStart(2, '0') === code.padStart(2, '0');
            });
            if (feat) {
                const p = feat.properties;
                if (code.length >= 6) return `ต.${(p.T_Name_T || '').replace(/ตำบล/g, '')} อ.${(p.A_Name_T || '').replace(/อำเภอ/g, '')}`;
                if (code.length >= 4) return `อ.${(p.A_Name_T || '').replace(/อำเภอ/g, '')} จ.${(p.P_Name_T || '').replace(/จังหวัด/g, '')}`;
                return (p.P_Name_T || '').replace(/จังหวัด/g, '').trim();
            }
        }
        return key;
    }

    // ถ้าเป็น compound name (เช่น "เชียงราย|เมืองเชียงราย|เวียง")
    const parts = key.split('|');
    if (parts.length === 3) return `ต.${parts[2]} อ.${parts[1]}`;
    if (parts.length === 2) return `อ.${parts[1]} จ.${parts[0]}`;
    return parts[0];
}

function findProvinceForLocation(loc) {
    if (locationToProvinceMap[loc]) return locationToProvinceMap[loc];
    return loc;
}

function generateBreaksUI(isInitial = false) {
    updateColors();
    const container = document.getElementById('breaks-inputs-container');
    if (!container) return;
    container.innerHTML = '';

    const maxVal = Math.max(globalStats.max || 0, 1);

    if (isInitial || currentBreaks.length !== classCount) {
        currentBreaks = [0];
        const step = maxVal / (classCount - 1);
        for (let i = 1; i < classCount; i++) {
            currentBreaks.push(Math.round(step * i));
        }
    }

    currentBreaks.forEach((brk, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';

        const label = document.createElement('span');
        label.style.fontSize = '0.7rem';
        label.style.color = '#94a3b8';
        label.style.width = '60px';

        if (idx === 0) {
            label.innerText = 'ชั้นที่ 1 (ไม่มี):';
            const fixedVal = document.createElement('span');
            fixedVal.innerText = '0';
            fixedVal.style.fontSize = '0.8rem';
            fixedVal.style.color = '#fff';
            fixedVal.style.paddingLeft = '8px';
            row.appendChild(label);
            row.appendChild(fixedVal);
        } else {
            label.innerText = `ชั้นที่ ${idx + 1} ขอบบน:`;
            const input = document.createElement('input');
            input.type = 'number';
            input.value = brk;
            input.style.flex = '1';
            input.style.background = '#111827';
            input.style.border = '1px solid #1e293b';
            input.style.color = idx === classCount - 1 ? '#3b82f6' : '#fff';
            input.style.borderRadius = '3px';
            input.style.padding = '2px 6px';
            input.style.fontSize = '0.75rem';

            input.onchange = (e) => {
                currentBreaks[idx] = parseInt(e.target.value);
                if (weeks.length > 0) updateMapForCurrentWeek();
                generateBreaksUI();
            };

            row.appendChild(label);
            row.appendChild(input);
        }
        container.appendChild(row);
    });
}

// === Code Matching Helpers ===

// สร้าง matching key จากรหัสใน Excel row
function buildCodeKey(row) {
    const ck = window._codeKeys;

    // กรณีมี full code (admin_code, geocode) → ใช้เลย
    if (ck.fullCode) {
        const code = (row[ck.fullCode] || "").toString().replace(/\D/g, '');
        if (code) return code.padStart(currentDataLevel === 'subdistrict' ? 6 : currentDataLevel === 'district' ? 4 : 2, '0');
    }

    // กรณีแยกคอลัมน์ รหัสจังหวัด + รหัสอำเภอ + รหัสตำบล
    const pCode = ck.province ? (row[ck.province] || "").toString().replace(/\D/g, '').padStart(2, '0') : '';
    const aCode = ck.district ? (row[ck.district] || "").toString().replace(/\D/g, '') : '';
    const tCode = ck.subdistrict ? (row[ck.subdistrict] || "").toString().replace(/\D/g, '') : '';

    if (currentDataLevel === 'subdistrict') {
        // รหัสตำบลอาจเป็น 6 หลัก (PPAATT), 4 หลัก (AATT), หรือ 2 หลัก (TT)
        if (tCode.length >= 6) return tCode.substring(0, 6);
        if (tCode.length >= 4 && pCode) return pCode + tCode.substring(0, 4);
        if (tCode.length >= 2) {
            // ต้องมีรหัสอำเภอด้วย
            const fullA = aCode.length >= 4 ? aCode.substring(0, 4) : (pCode + aCode.padStart(2, '0'));
            return fullA + tCode.padStart(2, '0');
        }
    } else if (currentDataLevel === 'district') {
        // รหัสอำเภอ 4 หลัก (PPAA) หรือ 2 หลัก (AA)
        if (aCode.length >= 4) return aCode.substring(0, 4);
        if (aCode.length >= 2 && pCode) return pCode + aCode.padStart(2, '0');
    } else if (currentDataLevel === 'province') {
        return pCode || '';
    }

    return '';
}

// ดึงรหัสจาก GeoJSON feature properties
function getGeoJSONCode(props, level) {
    if (level === 'subdistrict') {
        // Admin_code = "930603" (6 หลัก)
        return (props.Admin_code || '').toString().replace(/\D/g, '').padStart(6, '0');
    } else if (level === 'district') {
        // Admin_code = "3604" (4 หลัก) หรือ P_code + A_code
        if (props.Admin_code) return props.Admin_code.toString().replace(/\D/g, '').padStart(4, '0');
        const p = (props.P_code || '').toString().replace(/\D/g, '').padStart(2, '0');
        const a = (props.A_code || '').toString().replace(/\D/g, '').padStart(2, '0');
        return p + a;
    } else if (level === 'province') {
        return (props.P_code || '').toString().replace(/\D/g, '').padStart(2, '0');
    }
    return '';
}

// สร้าง compound name key จาก Excel row (ป้องกันชื่อซ้ำ)
const _stripPrefixes = (s) => (s || "").toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, "").trim();

// ขยาย "เมือง" → "เมืองเชียงราย" เมื่อรู้จังหวัด
function _expandMueang(distName, provName) {
    if (!distName || !provName) return distName;
    // ถ้าชื่ออำเภอเป็น "เมือง" ตรงๆ หรือ "เมือง" ตามด้วยอะไรที่สั้นมาก → ต่อชื่อจังหวัด
    if (distName === 'เมือง' || distName === `เมือง${provName}`) {
        return `เมือง${provName}`;
    }
    return distName;
}

function buildCompoundNameKey(row) {
    const prov = _stripPrefixes(row[dataKeys.province]);
    let dist = _stripPrefixes(row[dataKeys.district]);
    const sub = _stripPrefixes(row[dataKeys.subdistrict]);
    const loc = _stripPrefixes(row[dataKeys.location]);
    dist = _expandMueang(dist, prov); // "เมือง" → "เมืองเชียงราย"

    if (currentDataLevel === 'subdistrict' && (sub || loc)) {
        // ใช้ compound: จังหวัด|อำเภอ|ตำบล (ถ้ามีข้อมูลจังหวัด/อำเภอ)
        if (prov || dist) return `${prov}|${dist}|${sub || loc}`;
        return sub || loc; // fallback ถ้าไม่มีจังหวัด/อำเภอ
    } else if (currentDataLevel === 'district' && (dist || loc)) {
        if (prov) return `${prov}|${dist || loc}`;
        return dist || loc;
    } else {
        return prov || loc || '';
    }
}

// สร้าง compound name key จาก GeoJSON feature properties
function buildGeoJSONNameKey(props, level) {
    const prov = _stripPrefixes(props.P_Name_T || props.changwat || '');
    const dist = _stripPrefixes(props.A_Name_T || props.amphur || '');
    const sub = _stripPrefixes(props.T_Name_T || props.tambon || '');

    if (level === 'subdistrict') {
        if (prov || dist) return `${prov}|${dist}|${sub}`;
        return sub;
    } else if (level === 'district') {
        if (prov) return `${prov}|${dist}`;
        return dist;
    } else {
        return prov;
    }
}

// สร้าง date key จาก local timezone (ไม่ใช้ toISOString เพราะจะเป็น UTC)
function _localDateKey(d) {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function groupDataByWeek() {
    groupedData = {};
    const weekMap = {};
    let globalMin = null;
    let globalMax = null;

    // 1. หาช่วงวันที่ที่กว้างที่สุดในข้อมูล
    // สร้าง code→name lookup สำหรับ scope filter (ใช้เมื่อข้อมูลเป็นรหัส)
    const _provCodeToName = {};
    const _distCodeToName = {};
    if (window._matchMode === 'code') {
        if (window.DATA_TH_PROVINCES) {
            window.DATA_TH_PROVINCES.features.forEach(f => {
                const code = (f.properties.P_code || '').toString().padStart(2, '0');
                const name = normalizeThaiName(f.properties.P_Name_T || '');
                if (code && name) _provCodeToName[code] = name;
            });
        }
        if (window.DATA_TH_DISTRICTS) {
            window.DATA_TH_DISTRICTS.features.forEach(f => {
                let code = '';
                if (f.properties.Admin_code) {
                    code = f.properties.Admin_code.toString().replace(/\D/g, '').padStart(4, '0');
                } else {
                    const pCode = (f.properties.P_code || '').toString().padStart(2, '0');
                    const aCode = (f.properties.A_code || '').toString().padStart(2, '0');
                    code = pCode + aCode;
                }
                const name = normalizeThaiName(f.properties.A_Name_T || f.properties.AM_TN || f.properties.name || '');
                if (code && name) _distCodeToName[code] = name;
            });
        }
    }

    patientData.forEach(p => {
        const dateStr = p[dataKeys.date];
        const date = parseDateRobust(dateStr);

        if (date && !isNaN(date)) {
            let locName = (p[dataKeys.location] || "").toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, "").trim();
            
            // หาชื่อจังหวัดจากหลายแหล่ง
            let pName = '';
            if (window._matchMode === 'code' && window._codeKeys.province) {
                // Code mode: แปลงรหัส → ชื่อจังหวัด
                const rawCode = (p[window._codeKeys.province] || '').toString().replace(/\D/g, '').padStart(2, '0');
                pName = _provCodeToName[rawCode] || rawCode;
            } else if (dataKeys.province && p[dataKeys.province]) {
                pName = normalizeThaiName(p[dataKeys.province]);
            } else if (locationToProvinceMap[locName]) {
                pName = normalizeThaiName(locationToProvinceMap[locName]);
            } else {
                pName = normalizeThaiName(locName);
            }

            // Scope Check
            if (currentScope.region !== 'all') {
                const provincesInRegion = (TH_HEALTH_REGIONS[currentScope.region] || []).map(pr => normalizeThaiName(pr));
                if (!provincesInRegion.includes(pName)) return;
            }
            if (currentScope.province !== 'all') {
                if (pName !== normalizeThaiName(currentScope.province)) return;
            }
            if (currentScope.district !== 'all') {
                // หาชื่ออำเภอจากข้อมูล
                let dName = '';
                if (window._matchMode === 'code' && window._codeKeys.district) {
                    // Code mode: แปลงรหัส → ชื่ออำเภอ
                    const rawDistCode = (p[window._codeKeys.district] || '').toString().replace(/\D/g, '').padStart(4, '0');
                    dName = _distCodeToName[rawDistCode] || rawDistCode;
                } else if (dataKeys.district && p[dataKeys.district]) {
                    dName = normalizeThaiName(p[dataKeys.district]);
                } else if (currentDataLevel === 'district' || currentDataLevel === 'subdistrict') {
                    dName = normalizeThaiName(locName);
                }
                if (dName !== normalizeThaiName(currentScope.district)) return;
            }

            if (!globalMin || date < globalMin) globalMin = new Date(date);
            if (!globalMax || date > globalMax) globalMax = new Date(date);

            let sortKey = "";
            if (dataGroupingMode === 'daily') sortKey = _localDateKey(date);
            else if (dataGroupingMode === 'weekly') sortKey = getWeekLabel(date);
            else if (dataGroupingMode === 'monthly') sortKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            else if (dataGroupingMode === 'yearly') sortKey = `${date.getFullYear()}`;

            if (!weekMap[sortKey]) {
                weekMap[sortKey] = { counts: {}, total: 0, label: getGroupLabel(date) };
            }

            // --- สร้าง matching key: Code-First, Compound-Name-Fallback ---
            let matchKey = "";
            if (window._matchMode === 'code') {
                matchKey = buildCodeKey(p);
            }
            if (!matchKey) {
                // สร้าง compound key เพื่อป้องกันชื่อซ้ำ (เช่น ตำบลเวียง มีหลายอำเภอ)
                matchKey = buildCompoundNameKey(p);
            }

            if (matchKey) {
                const count = parseInt(p[dataKeys.patients] || 1);
                weekMap[sortKey].counts[matchKey] = (weekMap[sortKey].counts[matchKey] || 0) + count;
                weekMap[sortKey].total += count;
            }
        }
    });

    // 2. เติมช่องว่าง (Gap Filling) เพื่อให้ Timeline ต่อเนื่องไม่ข้าม
    if (globalMin && globalMax) {
        let curr = new Date(globalMin);
        curr.setHours(0, 0, 0, 0);

        const limit = new Date(globalMax);
        limit.setHours(23, 59, 59, 999);

        while (curr <= limit) {
            let sortKey = "";
            if (dataGroupingMode === 'daily') sortKey = _localDateKey(curr);
            else if (dataGroupingMode === 'weekly') sortKey = getWeekLabel(curr);
            else if (dataGroupingMode === 'monthly') sortKey = `${curr.getFullYear()}-${(curr.getMonth() + 1).toString().padStart(2, '0')}`;
            else if (dataGroupingMode === 'yearly') sortKey = `${curr.getFullYear()}`;

            if (!weekMap[sortKey]) {
                weekMap[sortKey] = { counts: {}, total: 0, label: getGroupLabel(curr) };
            }

            // เลื่อนไปข้างหน้าตามโหมดที่เลือก
            if (dataGroupingMode === 'daily') {
                curr.setDate(curr.getDate() + 1);
            } else if (dataGroupingMode === 'weekly') {
                curr.setDate(curr.getDate() + 7);
            } else if (dataGroupingMode === 'monthly') {
                curr.setMonth(curr.getMonth() + 1);
                curr.setDate(1);
            } else if (dataGroupingMode === 'yearly') {
                curr.setFullYear(curr.getFullYear() + 1);
                curr.setMonth(0);
                curr.setDate(1);
            }
        }
    }

    // 3. จัดกลุ่มและสรุปสถิติ
    weeks = Object.keys(weekMap).sort();

    // Safety Check: ถ้าจำนวนจุดใน Timeline เยอะเกินไป (เช่น > 2000 จุด) ให้เตือน
    if (weeks.length > 2000) {
        hideLoader();
        alert(`⚠️ คำเตือน: ตรวจพบช่วงเวลาทั้งหมด ${weeks.length} จุด ซึ่งอาจทำให้เครื่องทำงานช้าลงมาก\n\nแนะนำให้เปลี่ยนการจัดกลุ่มจาก "รายวัน" เป็น "รายสัปดาห์" หรือ "รายเดือน" ในเมนูตั้งค่าครับ`);
        // เรายังยอมให้ทำงานต่อ แต่เตือนไว้ก่อน
    }

    let runningCounts = {};
    let runningTotal = 0;

    weeks.forEach(w => {
        const data = weekMap[w];
        const currentCounts = data.counts;
        const cumulativeCounts = { ...runningCounts };
        
        Object.entries(currentCounts).forEach(([loc, count]) => {
            cumulativeCounts[loc] = (cumulativeCounts[loc] || 0) + count;
        });
        
        runningTotal += data.total;

        const values = Object.values(currentCounts);
        groupedData[w] = {
            label: data.label, // เก็บ Label จริงไว้แสดงผล
            counts: currentCounts,
            cumulativeCounts: cumulativeCounts,
            total: data.total,
            cumulativeTotal: runningTotal,
            stats: calculateStats(values, data.total)
        };

        runningCounts = { ...cumulativeCounts }; // อัปเดตยอดสะสมสำหรับลูปถัดไป
    });
}

function calculateStats(values, total) {
    if (values.length === 0) return { max: 0, min: 0, mean: 0, median: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return {
        max: sorted[sorted.length - 1],
        min: sorted[0],
        mean: (total / values.length).toFixed(1),
        median: sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    };
}

function initTimeline() {
    const slider = document.getElementById('week-slider');
    if (!slider) return;

    if (weeks.length > 1) {
        slider.disabled = false;
        slider.max = weeks.length - 1;
        slider.value = 0;
        currentWeekIndex = 0;
        slider.style.opacity = "1";
    } else {
        slider.max = 0;
        slider.value = 0;
        currentWeekIndex = 0;
        slider.disabled = weeks.length === 0;
        if (weeks.length === 1) slider.style.opacity = "0.5";
    }
}

// --- Map Update Logic ---
function resetAllLayers() {
    // ล้างสไตล์เลเยอร์ข้อมูลเพื่อรอการระบายสีใหม่
    [geojsonLayers.provinces, geojsonLayers.districts, geojsonLayers.subdistricts].forEach(layer => {
        if (layer) {
            layer.eachLayer(l => {
                if (l.unbindTooltip) l.unbindTooltip();
                l.off('mouseover');
                l.off('mouseout');
            });
            layer.setStyle({ fillOpacity: 0, color: "transparent" });
        }
    });
}

function updateMapForCurrentWeek() {
    if (weeks.length === 0) return;
    const weekKey = weeks[currentWeekIndex];
    const data = groupedData[weekKey];

    document.getElementById('current-week-label').innerText = data.label; // ใช้ Label ที่เก็บไว้
    
    const activeCounts = displayValueMode === 'cumulative' ? data.cumulativeCounts : data.counts;
    renderChoropleth(activeCounts, data.stats);
}

function renderChoropleth(counts, stats) {
    if (legendControl) map.removeControl(legendControl);

    // 1. เลือกเลเยอร์เป้าหมาย
    let targetLayer = null;
    let propKeys = [];

    if (currentDataLevel === 'subdistrict' && geojsonLayers.subdistricts) {
        targetLayer = geojsonLayers.subdistricts;
        propKeys = ["tambon", "T_Name_T"];
    } else if (currentDataLevel === 'district' && geojsonLayers.districts) {
        targetLayer = geojsonLayers.districts;
        propKeys = ["A_Name_T", "name"];
    } else if (geojsonLayers.provinces) {
        targetLayer = geojsonLayers.provinces;
        propKeys = ["ADM1_TH", "P_Name_T"];
    }

    if (!targetLayer) return;

    // 2. จัดการเลเยอร์ข้อมูล (Interactive)
    [geojsonLayers.provinces, geojsonLayers.districts, geojsonLayers.subdistricts].forEach(layer => {
        if (!layer) return;
        if (layer === targetLayer) {
            if (!map.hasLayer(layer)) layer.addTo(map);
            layer.eachLayer(l => {
                if (l.unbindTooltip) l.unbindTooltip();
                l.off('mouseover');
                l.off('mouseout');
            });
        } else {
            map.removeLayer(layer);
        }
    });

    // 3. ระบายสีและกรองตาม Scope
    targetLayer.eachLayer(layer => {
        const inScope = isFeatureInScope(layer.feature);

        if (!inScope) {
            layer.setStyle({ fillOpacity: 0, color: "transparent", weight: 0 });
            if (layer.unbindTooltip) layer.unbindTooltip();
            layer.off('mouseover');
            layer.off('mouseout');
            return;
        }

        // --- Code-First Matching: ลองจับคู่ด้วยรหัสก่อน ---
        let val = 0;
        let name = "";
        const fp = layer.feature.properties;

        if (window._matchMode === 'code') {
            const geoCode = getGeoJSONCode(fp, currentDataLevel);
            if (geoCode && counts[geoCode] !== undefined) {
                val = counts[geoCode];
            }
        }

        // --- Name Fallback: ถ้า code ไม่ match หรือไม่ได้ใช้ code ---
        if (val === 0) {
            // Compound key: จังหวัด|อำเภอ|ตำบล (ป้องกันชื่อซ้ำ)
            const compoundKey = buildGeoJSONNameKey(fp, currentDataLevel);
            if (compoundKey && counts[compoundKey] !== undefined) {
                val = counts[compoundKey];
                name = compoundKey.split('|').pop(); // ชื่อสุดท้ายสำหรับ tooltip
            }

            // Simple key fallback (ถ้า Excel ไม่มีคอลัมน์จังหวัด/อำเภอ)
            if (val === 0) {
                for (let key of propKeys) {
                    if (fp[key]) {
                        name = fp[key].toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, "").trim();
                        break;
                    }
                }
                if (name && counts[name] !== undefined) {
                    val = counts[name];
                }
            }
        }


        const pName = (layer.feature.properties.P_Name_T || layer.feature.properties.PV_TN || "").toString().trim();
        const aName = (layer.feature.properties.A_Name_T || layer.feature.properties.AM_TN || "").toString().trim();
        const tName = (layer.feature.properties.T_Name_T || layer.feature.properties.TB_TN || "").toString().trim();

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

        const zeroColor = window._zeroColor;
        layer.setStyle({
            fillColor: val > 0 ? getColor(val) : (zeroColor || "transparent"),
            fillOpacity: val > 0 ? 0.75 : (zeroColor ? 0.75 : 0),
            color: "transparent",
            weight: 0
        });

        if (val > 0) {
            const displayLabel = displayValueMode === 'cumulative' ? 'จำนวนสะสม' : 'จำนวน';
            layer.bindTooltip(`
                <div style="text-align: center;">
                    <div style="font-weight: bold; margin-bottom: 4px; color: #3b82f6;">${fullName || name}</div>
                    <div style="font-size: 1.1rem;">${displayLabel}: <span style="color: #ef4444; font-weight: bold;">${val.toLocaleString()}</span></div>
                </div>
            `, { sticky: true, direction: 'auto', className: 'custom-tooltip' });

            layer.on('mouseover', function (e) {
                this.setStyle({ fillOpacity: 0.9, color: "#3b82f6", weight: 2 });
            });

            layer.on('mouseout', function (e) {
                this.setStyle({ fillOpacity: 0.75, color: "transparent", weight: 0 });
            });
        }
    });


    createLegend(stats);

}

// --- Helpers ---
function getColor(v) {
    if (v === 0 || !v) return window._zeroColor || 'transparent';

    // ค้นหาว่า v อยู่ในช่วงไหนของ currentBreaks
    // currentBreaks = [0, 5, 10, 20, ...]
    for (let i = 1; i < currentBreaks.length; i++) {
        if (v <= currentBreaks[i]) return CONFIG.colors[i - 1];
    }
    return CONFIG.colors[classCount - 2] || CONFIG.colors[CONFIG.colors.length - 1];
}

function createLegend(stats) {
    legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'legend-container');
        div.style.marginBottom = '5px';
        div.innerHTML = `<p style="margin-bottom:8px; font-weight:bold; font-size:0.85rem;">${dataKeys.patients || 'จำนวนผู้ป่วย (ราย)'}</p>`;

        currentBreaks.forEach((brk, idx) => {
            let labelText = "";
            let color = "transparent";

            if (idx === 0) {
                labelText = "0 (ไม่มีข้อมูล)";
                color = window._zeroColor || "#f3f4f6";
            } else {
                const lower = currentBreaks[idx - 1] + 1;
                const upper = brk;
                labelText = `${lower} - ${upper}`;
                color = CONFIG.colors[idx - 1];
            }

            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; margin-bottom:4px;';

            const swatch = document.createElement('i');
            swatch.style.cssText = `background:${color}; width:16px; height:16px; border-radius:3px; margin-right:8px; opacity:0.8; border:1px solid rgba(255,255,255,0.1); flex-shrink:0; cursor:pointer;`;
            swatch.title = 'คลิกเพื่อเปลี่ยนสี';

            // Clickable color picker for all classes
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = color.startsWith('#') ? color : '#f3f4f6';
            colorInput.style.cssText = 'position:absolute; opacity:0; width:0; height:0; pointer-events:none;';
            swatch.onclick = (e) => { e.stopPropagation(); colorInput.click(); };
            colorInput.oninput = (ev) => {
                const newColor = ev.target.value;
                if (idx === 0) {
                    // เก็บสี 0 ไว้ใน variable พิเศษ
                    window._zeroColor = newColor;
                } else {
                    CONFIG.colors[idx - 1] = newColor;
                }
                swatch.style.background = newColor;
                const picker = document.getElementById('palette-picker');
                if (picker) picker.querySelectorAll('div').forEach(d => d.style.borderColor = 'transparent');
                updateMapForCurrentWeek();
            };
            row.appendChild(colorInput);

            const label = document.createElement('span');
            label.style.cssText = 'font-size:0.75rem; color:#ccc;';
            label.textContent = labelText;

            row.appendChild(swatch);
            row.appendChild(label);
            div.appendChild(row);
        });

        // Stop map events when interacting with legend
        L.DomEvent.disableClickPropagation(div);
        return div;
    };
    legendControl.addTo(map);
}

function updateStatsUI(stats) {
    statsControl = L.control({ position: 'bottomright' });
    statsControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'info stats-panel');

        let modeTitle = "รายสัปดาห์";
        if (dataGroupingMode === 'daily') modeTitle = "รายวัน";
        else if (dataGroupingMode === 'monthly') modeTitle = "รายเดือน";
        else if (dataGroupingMode === 'yearly') modeTitle = "รายปี";
        if (customEpiSettings.enabled) modeTitle = "รายสัปดาห์ระบาด";

        div.style.background = 'rgba(15, 23, 42, 0.9)';
        div.style.padding = '12px';
        div.style.borderRadius = '12px';
        div.style.border = '1px solid rgba(59, 130, 246, 0.3)';
        div.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
        div.style.color = 'white';
        div.style.width = '200px';
        div.style.marginBottom = '5px'; // ระยะห่างจากขอบล่างสุดเล็กน้อย

        div.innerHTML = `
            <div style="color: #3b82f6; font-size: 0.75rem; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(59, 130, 246, 0.2); padding-bottom: 4px;">
                สถิติภาพรวม (${modeTitle})
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                    <div style="color: #94a3b8; font-size: 0.6rem;">สูงสุด</div>
                    <div style="color: #ef4444; font-weight: bold; font-size: 0.9rem;">${typeof stats.max === 'number' ? stats.max.toLocaleString() : stats.max}</div>
                </div>
                <div>
                    <div style="color: #94a3b8; font-size: 0.6rem;">ต่ำสุด</div>
                    <div style="color: #10b981; font-weight: bold; font-size: 0.9rem;">${typeof stats.min === 'number' ? stats.min.toLocaleString() : stats.min}</div>
                </div>
                <div>
                    <div style="color: #94a3b8; font-size: 0.6rem;">ค่าเฉลี่ย</div>
                    <div style="font-weight: 600; font-size: 0.85rem;">${stats.mean}</div>
                </div>
                <div>
                    <div style="color: #94a3b8; font-size: 0.6rem;">มัธยฐาน</div>
                    <div style="font-weight: 600; font-size: 0.85rem;">${stats.median}</div>
                </div>
            </div>
            ${stats.maxLocation ? `
            <div style="margin-top: 8px; border-top: 1px solid rgba(59, 130, 246, 0.15); padding-top: 6px;">
                <div style="color: #94a3b8; font-size: 0.55rem;">📍 สูงสุดที่</div>
                <div style="color: #fbbf24; font-size: 0.7rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${stats.maxLocation}</div>
                <div style="color: #94a3b8; font-size: 0.55rem; margin-top: 2px;">📅 ${stats.maxPeriod}</div>
            </div>` : ''}
        `;
        return div;
    };
    statsControl.addTo(map);
}

// อัปเดตองค์ประกอบ UI อื่นๆ
function updateUIElements() {
    const badge = document.getElementById('current-mode-badge');
    if (badge) {
        let modeName = "จัดกลุ่มข้อมูล";
        if (dataGroupingMode === 'daily') modeName = "โหมดรายวัน";
        else if (dataGroupingMode === 'weekly') {
            modeName = customEpiSettings.enabled ? "โหมดรายสัปดาห์ (ระบาด)" : "โหมดรายสัปดาห์ (ISO)";
        }
        else if (dataGroupingMode === 'monthly') modeName = "โหมดรายเดือน";
        else if (dataGroupingMode === 'yearly') modeName = "โหมดรายปี";

        badge.innerText = modeName;
        badge.style.display = 'block';
    }
}

function getISOWeek(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return date.getFullYear() + "-W" + (1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)).toString().padStart(2, '0');
}

// ฟังก์ชันหาจุดเริ่มต้นสัปดาห์ที่ 1 ของปี AD นั้นๆ (กฎ: อาทิตย์ของสัปดาห์ที่มี 1 ม.ค.)
function getThaiEpiStartAD(yearAD) {
    let firstJan = new Date(yearAD, 0, 1);
    let start = new Date(firstJan.getTime());
    start.setDate(firstJan.getDate() - firstJan.getDay()); // ถอยกลับไปวันอาทิตย์
    start.setHours(0, 0, 0, 0);
    return start;
}

// คำนวณข้อมูลสัปดาห์ระบาดไทยแบบไดนามิก (รองรับการข้ามปีอัตโนมัติ)
function getThaiWeekInfo(date) {
    let d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);

    let year = d.getFullYear();
    let startThis = getThaiEpiStartAD(year);
    let startNext = getThaiEpiStartAD(year + 1);

    let targetYear, targetStart;

    if (d < startThis) {
        // ถ้าวันที่มีค่าน้อยกว่าจุดเริ่มปีนี้ แสดงว่าต้องอยู่ปีที่แล้ว
        targetYear = year - 1;
        targetStart = getThaiEpiStartAD(year - 1);
    } else if (d >= startNext) {
        // ถ้าวันที่มีค่าตั้งแต่จุดเริ่มปีหน้าเป็นต้นไป แสดงว่าเป็น Week 1 ของปีหน้า
        targetYear = year + 1;
        targetStart = startNext;
    } else {
        // อยู่ในปีปัจจุบัน
        targetYear = year;
        targetStart = startThis;
    }

    const diff = d.getTime() - targetStart.getTime();
    const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;

    return {
        label: `${targetYear + 543}-W${weekNum.toString().padStart(2, '0')}`,
        start: targetStart,
        weekNum: weekNum
    };
}

function getWeekLabel(date) {
    if (customEpiSettings.enabled) {
        return getThaiWeekInfo(date).label;
    }
    return getISOWeek(date);
}

function getWeekDateRange(date) {
    let start;
    if (customEpiSettings.enabled) {
        const info = getThaiWeekInfo(date);
        // วันเริ่มต้นของสัปดาห์นั้นจริงๆ
        const weekStart = new Date(info.start.getTime());
        weekStart.setDate(weekStart.getDate() + (info.weekNum - 1) * 7);
        start = weekStart;
    } else {
        start = new Date(date);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
    }
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const fmt = (d) => `${d.getDate()} ${monthsShort[d.getMonth()]}`;
    return `${fmt(start)} - ${fmt(end)}`;
}

function getGroupLabel(date) {
    if (dataGroupingMode === 'daily') {
        const d = date.getDate();
        const m = monthsFull[date.getMonth()];
        const y = date.getFullYear() + 543;
        return `${d} ${m} ${y}`;
    } else if (dataGroupingMode === 'weekly') {
        return `${getWeekLabel(date)} (${getWeekDateRange(date)})`;
    } else if (dataGroupingMode === 'monthly') {
        const m = monthsFull[date.getMonth()];
        const y = date.getFullYear() + 543;
        return `${m} ${y}`;
    } else if (dataGroupingMode === 'yearly') {
        return `ปี พ.ศ. ${date.getFullYear() + 543}`;
    }
}

function togglePlay() {
    isPlaying = !isPlaying;
    const btn = document.getElementById('play-pause');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');

    if (isPlaying) {
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
        playInterval = setInterval(() => {
            currentWeekIndex++;
            if (currentWeekIndex >= weeks.length) currentWeekIndex = 0;
            document.getElementById('week-slider').value = currentWeekIndex;
            updateMapForCurrentWeek();
        }, CONFIG.animationSpeed);
    } else {
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
        clearInterval(playInterval);
    }
}

function parseDateRobust(dateStr) {
    if (dateStr === null || dateStr === undefined || dateStr === "") return null;
    if (dateStr instanceof Date) return dateStr;

    let d = null;

    // 1. ถ้าเป็นตัวเลข (อาจเป็น Excel Serial Date)
    if (typeof dateStr === 'number') {
        // Excel Serial Dates มักจะ > 30000 (ปี 1982+)
        if (dateStr > 20000) {
            // ใช้เที่ยงวัน UTC เพื่อป้องกัน timezone shift
            d = new Date((dateStr - 25569) * 86400 * 1000 + 43200000);
        } else if (dateStr >= 1900 && dateStr <= 2100) {
            // กรณีเป็นแค่ตัวเลขปี ให้ถือเป็นวันที่ 1 ม.ค. ของปีนั้น
            d = new Date(dateStr, 0, 1);
        } else {
            // ตัวเลขอื่นๆ ไม่ควรเป็นวันที่ที่ถูกต้องในระบบนี้
            return null;
        }
    } else {
        const s = dateStr.toString().trim();
        if (!s) return null;

        // 2. ลอง parse ปกติ (ISO หรือ Local Format)
        d = new Date(s);

        // 3. ถ้า parse ปกติไม่ได้ หรือได้ปี 1970 (ซึ่งมักจะผิดพลาดจากค่า 0) ให้ลอง Manual
        if (isNaN(d.getTime()) || d.getFullYear() === 1970) {
            const parts = s.split(/[\/\-\.]/);
            if (parts.length === 3) {
                let day, month, year;
                if (parts[0].length === 4) { // YYYY-MM-DD
                    year = parseInt(parts[0]);
                    month = parseInt(parts[1]) - 1;
                    day = parseInt(parts[2]);
                } else { // DD/MM/YYYY
                    day = parseInt(parts[0]);
                    month = parseInt(parts[1]) - 1;
                    year = parseInt(parts[2]);
                }
                d = new Date(year, month, day);
            }
        }
    }

    if (d && !isNaN(d.getTime())) {
        // จัดการปี พ.ศ.
        if (d.getFullYear() > 2400) d.setFullYear(d.getFullYear() - 543);
        // ถ้าได้ปี 1970 และต้นฉบับไม่ใช่ "1970" ให้ถือว่าผิดพลาด
        if (d.getFullYear() === 1970 && !dateStr.toString().includes("1970")) return null;
        return d;
    }

    return null;
}

function showLoader(text) {
    const loader = document.getElementById('loader');
    if (loader) {
        document.getElementById('loader-text').innerText = text;
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

// --- Event Listeners for Settings Modal ---
document.getElementById('epi-settings-btn').addEventListener('click', () => {
    document.getElementById('epi-modal').style.display = 'flex';
});

document.getElementById('close-epi-modal').addEventListener('click', () => {
    document.getElementById('epi-modal').style.display = 'none';
});

document.getElementById('apply-settings-btn').addEventListener('click', () => {
    const selectedMode = document.querySelector('input[name="group-mode"]:checked').value;
    const selectedDisplayMode = document.querySelector('input[name="display-value-mode"]:checked').value;

    // Reset defaults
    customEpiSettings.enabled = false;

    if (selectedMode === 'weekly_epi') {
        dataGroupingMode = 'weekly';
        customEpiSettings.enabled = true;
    } else {
        dataGroupingMode = selectedMode;
    }
    
    displayValueMode = selectedDisplayMode;

    if (patientData.length > 0) {
        showLoader("กำลังประมวลผลข้อมูลใหม่...");
        setTimeout(() => {
            groupDataByWeek();
            if (weeks.length > 0) {
                initTimeline();
                calculateGlobalStats();
                if (statsControl) { map.removeControl(statsControl); statsControl = null; }
                updateStatsUI(globalStats);
                updateUIElements();
                generateBreaksUI(true);
                updateMapForCurrentWeek();
            }
            hideLoader();
        }, 500);
    }

    document.getElementById('epi-modal').style.display = 'none';
});

// --- Line Listing Converter Logic ---
let converterRawData = [];
let converterResult = [];

// UI Controls
document.getElementById('open-converter').addEventListener('click', () => {
    resetConverterUI();
    document.getElementById('converter-modal').style.display = 'flex';
});

document.getElementById('close-converter').addEventListener('click', () => {
    document.getElementById('converter-modal').style.display = 'none';
    resetConverterUI();
});

function resetConverterUI() {
    document.getElementById('conv-step-1').style.display = 'block';
    document.getElementById('conv-step-2').style.display = 'none';
    document.getElementById('conv-step-3').style.display = 'none';
    document.getElementById('conv-file-input').value = '';
    converterRawData = [];
    converterResult = [];
}

const convDropZone = document.getElementById('conv-drop-zone');
const convFileInput = document.getElementById('conv-file-input');

convDropZone.onclick = () => convFileInput.click();

// Drag and Drop for Converter
convDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    convDropZone.style.background = "rgba(59, 130, 246, 0.1)";
    convDropZone.style.borderColor = "#3b82f6";
});

['dragleave', 'drop'].forEach(evt => {
    convDropZone.addEventListener(evt, () => {
        convDropZone.style.background = "rgba(255,255,255,0.02)";
        convDropZone.style.borderColor = "rgba(255,255,255,0.2)";
    });
});

convDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
        handleConverterFileUpload(e.dataTransfer.files[0]);
    }
});

convFileInput.onchange = (e) => {
    if (e.target.files.length > 0) handleConverterFileUpload(e.target.files[0]);
};

function handleConverterFileUpload(file) {
    showLoader("กำลังอ่านไฟล์ Line Listing...");
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

            if (json.length === 0) {
                alert("ไฟล์ว่างเปล่าหรือไม่มีข้อมูล");
                hideLoader();
                return;
            }

            converterRawData = json;
            const headers = Object.keys(json[0]);

            // Populate all 4 dropdowns
            const dateSelect = document.getElementById('conv-col-date');
            const provSelect = document.getElementById('conv-col-prov');
            const distSelect = document.getElementById('conv-col-dist');
            const subSelect = document.getElementById('conv-col-sub');

            dateSelect.innerHTML = '';
            provSelect.innerHTML = '';
            distSelect.innerHTML = '<option value="">— ไม่มี —</option>';
            subSelect.innerHTML = '<option value="">— ไม่มี —</option>';

            headers.forEach(h => {
                [dateSelect, provSelect, distSelect, subSelect].forEach(sel => {
                    sel.add(new Option(h, h));
                });
            });

            // Auto-detect
            const dateKey = headers.find(k => k.includes('วัน') || k.toLowerCase().includes('date'));
            const provKey = headers.find(k => k.includes('จังหวัด') || k.toLowerCase().includes('province'));
            const distKey = headers.find(k => (k.includes('อำเภอ') || k.toLowerCase().includes('district')) && !k.toLowerCase().includes('subdistrict'));
            const subKey = headers.find(k => k.includes('ตำบล') || k.toLowerCase().includes('subdistrict') || k.toLowerCase().includes('tambon'));

            if (dateKey) dateSelect.value = dateKey;
            if (provKey) provSelect.value = provKey;
            if (distKey) distSelect.value = distKey; else distSelect.value = '';
            if (subKey) subSelect.value = subKey; else subSelect.value = '';

            document.getElementById('conv-step-1').style.display = 'none';
            document.getElementById('conv-step-2').style.display = 'block';
            hideLoader();
        } catch (err) {
            alert("Error: " + err.message);
            hideLoader();
        }
    };
    reader.readAsArrayBuffer(file);
}

// สร้าง Reference Map จาก GeoJSON: ชื่อไทย → { english, code } + reverse code→name
function generateReferenceMap() {
    const refMap = {
        provinces: {}, districts: {}, subdistricts: {},
        // Reverse: code → { thai, english }
        byCode: { provinces: {}, districts: {}, subdistricts: {} }
    };
    const strip = s => (s || '').toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, '').trim();
    const stripEng = s => (s || '').toString().replace(/^(CHANGWAT|AMPHOE|KING AMPHOE|TAMBON)\s+/i, '').trim();
    const layers = [
        { data: window.DATA_TH_PROVINCES, level: 'province' },
        { data: window.DATA_TH_DISTRICTS, level: 'district' },
        { data: window.DATA_TH_SUBDISTRICTS, level: 'subdistrict' }
    ];
    layers.forEach(({ data, level }) => {
        if (!data || !data.features) return;
        data.features.forEach(f => {
            const p = f.properties;
            if (level === 'province') {
                const key = strip(p.P_Name_T || p.changwat || '');
                const eng = stripEng(p.P_Name_E || '');
                const code = (p.P_code || '').toString().padStart(2, '0');
                if (key) {
                    refMap.provinces[key] = { english: eng, code };
                    refMap.byCode.provinces[code] = { thai: key, english: eng };
                }
            } else if (level === 'district') {
                const pKey = strip(p.P_Name_T || '');
                const aKey = strip(p.A_Name_T || p.amphur || '');
                const eng = stripEng(p.A_Name_E || '');
                const pCode = (p.P_code || '').toString().padStart(2, '0');
                const aCode = (p.A_code || '').toString().padStart(2, '0');
                const fullCode = pCode + aCode;
                if (aKey) {
                    refMap.districts[`${pKey}|${aKey}`] = { english: eng, code: fullCode };
                    refMap.byCode.districts[fullCode] = { thai: aKey, english: eng, province: pKey };
                }
            } else {
                const pKey = strip(p.P_Name_T || '');
                const aKey = strip(p.A_Name_T || '');
                const tKey = strip(p.T_Name_T || p.tambon || '');
                const eng = stripEng(p.T_Name_E || '');
                const adminCode = (p.Admin_code || '').toString().padStart(6, '0');
                if (tKey) {
                    refMap.subdistricts[`${pKey}|${aKey}|${tKey}`] = { english: eng, code: adminCode };
                    refMap.byCode.subdistricts[adminCode] = { thai: tKey, english: eng, district: aKey, province: pKey };
                }
            }
        });
    });
    return refMap;
}

// ประมวลผล Line Listing → Aggregate
function processConverterData(data, config) {
    const { dateCol, provCol, distCol, subCol, outputFormat, refMap } = config;
    const strip = s => (s || '').toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, '').trim();
    const aggregated = {};
    let matchedRows = 0;
    const unmatchedSet = new Set();
    const hasDistrict = !!distCol;
    const hasSubdistrict = !!subCol;

    data.forEach(row => {
        const date = parseDateRobust(row[dateCol]);
        if (!date || isNaN(date)) return;
        let rawProv = (row[provCol] || '').toString().trim();
        let rawDist = distCol ? (row[distCol] || '').toString().trim() : '';
        let rawSub = subCol ? (row[subCol] || '').toString().trim() : '';
        if (!rawProv) return;

        // Detect: input เป็นรหัสหรือชื่อ?
        const isCodeInput = /^\d{2,6}$/.test(rawProv);
        let prov, dist, sub;

        if (isCodeInput) {
            // --- Input เป็นรหัส → ใช้ reverse lookup ---
            const pCode = rawProv.toString().padStart(2, '0');
            const pRef = refMap.byCode.provinces[pCode];
            prov = pRef ? pRef.thai : rawProv;

            if (rawDist) {
                const dCode = rawDist.toString().padStart(4, '0');
                const dRef = refMap.byCode.districts[dCode];
                dist = dRef ? dRef.thai : rawDist;
            } else { dist = ''; }

            if (rawSub) {
                const sCode = rawSub.toString().padStart(6, '0');
                const sRef = refMap.byCode.subdistricts[sCode];
                sub = sRef ? sRef.thai : rawSub;
            } else { sub = ''; }
        } else {
            // --- Input เป็นชื่อ ---
            prov = strip(rawProv);
            dist = distCol ? strip(rawDist) : '';
            sub = subCol ? strip(rawSub) : '';
            dist = _expandMueang(dist, prov);
        }

        let outProv = prov, outDist = dist, outSub = sub;
        if (outputFormat === 'english') {
            const pRef = refMap.provinces[prov];
            outProv = pRef ? pRef.english : prov;
            if (dist) {
                const dRef = refMap.districts[`${prov}|${dist}`];
                outDist = dRef ? dRef.english : dist;
            }
            if (sub) {
                const sRef = refMap.subdistricts[`${prov}|${dist}|${sub}`];
                outSub = sRef ? sRef.english : sub;
            }
        } else if (outputFormat === 'code') {
            const pRef = refMap.provinces[prov];
            if (pRef) outProv = pRef.code; else unmatchedSet.add(prov);
            if (dist) {
                const dRef = refMap.districts[`${prov}|${dist}`];
                if (dRef) outDist = dRef.code; else unmatchedSet.add(dist);
            }
            if (sub) {
                const sRef = refMap.subdistricts[`${prov}|${dist}|${sub}`];
                if (sRef) outSub = sRef.code; else unmatchedSet.add(sub);
            }
        }
        // outputFormat === 'thai' → outProv/outDist/outSub already Thai

        const dateKey = _localDateKey(date);
        const locKey = [outProv, outDist, outSub].filter(Boolean).join('|');
        if (!aggregated[dateKey]) aggregated[dateKey] = {};
        aggregated[dateKey][locKey] = (aggregated[dateKey][locKey] || 0) + 1;
        matchedRows++;
    });

    // Build output
    const outputRows = [];
    Object.keys(aggregated).sort().forEach(dateKey => {
        Object.entries(aggregated[dateKey]).forEach(([locKey, count]) => {
            const parts = locKey.split('|');
            const row = { 'วันที่': dateKey };
            if (outputFormat === 'code') {
                row['รหัสจังหวัด'] = parts[0] || '';
                if (hasDistrict) row['รหัสอำเภอ'] = parts[1] || '';
                if (hasSubdistrict) row['รหัสตำบล'] = parts[hasDistrict ? 2 : 1] || '';
            } else {
                row['จังหวัด'] = parts[0] || '';
                if (hasDistrict) row['อำเภอ'] = parts[1] || '';
                if (hasSubdistrict) row['ตำบล'] = parts[hasDistrict ? 2 : 1] || '';
            }
            row['จำนวนผู้ป่วย'] = count;
            outputRows.push(row);
        });
    });

    return { aggregated: outputRows, stats: { totalRows: data.length, matchedRows, unmatchedCount: unmatchedSet.size, unmatchedList: [...unmatchedSet].slice(0, 50) } };
}

function updateConverterProgress(percent) {
    const bar = document.getElementById('conv-progress-bar');
    if (bar) { bar.style.width = percent + '%'; bar.innerText = percent + '%'; }
}

function handleConverterResult(result) {
    converterResult = result.aggregated;
    const stats = result.stats;
    hideLoader();
    if (converterResult.length === 0) { alert("ไม่สามารถสรุปข้อมูลได้"); return; }
    document.getElementById('conv-result-count').innerText = converterResult.length;
    const reportHtml = `<div style="margin-top:15px;font-size:0.8rem;text-align:left;background:rgba(0,0,0,0.2);padding:10px;border-radius:6px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>แถวทั้งหมด:</span><span style="color:#fff;">${stats.totalRows.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>ประมวลผลสำเร็จ:</span><span style="color:#10b981;">${stats.matchedRows.toLocaleString()} (${Math.round(stats.matchedRows / stats.totalRows * 100)}%)</span></div>
        ${stats.unmatchedCount > 0 ? `<div style="display:flex;justify-content:space-between;color:#f59e0b;"><span>แปลงชื่อไม่ได้:</span><span>${stats.unmatchedCount} รายการ</span></div>
        <div style="margin-top:6px;color:#94a3b8;font-size:0.7rem;"><b>ตัวอย่าง:</b> ${stats.unmatchedList.slice(0, 10).join(', ')}</div>` : ''}
    </div>`;
    document.getElementById('conv-report-container').innerHTML = reportHtml;
    document.getElementById('conv-step-2').style.display = 'none';
    document.getElementById('conv-step-3').style.display = 'block';
}

document.getElementById('process-conv-btn').addEventListener('click', () => {
    const dateCol = document.getElementById('conv-col-date').value;
    const provCol = document.getElementById('conv-col-prov').value;
    const distCol = document.getElementById('conv-col-dist').value;
    const subCol = document.getElementById('conv-col-sub').value;
    const outputFormat = document.querySelector('input[name="conv-output-format"]:checked').value;

    if (!dateCol || !provCol) {
        alert("กรุณาเลือกคอลัมน์วันที่และจังหวัด");
        return;
    }

    showLoader("กำลังประมวลผล...");

    const progressContainer = document.getElementById('conv-progress-container');
    if (progressContainer) progressContainer.style.display = 'block';
    updateConverterProgress(0);

    // Build reference map from GeoJSON for name/code conversion
    const refMap = generateReferenceMap();

    // Process in main thread (simpler than worker for this)
    setTimeout(() => {
        try {
            const result = processConverterData(converterRawData, {
                dateCol, provCol, distCol, subCol, outputFormat, refMap
            });
            handleConverterResult(result);
        } catch (err) {
            alert("Error: " + err.message);
            hideLoader();
        }
    }, 100);
});

document.getElementById('apply-conv-result').addEventListener('click', () => {
    if (converterResult.length === 0) return;

    resetState();

    // Re-process ข้อมูลต้นฉบับเป็น Thai สำหรับแผนที่ (ไม่ว่า user เลือก format ไหนสำหรับ download)
    const refMap = generateReferenceMap();
    const dateCol = document.getElementById('conv-col-date').value;
    const provCol = document.getElementById('conv-col-prov').value;
    const distCol = document.getElementById('conv-col-dist').value;
    const subCol = document.getElementById('conv-col-sub').value;

    const thaiResult = processConverterData(converterRawData, {
        dateCol, provCol, distCol, subCol, outputFormat: 'thai', refMap
    });
    const mapData = thaiResult.aggregated;
    if (mapData.length === 0) { alert("ไม่สามารถประมวลผลข้อมูลได้"); return; }

    // ตั้ง dataKeys จาก Thai output
    const keys = Object.keys(mapData[0]);
    const locKey = keys.find(k => k.includes('ตำบล')) || keys.find(k => k.includes('อำเภอ')) || keys.find(k => k.includes('จังหวัด'));
    dataKeys = {
        date: 'วันที่',
        location: locKey || keys[1],
        patients: 'จำนวนผู้ป่วย',
        province: keys.find(k => k.includes('จังหวัด')) || '',
        district: keys.find(k => k.includes('อำเภอ')) || '',
        subdistrict: keys.find(k => k.includes('ตำบล')) || ''
    };

    // Detect level
    if (keys.find(k => k.includes('ตำบล'))) currentDataLevel = 'subdistrict';
    else if (keys.find(k => k.includes('อำเภอ'))) currentDataLevel = 'district';
    else currentDataLevel = 'province';
    window._matchMode = 'name';

    patientData = mapData;

    showLoader("กำลังนำข้อมูลเข้าแผนที่...");
    setTimeout(() => {
        // Skip processData's re-detection — go straight to map rendering
        resetAllLayers();
        locationToProvinceMap = {};
        if (dataKeys.province) {
            mapData.forEach(p => {
                const loc = (p[dataKeys.location] || "").toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, "").trim();
                const prov = (p[dataKeys.province] || "").toString().replace(/จังหวัด|จ\./g, "").trim();
                if (loc && prov) locationToProvinceMap[loc] = prov;
            });
        }
        groupDataByWeek();
        if (weeks.length === 0) {
            hideLoader();
            alert("ไม่พบข้อมูลที่ระบุสัปดาห์หรือวันที่ได้");
            return;
        }
        initTimeline();
        document.getElementById('timeline').style.display = 'flex';
        document.getElementById('choro-settings').style.display = 'block';
        document.getElementById('open-compare-btn').style.display = 'flex';
        calculateGlobalStats();
        updateStatsUI(globalStats);
        updateUIElements();
        generateBreaksUI(true);
        updateMapForCurrentWeek();
        document.getElementById('converter-modal').style.display = 'none';
        hideLoader();
    }, 500);
});

// Download CSV
document.getElementById('download-conv-csv').addEventListener('click', () => {
    if (converterResult.length === 0) return;
    const headers = Object.keys(converterResult[0]);
    let csv = "\ufeff" + headers.join(",") + "\n";
    converterResult.forEach(row => {
        csv += headers.map(h => {
            const v = (row[h] || '').toString();
            return v.includes(',') ? `"${v}"` : v;
        }).join(",") + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "aggregated_data.csv";
    link.click();
});

// Download Excel
document.getElementById('download-conv-excel').addEventListener('click', () => {
    if (converterResult.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(converterResult);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aggregated");
    XLSX.writeFile(wb, "aggregated_data.xlsx");
});

document.getElementById('reset-conv-btn').addEventListener('click', resetConverterUI);

// --- Area Scope Functions ---
function initScopeSelectors() {
    const trigger = document.getElementById('area-selection-trigger');
    const modal = document.getElementById('area-modal');
    const overlay = document.getElementById('area-modal-overlay');
    const closeBtn = document.getElementById('close-area-modal');
    const applyBtn = document.getElementById('apply-area-btn');

    const regSelect = document.getElementById('scope-region');
    const provSelect = document.getElementById('scope-province');
    const distSelect = document.getElementById('scope-district');
    const provWrapper = document.getElementById('province-scope-wrapper');
    const distWrapper = document.getElementById('district-scope-wrapper');

    const openModal = () => {
        // Sync selects with current scope before showing
        regSelect.value = currentScope.region;
        regSelect.dispatchEvent(new Event('change'));
        provSelect.value = currentScope.province;
        provSelect.dispatchEvent(new Event('change'));
        distSelect.value = currentScope.district;

        modal.classList.add('active');
        if (overlay) overlay.style.display = 'block';
    };

    const closeModal = () => {
        modal.classList.remove('active');
        if (overlay) overlay.style.display = 'none';
    };

    if (trigger) trigger.onclick = openModal;
    if (closeBtn) closeBtn.onclick = closeModal;
    if (overlay) overlay.onclick = closeModal;

    regSelect.onchange = () => {
        provSelect.innerHTML = '<option value="all">ทั้งหมดในเขต</option>';
        distSelect.innerHTML = '<option value="all">ทั้งหมดในจังหวัด</option>';
        distWrapper.style.display = 'none';

        if (regSelect.value === 'all') {
            provWrapper.style.display = 'none';
        } else {
            provWrapper.style.display = 'block';
            const provinces = TH_HEALTH_REGIONS[regSelect.value] || [];
            [...provinces].sort((a, b) => a.localeCompare(b, 'th')).forEach(p => {
                provSelect.add(new Option(p, p));
            });
        }
    };

    provSelect.onchange = () => {
        distSelect.innerHTML = '<option value="all">ทั้งหมดในจังหวัด</option>';
        if (provSelect.value === 'all') {
            distWrapper.style.display = 'none';
        } else {
            distWrapper.style.display = 'block';
            const districts = getDistrictsForProvince(provSelect.value);
            districts.sort((a, b) => a.localeCompare(b, 'th')).forEach(d => {
                distSelect.add(new Option(d, d));
            });
        }
    };

    applyBtn.onclick = () => {
        currentScope.region = regSelect.value;
        currentScope.province = provSelect.value;
        currentScope.district = distSelect.value;

        // Update Trigger Display
        const display = document.getElementById('current-area-display');
        let statusText = "ทั้งหมด (ทั้งประเทศ)";

        if (currentScope.district !== 'all') {
            statusText = `อ.${currentScope.district} จ.${currentScope.province}`;
        } else if (currentScope.province !== 'all') {
            statusText = `จ.${currentScope.province}`;
        } else if (currentScope.region !== 'all') {
            statusText = `เขตสุขภาพที่ ${currentScope.region}`;
        }

        display.innerText = statusText;
        closeModal();
        applyScopeFilter();
    };
}

function getDistrictsForProvince(provName) {
    if (!window.DATA_TH_DISTRICTS) return [];
    const dists = new Set();
    window.DATA_TH_DISTRICTS.features.forEach(f => {
        const p = f.properties;
        const pName = normalizeThaiName(p.P_Name_T || p.PV_TN);
        if (pName === normalizeThaiName(provName)) {
            const aName = (p.A_Name_T || p.AM_TN || p.name || "").toString().replace(/อำเภอ|อ\./g, "").trim();
            if (aName) dists.add(aName);
        }
    });
    return Array.from(dists);
}

let maskLayer = null;

async function applyScopeFilter() {
    // 1. โหลด GeoJSON เพิ่มเติมหากจำเป็น
    await loadGeoJSONLayers();

    // 2. อัปเดต Mask เพื่อตัดพื้นที่ส่วนเกินออก
    updateMapMask();

    // 3. Zoom
    zoomToCurrentScope();

    // 4. ประมวลผลข้อมูล
    if (patientData.length > 0) {
        showLoader("กำลังประมวลผลข้อมูลตามขอบเขตใหม่...");
        setTimeout(() => {
            groupDataByWeek();
            if (weeks.length > 0) {
                initTimeline();
                calculateGlobalStats();
                if (statsControl) { map.removeControl(statsControl); statsControl = null; }
                updateStatsUI(globalStats);
                updateUIElements();
                generateBreaksUI(true);
                updateMapForCurrentWeek();
            } else {
                if (statsControl) { map.removeControl(statsControl); statsControl = null; }
                updateStatsUI({ max: '-', min: '-', mean: '-', median: '-', maxLocation: '', maxPeriod: '' });
                if (legendControl) { map.removeControl(legendControl); legendControl = null; }
                if (geojsonLayers.choropleth) { map.removeLayer(geojsonLayers.choropleth); geojsonLayers.choropleth = null; }
                const timeline = document.getElementById('timeline');
                if (timeline) timeline.style.display = 'none';
            }
            hideLoader();
        }, 300);
    } else {
        updateMapForCurrentWeek();
    }
}

function updateMapMask() {
    if (maskLayer) map.removeLayer(maskLayer);

    // ถ้าเลือก "ทั้งหมด" ไม่ต้องมีหน้ากาก
    if (currentScope.region === 'all' && currentScope.province === 'all' && currentScope.district === 'all') return;

    // พิกัดครอบคลุมทั้งโลก (ตามเข็มนาฬิกา)
    const worldCoords = [
        [90, -180], [90, 180], [-90, 180], [-90, -180], [90, -180]
    ];

    const targetHoles = [];
    let featuresToUse = [];

    // หา GeoJSON ที่ตรงกับขอบเขตปัจจุบัน
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

    // แปลงพิกัด GeoJSON เป็น Leaflet LatLng (สลับ [lon, lat] เป็น [lat, lon])
    featuresToUse.forEach(f => {
        const coords = f.geometry.coordinates;
        const addHole = (rings) => {
            rings.forEach(ring => {
                targetHoles.push(ring.map(c => [c[1], c[0]]));
            });
        };

        if (f.geometry.type === 'Polygon') {
            addHole(coords);
        } else if (f.geometry.type === 'MultiPolygon') {
            coords.forEach(poly => addHole(poly));
        }
    });

    if (targetHoles.length > 0) {
        // 3. เมื่อเลือกพื้นที่ ให้เจาะรูสีขาว และตัดส่วนอื่นออกด้วยหน้ากากสีดำ (เข้มเหมือนพื้นหลังโลก)
        maskLayer = L.polygon([worldCoords, ...targetHoles], {
            fillColor: '#0b0f19',
            fillOpacity: 0.95,   // ตัดพื้นที่ส่วนเกินแต่ยังกลืนกับ dark tiles อย่างธรรมชาติ
            color: 'none',
            weight: 0,
            interactive: false,
            pane: 'maskPane'
        }).addTo(map);
    }
}



function zoomToCurrentScope() {
    console.log("Zooming to current scope...", currentScope);

    let featuresToScan = [];
    if (currentScope.district !== 'all') {
        featuresToScan = window.DATA_TH_DISTRICTS ? window.DATA_TH_DISTRICTS.features : [];
    } else {
        featuresToScan = window.DATA_TH_PROVINCES ? window.DATA_TH_PROVINCES.features : [];
    }

    const bounds = L.latLngBounds([]);
    let found = false;

    featuresToScan.forEach(f => {
        if (isFeatureInScope(f)) {
            found = true;
            const coords = f.geometry.coordinates;
            const extendBounds = (c) => {
                if (typeof c[0] === 'number') bounds.extend([c[1], c[0]]);
                else c.forEach(extendBounds);
            };
            extendBounds(coords);
        }
    });

    if (found && bounds.isValid()) {
        map.fitBounds(bounds, {
            padding: [15, 15],
            animate: true,
            duration: 1.5
        });
    } else {
        // กลับไปมุมมองประเทศไทย
        map.setView([13.7367, 100.5231], 6);
    }
}


function isFeatureInScope(f) {
    try {
        if (!f || !f.properties) return true;
        const p = f.properties;
        const pName = normalizeThaiName(p.P_Name_T || p.PV_TN || "");
        const aName = normalizeThaiName(p.A_Name_T || p.AM_TN || "");

        if (currentScope.region !== 'all') {
            const provincesInRegion = (TH_HEALTH_REGIONS[currentScope.region] || []).map(p => normalizeThaiName(p));
            if (!provincesInRegion.includes(pName)) return false;
        }

        if (currentScope.province !== 'all') {
            if (pName !== normalizeThaiName(currentScope.province)) return false;
        }

        if (currentScope.district !== 'all') {
            if (aName !== normalizeThaiName(currentScope.district)) return false;
        }
    } catch (e) {
        console.error("Error in isFeatureInScope:", e, f);
    }
    return true;
}

function normalizeThaiName(name) {
    if (!name) return "";
    return name.toString()
        .replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, "")
        .trim();
}
