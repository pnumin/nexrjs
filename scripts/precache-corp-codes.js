const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

// Vercel 빌드 환경이나 로컬 환경에서 로딩
const apiKey = process.env.DART_API_KEY;
const CACHE_FILE_PATH = path.join(process.cwd(), 'public', 'corp_code_cache.json');

async function precache() {
  if (!apiKey) {
    console.warn('⚠️ WARNING: DART_API_KEY 환경변수가 존재하지 않아 빌드타임 캐싱을 건너뜁니다.');
    // 빌드를 실패시키지 않고 경고만 출력하고 넘어감 (개발자가 로컬에서 빌드하거나 키 없이 빌드할 수 있게)
    return;
  }

  console.log('🔄 OpenDART 고유번호 빌드타임 프리캐싱 시작...');
  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DART API 호출 실패 (Status: ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const xmlEntry = zipEntries.find(entry => entry.entryName === 'CORPCODE.xml');
    if (!xmlEntry) {
      throw new Error('ZIP 파일 내에 CORPCODE.xml이 존재하지 않습니다.');
    }

    const xmlData = xmlEntry.getData().toString('utf8');
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlData);

    if (!result || !result.result || !result.result.list) {
      throw new Error('올바르지 않은 XML 구조입니다.');
    }

    let list = result.result.list;
    if (!Array.isArray(list)) {
      list = [list];
    }

    const formatted = list.map(item => ({
      corp_code: item.corp_code,
      corp_name: item.corp_name,
      stock_code: item.stock_code?.trim() || null,
      modify_date: item.modify_date
    }));

    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(formatted, null, 2), 'utf8');
    console.log(`✅ 프리캐싱 완료! 총 ${formatted.length}개 회사 고유번호를 캐싱했습니다.`);
  } catch (error) {
    console.error('❌ 프리캐싱 도중 오류 발생:', error);
  }
}

precache();
