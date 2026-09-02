import { readFile, writeFile } from 'node:fs/promises';

const schoolsPath = new URL('../data/schools.json', import.meta.url);
const schools = JSON.parse(await readFile(schoolsPath, 'utf8'));

const fetchCandidates = async (text) => {
  const query = encodeURIComponent(text);
  const response = await fetch(`https://photon.komoot.io/api/?limit=8&q=${query}`, {
    headers: { 'User-Agent': 'Codex school resource research/1.0' },
  });
  if (!response.ok) throw new Error(`${text}: HTTP ${response.status}`);
  const result = await response.json();
  return result.features ?? [];
};

const insideExpectedArea = (school, lng, lat) => {
  if (school.area.startsWith('高新西区')) {
    return lng >= 103.82 && lng <= 104.03 && lat >= 30.68 && lat <= 30.86;
  }
  return lng >= 103.98 && lng <= 104.20 && lat >= 30.45 && lat <= 30.70;
};

const inChengdu = (candidate) => {
    const props = candidate.properties ?? {};
    const cityText = `${props.city ?? ''}${props.district ?? ''}${props.state ?? ''}`;
    return cityText.includes('成都') || cityText.includes('高新区');
};

const normalizeName = (value) => String(value ?? '')
  .replace(/[（）()·\s]/g, '')
  .replace(/四川省|成都市|成都|高新区|附属|实验|学校|小学|中学|校区|分校/g, '');

const hasDistinctiveMatch = (schoolName, candidateName) => {
  const expected = normalizeName(schoolName);
  const actual = normalizeName(candidateName);
  if (!expected || !actual) return false;
  if (expected.includes(actual) || actual.includes(expected)) return true;
  const bigrams = Array.from({ length: Math.max(0, expected.length - 1) }, (_, index) => expected.slice(index, index + 2));
  return bigrams.some((bigram) => actual.includes(bigram));
};

const areaCenters = {
  '高新南区·肖家河': [104.040, 30.633],
  '高新南区·芳草': [104.049, 30.600],
  '高新南区·桂溪': [104.064, 30.567],
  '高新南区·石羊': [104.052, 30.540],
  '高新南区·中和': [104.105, 30.535],
  '高新西区·西园': [103.915, 30.753],
  '高新西区·合作': [103.935, 30.780],
};

const approximateByArea = (school) => {
  const [centerLng, centerLat] = areaCenters[school.area];
  const seed = [...school.name].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 17);
  const angle = (seed * 137.508) * Math.PI / 180;
  const ring = 0.004 + (seed % 5) * 0.0022;
  return {
    ...school,
    lng: centerLng + Math.cos(angle) * ring,
    lat: centerLat + Math.sin(angle) * ring * 0.72,
    coordinateStatus: '片区近似定位（待精确坐标核验）',
  };
};

const searchOne = async (school) => {
  const { lat: _lat, lng: _lng, ...base } = school;
  const nameCandidates = await fetchCandidates(`${school.name} 成都`);
  const schoolMatch = nameCandidates.find((candidate) => {
    const props = candidate.properties ?? {};
    const [lng, lat] = candidate.geometry.coordinates;
    const isSchool = props.osm_value === 'school' || /小学|中学|学校/.test(props.name ?? '');
    return inChengdu(candidate) && isSchool && insideExpectedArea(school, lng, lat)
      && hasDistinctiveMatch(school.name, props.name);
  });
  if (schoolMatch) {
    const [lng, lat] = schoolMatch.geometry.coordinates;
    return { ...base, lat, lng, coordinateStatus: 'OpenStreetMap校名匹配' };
  }

  return approximateByArea(base);
};

const output = [];
for (let index = 0; index < schools.length; index += 6) {
  const batch = schools.slice(index, index + 6);
  const settled = await Promise.allSettled(batch.map(searchOne));
  settled.forEach((entry, offset) => {
    const school = batch[offset];
    output.push(entry.status === 'fulfilled' ? entry.value : school);
  });
  console.log(`已处理 ${Math.min(index + 6, schools.length)}/${schools.length}`);
  await new Promise((resolve) => setTimeout(resolve, 450));
}

await writeFile(schoolsPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`坐标匹配 ${output.filter((school) => school.lat && school.lng).length}/${output.length}`);
