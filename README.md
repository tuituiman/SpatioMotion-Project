# SpatioMotion: When Places Meet Time

**SpatioMotion** is a powerful, client-side geospatial visualization tool designed to transform public health data into dynamic insights. It allows users to upload epidemic data (Line Listing or Aggregated) and visualize its progression across Thailand's administrative boundaries over time.

![SpatioMotion Logo](SpatioMotion_logo.png)

## 🚀 Key Features

- **Dynamic Choropleth Maps**: Visualize data intensity across Provinces, Districts, and Subdistricts of Thailand.
- **Temporal Analysis**: Use the interactive timeline to play back data progression (Daily, Weekly, Monthly, or Yearly).
- **Flexible Data Upload**: Supports Excel (.xlsx, .xls) and CSV files with automatic column detection and manual mapping fallback.
- **Epidemiological Standards**: Built-in support for ISO Weeks and Thai Epidemiological Weeks (Epi Weeks).
- **Comparison Mode**: Compare multiple map views (2 or 4 panels) for different time periods side-by-side.
- **Smart Filtering**: Filter by Health Regions (1-13) and drill down to specific provinces or districts.
- **Privacy-First**: All data processing happens locally in your browser. No data is ever uploaded to a server.

## 🛠️ Technology Stack

- **Core**: HTML5, CSS3, JavaScript (ES6+)
- **Mapping**: [Leaflet.js](https://leafletjs.com/)
- **Data Processing**: [SheetJS (XLSX)](https://sheetjs.com/)
- **Background Tasks**: Web Workers for heavy data aggregation.
- **Styling**: Modern, responsive CSS with a focus on dark-mode aesthetics.

## 📋 Getting Started

### Prerequisites
Because the application uses **Web Workers** and loads large GeoJSON files, it must be served through a web server (it will not work correctly if opened via `file://` protocol).

### Running the Project

#### Option A: Using Node.js (Recommended)
If you have Node.js installed, use `npx` to serve the project instantly:
```bash
npx serve .
```
Then visit `http://localhost:3000`.

#### Option B: Using Python
```bash
# Python 3
python3 -m http.server 8000
```
Then visit `http://localhost:8000`.

#### Option C: VS Code Extension
Install the **Live Server** extension in VS Code, right-click `index.html`, and select **"Open with Live Server"**.

## 📊 Data Format Requirements

SpatioMotion accepts Excel/CSV files in two formats:

1.  **Aggregated Data**: Rows containing a Date, Location (Name or Code), and the Patient Count.
2.  **Line Listing**: Individual case records. The built-in **Line Listing Converter** will automatically aggregate these into daily/weekly summaries for you.

**Required Columns (or similar):**
- `Date` (YYYY-MM-DD or DD/MM/YYYY)
- `Province`, `District`, or `Subdistrict` (Names or Admin Codes)
- `Count` (Number of cases)

## 📂 Project Structure

- `index.html`: Main application interface.
- `app.js`: Core application logic and map management.
- `compare.js`: Logic for the side-by-side comparison mode.
- `data-worker.js`: Web worker for processing large datasets.
- `styles.css`: UI styling and animations.
- `lib/`: External libraries (Leaflet, XLSX).
- `thailand_*.js`: Optimized GeoJSON data for Thailand boundaries.

---
*Developed for public health professionals to bridge the gap between space and time.*
