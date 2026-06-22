"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Search, Sun, Moon, Calendar, Building, FileText, 
  RefreshCw, ExternalLink, ChevronLeft, ChevronRight, 
  Globe, Phone, MapPin, User, Hash, AlertTriangle, Info, X
} from 'lucide-react';

export default function Dashboard() {
  // 테마 상태
  const [theme, setTheme] = useState('dark');

  // 캐시 로드 여부 및 전체 회사 수
  const [isCacheLoading, setIsCacheLoading] = useState(true);
  const [totalCorpCount, setTotalCorpCount] = useState(0);

  // 회사 검색 자동완성
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // 공시 데이터 상태
  const [disclosures, setDisclosures] = useState([]);
  const [isLoadingDisclosures, setIsLoadingDisclosures] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // 페이지네이션
  const [pageNo, setPageNo] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPage, setTotalPage] = useState(1);
  const [pageCount, setPageCount] = useState(15);

  // 필터 상태
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [corpCls, setCorpCls] = useState(''); // Y, K, N, E or empty (all)
  const [pblntfTy, setPblntfTy] = useState(''); // A, B, C, D, E, F, G, H, I, J or empty

  // 기업개황 상태
  const [companyProfile, setCompanyProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // 보고서 모달 팝업 상태
  const [activeReportUrl, setActiveReportUrl] = useState('');
  const [activeReportTitle, setActiveReportTitle] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 드롭다운 및 모달 Ref
  const dropdownRef = useRef(null);

  // 1. 테마 초기화
  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme);

    // 날짜 필터 기본값 설정 (오늘 기준 최근 1개월)
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    setEndDate(formatDateToString(today));
    setStartDate(formatDateToString(oneMonthAgo));
  }, []);

  // 테마 전환 토글
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  // 날짜 포맷 변환 (YYYY-MM-DD)
  const formatDateToString = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // DART 날짜 포맷 변환 (YYYYMMDD)
  const toDartDateFormat = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '');
  };

  // 2. 회사 고유번호 캐시 상태 확인
  useEffect(() => {
    const checkCache = async () => {
      try {
        const res = await fetch('/api/dart/corp-cache');
        if (res.ok) {
          const data = await res.json();
          setTotalCorpCount(data.total_count || 0);
          setIsCacheLoading(false);
        } else {
          // 에러 발생 시 재시도
          setTimeout(checkCache, 3000);
        }
      } catch (e) {
        console.error('캐시 체크 실패:', e);
        setTimeout(checkCache, 3000);
      }
    };
    checkCache();
  }, []);

  // 3. 자동완성 검색 디바운싱
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/dart/corp-cache?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error('검색어 제안 호출 실패:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // 클릭 외부 감지 (검색 제안창 닫기)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 4. 공시 데이터 가져오기
  const fetchDisclosures = async (page = 1) => {
    setIsLoadingDisclosures(true);
    setErrorMessage('');
    
    // 파라미터 구성
    const params = new URLSearchParams();
    params.append('page_no', String(page));
    params.append('page_count', String(pageCount));
    
    if (selectedCompany) {
      params.append('corp_code', selectedCompany.corp_code);
    }
    
    // 시작일/종료일 지정 (고유번호가 없으면 시작일 필수 체크)
    if (startDate) {
      params.append('bgn_de', toDartDateFormat(startDate));
    }
    if (endDate) {
      params.append('end_de', toDartDateFormat(endDate));
    }
    
    // 법인구분
    if (corpCls) {
      params.append('corp_cls', corpCls);
    }
    
    // 공시유형
    if (pblntfTy) {
      params.append('pblntf_ty', pblntfTy);
    }

    try {
      const res = await fetch(`/api/dart/list?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`서버 요청 실패 (Status: ${res.status})`);
      }
      
      const data = await res.json();
      
      if (data.status === '000') {
        setDisclosures(data.list || []);
        setTotalCount(Number(data.total_count) || 0);
        setTotalPage(Number(data.total_page) || 1);
        setPageNo(page);
      } else {
        // DART API 자체 에러 코드 처리 (013: 데이터 없음 등)
        if (data.status === '013') {
          setDisclosures([]);
          setTotalCount(0);
          setTotalPage(1);
        } else {
          setErrorMessage(data.message || '데이터를 가져오는 중 오류가 발생했습니다.');
        }
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(e.message || '네트워크 연결 오류가 발생했습니다.');
    } finally {
      setIsLoadingDisclosures(false);
    }
  };

  // 5. 기업개황 가져오기
  const fetchCompanyProfile = async (corpCode) => {
    setIsLoadingProfile(true);
    setCompanyProfile(null);
    try {
      const res = await fetch(`/api/dart/company?corp_code=${corpCode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === '000') {
          setCompanyProfile(data);
        } else {
          console.error('기업개황 조회 에러:', data.message);
        }
      }
    } catch (e) {
      console.error('기업개황 호출 실패:', e);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // 보고서 모달 열기 핸들러
  const handleOpenReport = (e, item) => {
    e.preventDefault();
    const url = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`;
    setActiveReportUrl(url);
    setActiveReportTitle(`${item.corp_name} - ${item.report_nm}`);
    setIsModalOpen(true);
  };

  // 6. 필터 및 검색 적용 시 동작
  const handleApplyFilters = () => {
    fetchDisclosures(1);
  };

  // 특정 회사 선택 시
  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setSearchQuery(company.corp_name);
    setSuggestions([]);
    fetchCompanyProfile(company.corp_code);
  };

  // 검색 초기화
  const handleResetSearch = () => {
    setSelectedCompany(null);
    setSearchQuery('');
    setSuggestions([]);
    setCompanyProfile(null);
  };

  // 최초 로드 시 검색 실행
  useEffect(() => {
    if (!isCacheLoading) {
      fetchDisclosures(1);
    }
  }, [isCacheLoading, selectedCompany]); // 회사 선택 시 자동 갱신

  // 법인구분 문자열 매핑
  const getCorpClsName = (cls) => {
    switch (cls) {
      case 'Y': return '유가증권';
      case 'K': return '코스닥';
      case 'N': return '코넥스';
      case 'E': return '기타법인';
      default: return '기타';
    }
  };

  return (
    <div className="app-container">
      {/* 1. 사이드바 */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">D</div>
          <span className="logo-text">OpenDART Board</span>
        </div>

        <nav className="nav-menu">
          <a className="nav-item active">
            <Building size={18} />
            <span>통합 대시보드</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <p>© 2026 OpenDART Board</p>
          <p style={{ marginTop: '4px' }}>금융감독원 API 연동</p>
        </div>
      </aside>

      {/* 2. 메인 패널 */}
      <main className="main-panel">
        {/* 상단 헤더 */}
        <header className="header">
          {/* 실시간 자동완성 검색 바 */}
          <div className="search-wrapper" ref={dropdownRef}>
            <div className="search-input-group">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="회사명 또는 종목코드 검색..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isCacheLoading}
              />
              {selectedCompany && (
                <button 
                  onClick={handleResetSearch} 
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  초기화
                </button>
              )}
            </div>

            {/* 자동완성 제안창 */}
            {suggestions.length > 0 && (
              <div className="autocomplete-dropdown">
                {suggestions.map((item) => (
                  <div
                    key={item.corp_code}
                    className="autocomplete-item"
                    onClick={() => handleSelectCompany(item)}
                  >
                    <span className="autocomplete-name">{item.corp_name}</span>
                    <span className="autocomplete-code">
                      {item.stock_code ? item.stock_code : '비상장'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="header-actions">
            {/* API 캐싱 상태 뱃지 */}
            <div className="api-badge">
              <span className={`api-status-dot ${isCacheLoading ? 'loading' : ''}`}></span>
              <span>
                {isCacheLoading 
                  ? 'DART 데이터 캐싱 중...' 
                  : `DART DB 준비 완료 (${totalCorpCount.toLocaleString()}개)`}
              </span>
            </div>

            {/* 다크/라이트 테마 토글 */}
            <button className="theme-toggle-btn" onClick={toggleTheme} title="테마 전환">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* 메인 콘텐츠 영역 */}
        <div className="content-area">
          <div className="page-title-section">
            <div>
              <h1 className="page-title">
                {selectedCompany ? `${selectedCompany.corp_name} 공시 현황` : '실시간 전자공시 대시보드'}
              </h1>
              <p className="page-subtitle">
                {selectedCompany 
                  ? `${selectedCompany.corp_name}의 상세 개황 정보 및 공시 리스트를 확인합니다.` 
                  : '대한민국 기업들의 최신 공시 정보를 실시간으로 조회하고 기업 상세 정보를 분석합니다.'}
              </p>
            </div>
          </div>

          {/* 필터 세션 */}
          <section className="filter-card">
            <div className="filter-group">
              <span className="filter-label">시작 접수일자</span>
              <input
                type="date"
                className="filter-date-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <span className="filter-label">종료 접수일자</span>
              <input
                type="date"
                className="filter-date-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <span className="filter-label">시장 구분</span>
              <select
                className="filter-select"
                value={corpCls}
                onChange={(e) => setCorpCls(e.target.value)}
              >
                <option value="">전체 시장</option>
                <option value="Y">유가증권 (코스피)</option>
                <option value="K">코스닥</option>
                <option value="N">코넥스</option>
                <option value="E">기타법인</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">공시 유형</span>
              <select
                className="filter-select"
                value={pblntfTy}
                onChange={(e) => setPblntfTy(e.target.value)}
              >
                <option value="">전체 공시</option>
                <option value="A">정기공시 (사업/반기/분기보고서)</option>
                <option value="B">주요사항보고서</option>
                <option value="C">발행공시 (증권신고 등)</option>
                <option value="D">지분공시 (대량보유/임원소유)</option>
                <option value="F">감사보고서 (외부감사관련)</option>
                <option value="I">거래소공시 (공정공시/수시공시)</option>
              </select>
            </div>

            <div className="filter-buttons">
              <button 
                className="btn-primary" 
                onClick={handleApplyFilters}
                disabled={isCacheLoading || isLoadingDisclosures}
              >
                {isLoadingDisclosures ? '조회 중...' : '조건 조회'}
              </button>
            </div>
          </section>

          {/* 메인 대시보드 그리드 */}
          <div className="dashboard-grid">
            {/* 좌측: 공시 리스트 */}
            <section className="list-card">
              <div className="card-header">
                <span className="card-title">
                  <FileText size={18} />
                  <span>공시 보고서 목록 ({totalCount.toLocaleString()}건)</span>
                </span>
                
                {selectedCompany && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    필터: {selectedCompany.corp_name}
                  </span>
                )}
              </div>

              {isLoadingDisclosures ? (
                <div style={{ padding: '2rem' }}>
                  <div className="skeleton skeleton-title"></div>
                  <div className="skeleton skeleton-text" style={{ width: '100%' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '90%' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '95%' }}></div>
                </div>
              ) : errorMessage ? (
                <div className="empty-state">
                  <AlertTriangle className="empty-state-icon" style={{ color: 'var(--danger-color)' }} />
                  <p>{errorMessage}</p>
                </div>
              ) : disclosures.length === 0 ? (
                <div className="empty-state">
                  <Info className="empty-state-icon" />
                  <p>조회 기간 내 공시 정보가 존재하지 않습니다.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="disclosure-table">
                    <thead>
                      <tr>
                        <th>시장</th>
                        <th>회사명</th>
                        <th>보고서명</th>
                        <th>제출인</th>
                        <th>접수일자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disclosures.map((item) => (
                        <tr key={item.rcept_no}>
                          <td>
                            <span className={`corp-badge corp-cls-${item.corp_cls}`}>
                              {item.corp_cls ? getCorpClsName(item.corp_cls) : '기타'}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600' }}>
                            <span 
                              onClick={() => handleSelectCompany({ corp_name: item.corp_name, corp_code: item.corp_code })}
                              style={{ cursor: 'pointer', hover: 'underline' }}
                              title="기업개황 조회"
                            >
                              {item.corp_name}
                            </span>
                          </td>
                          <td>
                            <a 
                              href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="report-link"
                              onClick={(e) => handleOpenReport(e, item)}
                            >
                              <span>{item.report_nm}</span>
                              <ExternalLink size={12} />
                            </a>
                            {item.rm && (
                              <span className="rm-badge" title={item.rm}>
                                {item.rm}
                              </span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{item.flr_nm}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {item.rcept_dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 페이지네이션 */}
              {disclosures.length > 0 && !isLoadingDisclosures && (
                <div className="pagination-container">
                  <span className="pagination-info">
                    {pageNo} / {totalPage} 페이지 (총 {totalCount.toLocaleString()}건)
                  </span>
                  <div className="pagination-buttons">
                    <button
                      className="btn-secondary"
                      onClick={() => fetchDisclosures(pageNo - 1)}
                      disabled={pageNo <= 1}
                      style={{ padding: '0.4rem 0.8rem' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => fetchDisclosures(pageNo + 1)}
                      disabled={pageNo >= totalPage}
                      style={{ padding: '0.4rem 0.8rem' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 우측: 기업 개황 상세 */}
            <aside className="company-card">
              {isLoadingProfile ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div className="skeleton" style={{ width: '64px', height: '64px', borderRadius: '16px', marginBottom: '1rem' }}></div>
                    <div className="skeleton" style={{ width: '120px', height: '1.25rem' }}></div>
                  </div>
                  <div className="skeleton skeleton-text" style={{ width: '100%' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '100%' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '100%' }}></div>
                </div>
              ) : companyProfile ? (
                <div>
                  <div className="company-profile-header">
                    <div className="company-avatar">
                      {companyProfile.corp_name.charAt(0)}
                    </div>
                    <h2 className="company-title">{companyProfile.corp_name}</h2>
                    <span className="company-subtitle">{companyProfile.corp_name_eng}</span>
                  </div>

                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-item-label">대표자명</span>
                      <span className="info-item-value">{companyProfile.ceo_nm}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">종목코드</span>
                      <span className="info-item-value">
                        {companyProfile.stock_code ? companyProfile.stock_code : '비상장'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">법인구분</span>
                      <span className="info-item-value">
                        {getCorpClsName(companyProfile.corp_cls)}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">법인등록번호</span>
                      <span className="info-item-value">{companyProfile.jurir_no}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">사업자등록번호</span>
                      <span className="info-item-value">{companyProfile.bizr_no}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">설립일</span>
                      <span className="info-item-value">
                        {companyProfile.est_dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일')}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">결산월</span>
                      <span className="info-item-value">{companyProfile.acc_mt}월</span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">대표전화</span>
                      <span className="info-item-value">{companyProfile.phn_no}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">팩스번호</span>
                      <span className="info-item-value">{companyProfile.fax_no}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-item-label">주소</span>
                      <span className="info-item-value" title={companyProfile.adres}>
                        {companyProfile.adres}
                      </span>
                    </div>
                    {companyProfile.hm_url && (
                      <div className="info-item">
                        <span className="info-item-label">홈페이지</span>
                        <span className="info-item-value">
                          <a href={companyProfile.hm_url.startsWith('http') ? companyProfile.hm_url : `http://${companyProfile.hm_url}`} target="_blank" rel="noopener noreferrer">
                            {companyProfile.hm_url}
                          </a>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <Building size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                  <p style={{ fontSize: '0.9rem' }}>공시 목록에서 회사명을 클릭하거나 검색하여 상세 기업 정보를 확인해보세요.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>

      {/* 3. DART 보고서 팝업 모달 */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <FileText size={18} style={{ color: 'var(--accent-cyan)', marginRight: '6px' }} />
                <span>{activeReportTitle}</span>
              </h3>
              <div className="modal-header-actions">
                <a 
                  href={activeReportUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  <span>새 창으로 열기</span>
                  <ExternalLink size={14} />
                </a>
                <button className="modal-close-btn" onClick={() => setIsModalOpen(false)} title="닫기">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <iframe 
                src={activeReportUrl} 
                className="modal-iframe" 
                title="DART 공시 뷰어"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
