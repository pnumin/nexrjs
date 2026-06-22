import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = process.env.DART_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: '서버에 API 인증키가 설정되지 않았습니다.' }, { status: 500 });
  }

  // DART API로 보낼 파라미터 빌드
  const params = new URLSearchParams();
  params.append('crtfc_key', apiKey);

  const allowedParams = [
    'corp_code', 'bgn_de', 'end_de', 'last_reprt_at',
    'pblntf_ty', 'pblntf_detail_ty', 'corp_cls',
    'sort', 'sort_mth', 'page_no', 'page_count'
  ];

  for (const param of allowedParams) {
    const val = searchParams.get(param);
    if (val !== null && val !== undefined && val !== '') {
      params.append(param, val);
    }
  }

  const url = `https://opendart.fss.or.kr/api/list.json?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: `DART API가 오류를 반환했습니다. (${response.status})` }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('공시검색 Proxy API 호출 에러:', error);
    return NextResponse.json({ error: '내부 서버 오류로 API 호출에 실패했습니다.' }, { status: 500 });
  }
}
