import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const corpCode = searchParams.get('corp_code');
  const apiKey = process.env.DART_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: '서버에 API 인증키가 설정되지 않았습니다.' }, { status: 500 });
  }

  if (!corpCode) {
    return NextResponse.json({ error: '회사 고유번호(corp_code)가 누락되었습니다.' }, { status: 400 });
  }

  const url = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${apiKey}&corp_code=${corpCode}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: `DART API가 오류를 반환했습니다. (${response.status})` }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('기업개황 Proxy API 호출 에러:', error);
    return NextResponse.json({ error: '내부 서버 오류로 API 호출에 실패했습니다.' }, { status: 500 });
  }
}
