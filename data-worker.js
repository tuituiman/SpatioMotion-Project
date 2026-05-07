/**
 * Data Worker for Spatial-Epinorth
 * Handles heavy data aggregation, normalization, and validation.
 * แปลง Line Listing → Aggregate รายพื้นที่ รายวัน สำหรับแผนที่
 */

self.onmessage = function(e) {
    const { action, payload } = e.data;

    if (action === 'processLineListing') {
        const result = processLineListing(payload.data, payload.config);
        self.postMessage({ action: 'result', payload: result });
    }
};

/**
 * Strip Thai administrative prefixes from names
 */
function stripPrefixes(name) {
    if (!name) return '';
    return name.toString().replace(/จังหวัด|อำเภอ|ตำบล|จ\.|อ\.|ต\./g, '').trim();
}

/**
 * Normalize Thai name for consistent matching
 */
function normalizeName(name) {
    if (!name) return '';
    return stripPrefixes(name)
        .replace(/\s+/g, '')
        .replace(/\u0E33/g, '\u0E32\u0E4D'); // สระอำ normalization
}

/**
 * Parse date string robustly (supports Thai Buddhist Era dates)
 */
function parseDateRobust(dateStr) {
    if (!dateStr) return null;
    const s = dateStr.toString().trim();

    // Excel serial number
    if (/^\d{5}$/.test(s)) {
        const d = new Date((parseInt(s) - 25569) * 86400000 + 43200000); // noon UTC to avoid TZ shift
        return isNaN(d) ? null : d;
    }

    // Try DD/MM/YYYY or DD-MM-YYYY (Thai format, year might be Buddhist Era)
    const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
        let [_, day, month, year] = match;
        year = parseInt(year);
        if (year > 2400) year -= 543; // Buddhist Era → CE
        if (year < 100) year += 2000;
        const d = new Date(year, parseInt(month) - 1, parseInt(day));
        return isNaN(d) ? null : d;
    }

    // Try YYYY-MM-DD (ISO format)
    const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (isoMatch) {
        let [_, year, month, day] = isoMatch;
        year = parseInt(year);
        if (year > 2400) year -= 543;
        const d = new Date(year, parseInt(month) - 1, parseInt(day));
        return isNaN(d) ? null : d;
    }

    // Fallback: native Date parse
    const d = new Date(s);
    return isNaN(d) ? null : d;
}

/**
 * Main processing function: Line Listing → Aggregate by area/day
 * @param {Array} data - Raw row data from Excel
 * @param {Object} config - Column mapping config
 * @returns {Object} - { aggregated, stats, unmapped, columnInfo }
 */
function processLineListing(data, config) {
    if (!data || data.length === 0) {
        return { aggregated: [], stats: {}, unmapped: [], columnInfo: {} };
    }

    // Auto-detect columns if not provided
    const columns = config.columns || detectColumns(data[0]);

    self.postMessage({ action: 'progress', payload: { percent: 10, message: 'ตรวจหาคอลัมน์...' } });

    const aggregated = {};
    const unmapped = [];
    let processed = 0;
    const total = data.length;

    data.forEach((row, idx) => {
        // Progress updates every 500 rows
        if (idx % 500 === 0) {
            const pct = 10 + Math.floor((idx / total) * 80);
            self.postMessage({ action: 'progress', payload: { percent: pct, message: `ประมวลผลแถว ${idx}/${total}...` } });
        }

        // Parse date
        const dateStr = row[columns.date];
        const date = parseDateRobust(dateStr);
        if (!date) {
            unmapped.push({ row: idx + 2, reason: 'ไม่สามารถอ่านวันที่ได้', value: dateStr });
            return;
        }

        // Get location
        const province = stripPrefixes(row[columns.province] || '');
        const district = stripPrefixes(row[columns.district] || '');
        const subdistrict = stripPrefixes(row[columns.subdistrict] || '');
        const location = subdistrict || district || province;

        if (!location) {
            unmapped.push({ row: idx + 2, reason: 'ไม่มีข้อมูลพื้นที่', value: '' });
            return;
        }

        // Get patient count
        const count = parseInt(row[columns.patients] || 1) || 1;

        // Build date key (YYYY-MM-DD local timezone)
        const dateKey = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;

        // Build location key (compound to prevent duplicates)
        let locKey = location;
        if (subdistrict && (province || district)) {
            locKey = `${province}|${district}|${subdistrict}`;
        } else if (district && province) {
            locKey = `${province}|${district}`;
        }

        // Aggregate
        if (!aggregated[dateKey]) {
            aggregated[dateKey] = {};
        }
        aggregated[dateKey][locKey] = (aggregated[dateKey][locKey] || 0) + count;
        processed++;
    });

    self.postMessage({ action: 'progress', payload: { percent: 95, message: 'สรุปสถิติ...' } });

    // Build output
    const dates = Object.keys(aggregated).sort();
    const outputRows = [];
    dates.forEach(dateKey => {
        const locations = aggregated[dateKey];
        Object.entries(locations).forEach(([loc, count]) => {
            const parts = loc.split('|');
            outputRows.push({
                date: dateKey,
                province: parts.length >= 2 ? parts[0] : '',
                district: parts.length >= 2 ? parts[1] : '',
                subdistrict: parts.length >= 3 ? parts[2] : (parts.length === 1 ? parts[0] : ''),
                location: parts[parts.length - 1],
                count: count
            });
        });
    });

    // Stats
    const stats = {
        totalRows: total,
        processed: processed,
        unmappedCount: unmapped.length,
        matchRate: total > 0 ? ((processed / total) * 100).toFixed(1) + '%' : '0%',
        dateRange: dates.length > 0 ? `${dates[0]} → ${dates[dates.length - 1]}` : 'N/A',
        uniqueLocations: new Set(outputRows.map(r => r.location)).size,
        uniqueDates: dates.length
    };

    self.postMessage({ action: 'progress', payload: { percent: 100, message: 'เสร็จสิ้น!' } });

    return {
        aggregated: outputRows,
        stats: stats,
        unmapped: unmapped.slice(0, 100), // Limit to first 100 for display
        columnInfo: columns
    };
}

/**
 * Auto-detect column names from first row
 */
function detectColumns(firstRow) {
    const keys = Object.keys(firstRow).map(k => k.replace(/^\ufeff/, '').trim());
    const rawKeys = Object.keys(firstRow);
    const keyMap = {};
    rawKeys.forEach((rk, i) => keyMap[keys[i]] = rk);

    const dateKey = keys.find(k => k.includes('วันที่') || k.toLowerCase().includes('date'));
    const provKey = keys.find(k => k.includes('จังหวัด') || k.toLowerCase().includes('province'));
    const distKey = keys.find(k => (k.includes('อำเภอ') || k.toLowerCase().includes('district')) && !k.toLowerCase().includes('subdistrict'));
    const subKey = keys.find(k => k.includes('ตำบล') || k.toLowerCase().includes('subdistrict'));
    const patKey = keys.find(k => k.includes('จำนวน') || k.includes('ผู้ป่วย') || k.includes('ราย') || k.includes('ปริมาณ') || k.includes('ค่า') || k.toLowerCase().includes('patient') || k.toLowerCase().includes('count') || k.toLowerCase().includes('case') || k.toLowerCase().includes('value') || k.toLowerCase().includes('total'));

    return {
        date: keyMap[dateKey] || rawKeys[0],
        province: keyMap[provKey] || '',
        district: keyMap[distKey] || '',
        subdistrict: keyMap[subKey] || '',
        patients: keyMap[patKey] || rawKeys[rawKeys.length - 1]
    };
}
