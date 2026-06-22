import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import xml2js from 'xml2js';

const CACHE_FILE_PATH = path.join(process.cwd(), 'public', 'corp_code_cache.json');

async function downloadAndCacheCorpCodes(apiKey) {
  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('DART API 호출에 실패했습니다.');
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ZIP 압축 풀기
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  const xmlEntry = zipEntries.find(entry => entry.entryName === 'CORPCODE.xml');
  if (!xmlEntry) {
    throw new Error('ZIP 파일 내에 CORPCODE.xml이 존재하지 않습니다.');
  }

  const xmlData = xmlEntry.getData().toString('utf8');

  // XML 파싱
  const parser = new xml2js.Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(xmlData);
  
  if (!result || !result.result || !result.result.list) {
    throw new Error('올바르지 않은 XML 구조입니다.');
  }

  let list = result.result.list;
  if (!Array.isArray(list)) {
    list = [list];
  }

  // 가공
  const formatted = list.map(item => ({
    corp_code: item.corp_code,
    corp_name: item.corp_name,
    stock_code: item.stock_code?.trim() || null,
    modify_date: item.modify_date
  }));

  // public 디렉토리 확인 및 저장
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(formatted, null, 2), 'utf8');
  return formatted;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const forceRefresh = searchParams.get('refresh') === 'true';
  const apiKey = process.env.DART_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: '서버에 API 인증키가 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    let corpCodes = [];

    // 캐시 파일 확인 (또는 강제 새로고침 시)
    if (fs.existsSync(CACHE_FILE_PATH) && !forceRefresh) {
      const cacheData = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      corpCodes = JSON.parse(cacheData);
    } else {
      // 캐시 파일이 없으면 새로 빌드
      corpCodes = await downloadAndCacheCorpCodes(apiKey);
    }

    if (!query) {
      // 쿼리가 없으면 캐시가 정상 동작 중인지 상태만 출력
      return NextResponse.json({ 
        message: '캐시가 준비되어 있습니다.', 
        total_count: corpCodes.length 
      });
    }

    // 회사명 또는 종목코드로 검색 (최대 20개 결과 제한)
    const lowerQuery = query.toLowerCase().trim();
    const filtered = corpCodes
      .filter(item => 
        item.corp_name.toLowerCase().includes(lowerQuery) || 
        (item.stock_code && item.stock_code.includes(lowerQuery))
      )
      .slice(0, 20);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('고유번호 캐싱 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
