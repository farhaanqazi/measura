const fs = require('fs');
const path = require('path');

function mergeDatasets() {
  const qwenPath = path.join(__dirname, 'docs', 'Qwen_json_20260616_rjsx3tdnb.json');
  const geminiPath = path.join(__dirname, 'docs', 'gemini-code-1781627681459.json');
  const outDir = path.join(__dirname, 'web', 'test', 'ground-truth');
  const outPath = path.join(outDir, 'dataset.json');

  const qwenData = JSON.parse(fs.readFileSync(qwenPath, 'utf8'));
  const geminiData = JSON.parse(fs.readFileSync(geminiPath, 'utf8'));

  const uniqueBuildings = new Map();

  // Normalize and insert Gemini data
  for (const b of geminiData) {
    const key = b.name.toLowerCase().trim();
    uniqueBuildings.set(key, {
      name: b.name,
      location: b.location,
      floors: b.floors,
      total_area_sqm: b.total_area_sqm,
      geojson: b.geojson,
      citation: b.citation
    });
  }

  // Normalize and insert Qwen data (only if not already present to avoid duplicates)
  // Or override if we prefer. We'll only insert if it doesn't exist.
  for (const b of qwenData) {
    const key = b.name.toLowerCase().trim();
    if (!uniqueBuildings.has(key)) {
      uniqueBuildings.set(key, {
        name: b.name,
        location: b.location,
        floors: b.floor_count, // Standardize property name to 'floors'
        total_area_sqm: b.total_area_sqm,
        geojson: b.geojson,
        citation: b.citation
      });
    }
  }

  const finalArray = Array.from(uniqueBuildings.values());

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outPath, JSON.stringify(finalArray, null, 2), 'utf8');
  console.log(`Merged datasets. Total unique buildings: ${finalArray.length}`);
}

mergeDatasets();
