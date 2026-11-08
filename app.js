// 현장 작업일지 & 정산 관리 Pro - 애플리케이션 로직

// 1. 상태 변수
let workLogs = [];
let rates = { ...DEFAULT_RATES };
let currentMonth = "2026-07"; // 기본 2026년 7월 (데이터가 풍부한 달)
let calendarCurrentDate = new Date(2026, 6, 1); // 2026년 7월
let activeTab = "input";

// 모드 토글 상태 (1: 1인, 2: 2인)
let cctvMode = 1;
let poleRnMode = 1;
let bldRnMode = 1;

// 2. 초기화
document.addEventListener("DOMContentLoaded", () => {
  loadDataFromStorage();
  initMonthSelector();
  initRatesSettings();
  renderAll();
  initFormEvents();

  // 서비스 워커 등록 (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('ServiceWorker registered:', reg.scope))
      .catch(err => console.log('ServiceWorker error:', err));
  }
});

// 데이터 로드 (로컬 스토리지 또는 초기 데이터)
function loadDataFromStorage() {
  const savedLogs = localStorage.getItem("work_logs_v1");
  if (savedLogs) {
    try {
      workLogs = JSON.parse(savedLogs);
    } catch (e) {
      workLogs = [...INITIAL_WORK_LOGS];
    }
  } else {
    workLogs = [...INITIAL_WORK_LOGS];
    saveLogsToStorage();
  }

  const savedRates = localStorage.getItem("rates_config_v1");
  if (savedRates) {
    try {
      rates = { ...DEFAULT_RATES, ...JSON.parse(savedRates) };
    } catch (e) {
      rates = { ...DEFAULT_RATES };
    }
  }
}

function saveLogsToStorage() {
  localStorage.setItem("work_logs_v1", JSON.stringify(workLogs));
}

function saveRatesToStorage() {
  localStorage.setItem("rates_config_v1", JSON.stringify(rates));
}

// 월 목록 추출 및 셀렉터 구성
function initMonthSelector() {
  const monthSelect = document.getElementById("globalMonthSelect");
  monthSelect.innerHTML = "";

  // 로그들에 있는 월 목록 + 최근 월들 수집
  const monthsSet = new Set(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  workLogs.forEach(log => {
    if (log.date && log.date.length >= 7) {
      monthsSet.add(log.date.substring(0, 7));
    }
  });

  const sortedMonths = Array.from(monthsSet).sort().reverse();

  sortedMonths.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    const [y, mm] = m.split("-");
    opt.textContent = `${y}년 ${parseInt(mm, 10)}월`;
    if (m === currentMonth) opt.selected = true;
    monthSelect.appendChild(opt);
  });

  monthSelect.addEventListener("change", (e) => {
    currentMonth = e.target.value;
    const [y, mm] = currentMonth.split("-");
    calendarCurrentDate = new Date(parseInt(y, 10), parseInt(mm, 10) - 1, 1);
    renderAll();
  });

  // 오늘 날짜를 폼 기본값으로 지정
  const todayStr = new Date().toISOString().substring(0, 10);
  document.getElementById("inputDate").value = todayStr.startsWith("2026") ? todayStr : `${currentMonth}-01`;
}

// 탭 전환
function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.classList.remove("text-blue-600");
    tab.classList.add("text-slate-400");
  });

  const activeSec = document.getElementById(`view-${tabName}`);
  if (activeSec) activeSec.classList.remove("hidden");

  const activeBtn = document.getElementById(`tab-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove("text-slate-400");
    activeBtn.classList.add("text-blue-600");
  }

  if (tabName === "calendar") {
    renderCalendar();
  } else if (tabName === "report") {
    renderSettlementReport();
  } else if (tabName === "list") {
    renderList();
  }

  lucide.createIcons();
}

// 전체 화면 갱신
function renderAll() {
  updateHeaderTotal();
  renderList();
  renderCalendar();
  renderSettlementReport();
  lucide.createIcons();
}

// 개별 로그 예상 수당 계산
function calculateLogFee(log) {
  let fee = 0;
  fee += (Number(log.internet) || 0) * (rates.internet || 0);
  fee += (Number(log.subTerminal) || 0) * (rates.subTerminal || 0);
  fee += (Number(log.cctv1) || 0) * (rates.cctv1 || 0);
  fee += (Number(log.cctv2) || 0) * (rates.cctv2 || 0);
  fee += (Number(log.poleRn1) || 0) * (rates.poleRn1 || 0);
  fee += (Number(log.poleRn2) || 0) * (rates.poleRn2 || 0);
  fee += (Number(log.buildingRn1) || 0) * (rates.buildingRn1 || 0);
  fee += (Number(log.buildingRn2) || 0) * (rates.buildingRn2 || 0);
  fee += (Number(log.cancel) || 0) * (rates.cancel || 0);
  fee += (Number(log.buildingWork) || 0) * (rates.buildingWork || 0);
  fee += (Number(log.trouble) || 0) * (rates.trouble || 0);
  fee += (Number(log.dayDuty) || 0) * (rates.dayDuty || 0);
  fee += (Number(log.nightDispatch) || 0) * (rates.nightDispatch || 0);
  return Math.round(fee);
}

// 상단 헤더 요약 갱신
function updateHeaderTotal() {
  const currentLogs = workLogs.filter(l => l.date && l.date.startsWith(currentMonth));
  const total = currentLogs.reduce((acc, cur) => acc + calculateLogFee(cur), 0);
  document.getElementById("headerMonthTotal").textContent = total.toLocaleString() + "원";
}

// ----------------------------------------------------
// 3. 작업 일지 목록 (테이블 / 카드) 렌더링
// ----------------------------------------------------
function renderList() {
  const searchKeyword = (document.getElementById("searchKeyword")?.value || "").trim().toLowerCase();
  
  let filtered = workLogs.filter(l => l.date && l.date.startsWith(currentMonth));
  if (searchKeyword) {
    filtered = filtered.filter(l => 
      (l.customerName && l.customerName.toLowerCase().includes(searchKeyword)) ||
      (l.subNo && l.subNo.includes(searchKeyword)) ||
      (l.memo && l.memo.toLowerCase().includes(searchKeyword)) ||
      (l.twoPersonWorker && l.twoPersonWorker.toLowerCase().includes(searchKeyword))
    );
  }

  // 날짜 내림차순 정렬
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  const totalFee = filtered.reduce((acc, cur) => acc + calculateLogFee(cur), 0);
  document.getElementById("filteredCount").textContent = filtered.length;
  document.getElementById("filteredTotalFee").textContent = `합계: ${totalFee.toLocaleString()}원`;

  const tbodyDesktop = document.getElementById("tableBodyDesktop");
  const listMobile = document.getElementById("cardListMobile");
  const noDataNotice = document.getElementById("noDataNotice");

  if (filtered.length === 0) {
    tbodyDesktop.innerHTML = "";
    listMobile.innerHTML = "";
    noDataNotice.classList.remove("hidden");
    return;
  }
  noDataNotice.classList.add("hidden");

  // PC 테이블 뷰
  tbodyDesktop.innerHTML = filtered.map(log => {
    const fee = calculateLogFee(log);
    const cctvDisplay = (log.cctv1 > 0 ? `1인:${log.cctv1} ` : "") + (log.cctv2 > 0 ? `2인:${log.cctv2}` : "");
    const poleDisplay = (log.poleRn1 > 0 ? `1인:${log.poleRn1} ` : "") + (log.poleRn2 > 0 ? `2인:${log.poleRn2}` : "");
    const bldDisplay = (log.buildingRn1 > 0 ? `1인:${log.buildingRn1} ` : "") + (log.buildingRn2 > 0 ? `2인:${log.buildingRn2}` : "");
    
    let otherDisplay = [];
    if (log.cancel > 0) otherDisplay.push(`해지:${log.cancel}`);
    if (log.buildingWork > 0) otherDisplay.push(`공사:${log.buildingWork}`);
    if (log.trouble > 0) otherDisplay.push(`장애:${log.trouble}`);

    let dutyDisplay = [];
    if (log.dayDuty > 0) dutyDisplay.push(`당직:${log.dayDuty}`);
    if (log.nightDispatch > 0) dutyDisplay.push(`야간:${log.nightDispatch}`);

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-2.5 text-center font-medium text-slate-500 whitespace-nowrap">${log.date.substring(5)}</td>
        <td class="p-2.5 font-bold text-slate-900 whitespace-nowrap">
          ${log.customerName}
          ${log.twoPersonWorker ? `<span class="ml-1 text-[10px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded">2인:${log.twoPersonWorker}</span>` : ""}
        </td>
        <td class="p-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">${log.subNo || "-"}</td>
        <td class="p-2.5 text-center font-bold ${log.internet > 0 ? 'text-blue-600' : 'text-slate-300'}">${log.internet || "-"}</td>
        <td class="p-2.5 text-center ${log.subTerminal > 0 ? 'text-blue-600 font-bold' : 'text-slate-300'}">${log.subTerminal || "-"}</td>
        <td class="p-2.5 text-center ${cctvDisplay ? 'text-slate-800 font-medium' : 'text-slate-300'}">${cctvDisplay || "-"}</td>
        <td class="p-2.5 text-center ${poleDisplay ? 'text-slate-800 font-medium' : 'text-slate-300'}">${poleDisplay || "-"}</td>
        <td class="p-2.5 text-center ${bldDisplay ? 'text-slate-800 font-medium' : 'text-slate-300'}">${bldDisplay || "-"}</td>
        <td class="p-2.5 text-center text-[11px]">${otherDisplay.join(" ") || "-"}</td>
        <td class="p-2.5 text-center text-[11px] text-purple-700 font-medium">${dutyDisplay.join(" ") || "-"}</td>
        <td class="p-2.5 text-[11px] text-slate-500 max-w-[140px] truncate" title="${log.memo || ''}">
          ${log.memo ? `<span class="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">${log.memo}</span>` : "-"}
        </td>
        <td class="p-2.5 text-right font-extrabold text-blue-600 whitespace-nowrap">${fee.toLocaleString()}원</td>
        <td class="p-2.5 text-center whitespace-nowrap">
          <button onclick="editWorkLog('${log.id}')" class="text-slate-400 hover:text-blue-600 p-1"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
          <button onclick="deleteWorkLog('${log.id}')" class="text-slate-400 hover:text-rose-600 p-1 ml-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </td>
      </tr>
    `;
  }).join("");

  // 모바일 카드 뷰
  listMobile.innerHTML = filtered.map(log => {
    const fee = calculateLogFee(log);
    
    // 주요 작업 배지 목록 생성
    const badges = [];
    if (log.internet > 0) badges.push(`<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">인터넷 ${log.internet}</span>`);
    if (log.subTerminal > 0) badges.push(`<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">추가단말 ${log.subTerminal}</span>`);
    if (log.cctv1 > 0 || log.cctv2 > 0) badges.push(`<span class="bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-medium">CCTV(${log.cctv1 || log.cctv2})</span>`);
    if (log.poleRn1 > 0 || log.poleRn2 > 0) badges.push(`<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">전주RN(${log.poleRn1 || log.poleRn2})</span>`);
    if (log.buildingRn1 > 0 || log.buildingRn2 > 0) badges.push(`<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">구내RN(${log.buildingRn1 || log.buildingRn2})</span>`);
    if (log.cancel > 0) badges.push(`<span class="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">해지</span>`);
    if (log.buildingWork > 0) badges.push(`<span class="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">공사</span>`);
    if (log.trouble > 0) badges.push(`<span class="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">장애</span>`);
    if (log.dayDuty > 0) badges.push(`<span class="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">주간당직</span>`);
    if (log.nightDispatch > 0) badges.push(`<span class="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">시간외출동</span>`);

    return `
      <div class="p-3 bg-white border border-slate-200/90 rounded-xl shadow-2xs hover:border-blue-300 transition-all">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-500">${log.date}</span>
              ${log.subNo ? `<span class="text-[10px] font-mono text-slate-400">${log.subNo}</span>` : ""}
            </div>
            <h4 class="text-sm font-bold text-slate-900 mt-0.5">${log.customerName}</h4>
          </div>
          <div class="text-right">
            <span class="text-sm font-extrabold text-blue-600">${fee.toLocaleString()}원</span>
          </div>
        </div>

        <div class="flex flex-wrap gap-1 mt-2 text-[11px]">
          ${badges.join("")}
          ${log.twoPersonWorker ? `<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">파트너: ${log.twoPersonWorker}</span>` : ""}
        </div>

        ${log.memo ? `
          <div class="mt-2 text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-center gap-1">
            <i data-lucide="tag" class="w-3 h-3 text-slate-400"></i>
            <span>${log.memo}</span>
          </div>
        ` : ""}

        <div class="flex items-center justify-end gap-3 mt-2.5 pt-2 border-t border-slate-100">
          <button onclick="editWorkLog('${log.id}')" class="text-xs text-blue-600 font-semibold flex items-center gap-1">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> 수정
          </button>
          <button onclick="deleteWorkLog('${log.id}')" class="text-xs text-rose-500 font-semibold flex items-center gap-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> 삭제
          </button>
        </div>
      </div>
    `;
  }).join("");

  lucide.createIcons();
}

// 검색 필터 이벤트
document.getElementById("searchKeyword")?.addEventListener("input", () => {
  renderList();
});

// ----------------------------------------------------
// 4. 월간 캘린더 렌더링
// ----------------------------------------------------
function renderCalendar() {
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth(); // 0-based

  document.getElementById("calendarTitle").textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0: 일요일
  const daysInMonth = lastDay.getDate();

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  // 일별 작업 데이터 그룹핑
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const dayDataMap = {};
  workLogs.filter(l => l.date && l.date.startsWith(monthStr)).forEach(l => {
    const day = parseInt(l.date.split("-")[2], 10);
    if (!dayDataMap[day]) {
      dayDataMap[day] = { count: 0, totalFee: 0, logs: [] };
    }
    dayDataMap[day].count += 1;
    dayDataMap[day].totalFee += calculateLogFee(l);
    dayDataMap[day].logs.push(l);
  });

  // 시작 요일까지 빈 칸
  for (let i = 0; i < startDayOfWeek; i++) {
    const blank = document.createElement("div");
    blank.className = "h-16 sm:h-20 bg-slate-50/50 rounded-xl border border-dashed border-slate-100";
    grid.appendChild(blank);
  }

  // 날짜 칸 생성
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    const isToday = isThisMonth && today.getDate() === d;
    const dayData = dayDataMap[d];

    const currentCellDate = `${monthStr}-${String(d).padStart(2, "0")}`;

    cell.className = `h-16 sm:h-20 p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
      isToday ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-sm'
    }`;

    // 상단 날짜 숫자
    const dayOfWeek = new Date(year, month, d).getDay();
    let numColorClass = "text-slate-800";
    if (dayOfWeek === 0) numColorClass = "text-rose-500 font-semibold";
    if (dayOfWeek === 6) numColorClass = "text-blue-500 font-semibold";

    cell.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs ${numColorClass} ${isToday ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center font-bold' : ''}">${d}</span>
        ${dayData ? `<span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.2 rounded-md">${dayData.count}건</span>` : ""}
      </div>
      <div class="text-right">
        ${dayData ? `<div class="text-[10px] sm:text-xs font-extrabold text-blue-600 leading-tight">${dayData.totalFee.toLocaleString()}원</div>` : ""}
      </div>
    `;

    cell.onclick = () => showCalendarDayDetail(currentCellDate, dayData);
    grid.appendChild(cell);
  }
}

function changeCalendarMonth(delta) {
  calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + delta);
  renderCalendar();
}

function goTodayCalendar() {
  calendarCurrentDate = new Date();
  renderCalendar();
}

function showCalendarDayDetail(dateStr, dayData) {
  const detailCard = document.getElementById("calendarDetailCard");
  const dateText = document.getElementById("calSelectedDateText");
  const totalText = document.getElementById("calSelectedDayTotal");
  const logsContainer = document.getElementById("calSelectedDayLogs");

  detailCard.classList.remove("hidden");
  dateText.textContent = `${dateStr} 작업 상세`;

  if (!dayData || dayData.logs.length === 0) {
    totalText.textContent = "0원";
    logsContainer.innerHTML = `
      <div class="text-slate-400 py-3 text-center">해당 일자의 작업 내역이 없습니다.</div>
      <button onclick="quickAddForDate('${dateStr}')" class="w-full mt-2 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 flex items-center justify-center gap-1">
        <i data-lucide="plus" class="w-4 h-4"></i> 이 날짜에 새 작업 등록하기
      </button>
    `;
    lucide.createIcons();
    return;
  }

  totalText.textContent = `총 ${dayData.totalFee.toLocaleString()}원 (${dayData.count}건)`;
  logsContainer.innerHTML = dayData.logs.map(l => {
    const fee = calculateLogFee(l);
    return `
      <div class="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100">
        <div>
          <div class="font-bold text-slate-800">${l.customerName}</div>
          <div class="text-[11px] text-slate-500">${l.memo || l.twoPersonWorker || "기본 작업"}</div>
        </div>
        <div class="text-right">
          <div class="font-extrabold text-blue-600">${fee.toLocaleString()}원</div>
          <button onclick="editWorkLog('${l.id}')" class="text-[10px] text-slate-400 hover:text-blue-600 underline">수정</button>
        </div>
      </div>
    `;
  }).join("") + `
    <button onclick="quickAddForDate('${dateStr}')" class="w-full mt-2 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 flex items-center justify-center gap-1">
      <i data-lucide="plus" class="w-4 h-4"></i> 이 날짜에 작업 추가하기
    </button>
  `;
  lucide.createIcons();
}

function quickAddForDate(dateStr) {
  document.getElementById("inputDate").value = dateStr;
  switchTab("input");
}

// ----------------------------------------------------
// 5. 정산 리포트 집계표 렌더링
// ----------------------------------------------------
function renderSettlementReport() {
  const [y, mm] = currentMonth.split("-");
  document.getElementById("reportMonthLabel").textContent = `${y}년 ${parseInt(mm, 10)}월 정산 내역`;

  const logs = workLogs.filter(l => l.date && l.date.startsWith(currentMonth));

  // 건수/가중치 합계 계산
  const totals = {
    internet: 0,
    subTerminal: 0,
    cctv1: 0,
    cctv2: 0,
    cctv2Weighted: 0,
    poleRn1: 0,
    poleRn2: 0,
    poleRn2Weighted: 0,
    buildingRn1: 0,
    buildingRn2: 0,
    buildingRn2Weighted: 0,
    cancel: 0,
    buildingWork: 0,
    trouble: 0,
    dayDuty: 0,
    nightDispatch: 0
  };

  const activeDates = new Set();

  logs.forEach(l => {
    activeDates.add(l.date);
    totals.internet += Number(l.internet) || 0;
    totals.subTerminal += Number(l.subTerminal) || 0;
    totals.cctv1 += Number(l.cctv1) || 0;
    
    // CCTV 2인 가중치 처리
    const c2 = Number(l.cctv2) || 0;
    totals.cctv2 += c2;
    // 엑셀에서 0.8 또는 정수값으로 들어온 경우 대응
    totals.cctv2Weighted += (c2 % 1 !== 0) ? c2 : (c2 * 0.8);

    totals.poleRn1 += Number(l.poleRn1) || 0;
    const p2 = Number(l.poleRn2) || 0;
    totals.poleRn2 += p2;
    totals.poleRn2Weighted += (p2 % 1 !== 0) ? p2 : (p2 * 0.8);

    totals.buildingRn1 += Number(l.buildingRn1) || 0;
    const b2 = Number(l.buildingRn2) || 0;
    totals.buildingRn2 += b2;
    totals.buildingRn2Weighted += (b2 % 1 !== 0) ? b2 : (b2 * 0.8);

    totals.cancel += Number(l.cancel) || 0;
    totals.buildingWork += Number(l.buildingWork) || 0;
    totals.trouble += Number(l.trouble) || 0;
    totals.dayDuty += Number(l.dayDuty) || 0;
    totals.nightDispatch += Number(l.nightDispatch) || 0;
  });

  // 항목별 정산액 계산
  const items = [
    { name: "인터넷", rate: rates.internet, count: totals.internet, weight: "-", sum: totals.internet * rates.internet },
    { name: "추가단말", rate: rates.subTerminal, count: totals.subTerminal, weight: "-", sum: totals.subTerminal * rates.subTerminal },
    { name: "CCTV 1인", rate: rates.cctv1, count: totals.cctv1, weight: "-", sum: totals.cctv1 * rates.cctv1 },
    { name: "CCTV 2인 (0.8)", rate: rates.cctv2, count: totals.cctv2, weight: totals.cctv2Weighted.toFixed(1), sum: Math.round(totals.cctv2Weighted * rates.cctv1) || Math.round(totals.cctv2 * rates.cctv2) },
    { name: "전주RN 포설 (1인)", rate: rates.poleRn1, count: totals.poleRn1, weight: "-", sum: totals.poleRn1 * rates.poleRn1 },
    { name: "전주RN 포설 (2인)", rate: rates.poleRn2, count: totals.poleRn2, weight: totals.poleRn2Weighted.toFixed(1), sum: Math.round(totals.poleRn2Weighted * rates.poleRn1) || Math.round(totals.poleRn2 * rates.poleRn2) },
    { name: "구내, 옥상RN (1인)", rate: rates.buildingRn1, count: totals.buildingRn1, weight: "-", sum: totals.buildingRn1 * rates.buildingRn1 },
    { name: "구내, 옥상RN (2인)", rate: rates.buildingRn2, count: totals.buildingRn2, weight: totals.buildingRn2Weighted.toFixed(1), sum: Math.round(totals.buildingRn2Weighted * rates.buildingRn1) || Math.round(totals.buildingRn2 * rates.buildingRn2) },
    { name: "해지", rate: rates.cancel, count: totals.cancel, weight: "-", sum: totals.cancel * rates.cancel },
    { name: "구내공사", rate: rates.buildingWork, count: totals.buildingWork, weight: "-", sum: totals.buildingWork * rates.buildingWork },
    { name: "장애 (AS)", rate: rates.trouble, count: totals.trouble, weight: "-", sum: totals.trouble * rates.trouble },
    { name: "주간당직", rate: rates.dayDuty, count: totals.dayDuty, weight: "-", sum: totals.dayDuty * rates.dayDuty },
    { name: "시간외 출동", rate: rates.nightDispatch, count: totals.nightDispatch, weight: "-", sum: Math.round(totals.nightDispatch * rates.nightDispatch) }
  ];

  const grandTotal = items.reduce((acc, cur) => acc + cur.sum, 0);

  document.getElementById("reportGrandTotal").textContent = grandTotal.toLocaleString();
  document.getElementById("reportTotalCount").textContent = `${logs.length}건`;
  document.getElementById("reportActiveDays").textContent = `${activeDates.size}일`;
  const dailyAvg = activeDates.size > 0 ? Math.round(grandTotal / activeDates.size) : 0;
  document.getElementById("reportDailyAvg").textContent = `${dailyAvg.toLocaleString()}원`;

  const tbody = document.getElementById("settlementTableBody");
  tbody.innerHTML = items.map(it => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-2.5 font-bold text-slate-800">${it.name}</td>
      <td class="p-2.5 text-right text-slate-600">${it.rate.toLocaleString()}원</td>
      <td class="p-2.5 text-center font-semibold ${it.count > 0 ? 'text-blue-600' : 'text-slate-300'}">${it.count || 0}</td>
      <td class="p-2.5 text-center text-slate-500">${it.weight}</td>
      <td class="p-2.5 text-right font-extrabold ${it.sum > 0 ? 'text-slate-900' : 'text-slate-300'}">${it.sum.toLocaleString()}원</td>
    </tr>
  `).join("");

  document.getElementById("settlementTableTotal").textContent = `${grandTotal.toLocaleString()}원`;
}

// ----------------------------------------------------
// 6. 폼 입력 및 원터치 증감 로직
// ----------------------------------------------------
function adjustQty(elementId, delta) {
  const el = document.getElementById(elementId);
  if (!el) return;
  let val = parseFloat(el.value) || 0;
  val = Math.max(0, val + delta);
  el.value = Number.isInteger(val) ? val : val.toFixed(1);
}

function setCctvMode(mode) {
  cctvMode = mode;
  document.getElementById("cctvMode1").className = mode === 1 ? "px-2 py-0.5 rounded-md bg-blue-600 text-white" : "px-2 py-0.5 rounded-md text-slate-600";
  document.getElementById("cctvMode2").className = mode === 2 ? "px-2 py-0.5 rounded-md bg-blue-600 text-white" : "px-2 py-0.5 rounded-md text-slate-600";
  document.getElementById("cctvDesc").textContent = mode === 1 ? `1인: ${rates.cctv1.toLocaleString()}원` : `2인(0.8): ${rates.cctv2.toLocaleString()}원`;
}

function setPoleRnMode(mode) {
  poleRnMode = mode;
  document.getElementById("poleRnMode1").className = mode === 1 ? "px-2 py-0.5 rounded-md bg-blue-600 text-white" : "px-2 py-0.5 rounded-md text-slate-600";
  document.getElementById("poleRnMode2").className = mode === 2 ? "px-2 py-0.5 rounded-md bg-blue-600 text-white" : "px-2 py-0.5 rounded-md text-slate-600";
  document.getElementById("poleRnDesc").textContent = mode === 1 ? `1인: ${rates.poleRn1.toLocaleString()}원` : `2인(0.8): ${rates.poleRn2.toLocaleString()}원`;
}

function setBldRnMode(mode) {
  bldRnMode = mode;
  document.getElementById("bldRnMode1").className = mode === 1 ? "px-2 py-0.5 rounded-md bg-blue-600 text-white" : "px-2 py-0.5 rounded-md text-slate-600";
  document.getElementById("bldRnMode2").className = mode === 2 ? "px-2 py-0.5 rounded-md bg-blue-600 text-white" : "px-2 py-0.5 rounded-md text-slate-600";
  document.getElementById("bldRnDesc").textContent = mode === 1 ? `1인: ${rates.buildingRn1.toLocaleString()}원` : `2인(0.8): ${rates.buildingRn2.toLocaleString()}원`;
}

function setPartner(name) {
  document.getElementById("inputPartner").value = name;
}

function appendMemo(tag) {
  const memoEl = document.getElementById("inputMemo");
  if (!memoEl.value) {
    memoEl.value = tag;
  } else if (!memoEl.value.includes(tag)) {
    memoEl.value += `, ${tag}`;
  }
}

function initFormEvents() {
  const form = document.getElementById("workLogForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const editId = document.getElementById("editLogId").value;
    const date = document.getElementById("inputDate").value;
    const subNo = document.getElementById("inputSubNo").value.trim();
    const customerName = document.getElementById("inputCustomerName").value.trim();

    if (!date || !customerName) {
      alert("작업 일자와 고객명을 입력해 주세요.");
      return;
    }

    const cctvVal = parseFloat(document.getElementById("inputCctvVal").value) || 0;
    const poleVal = parseFloat(document.getElementById("inputPoleRnVal").value) || 0;
    const bldVal = parseFloat(document.getElementById("inputBldRnVal").value) || 0;

    const newLog = {
      id: editId || `log-${Date.now()}`,
      date,
      subNo,
      customerName,
      internet: parseFloat(document.getElementById("inputInternet").value) || 0,
      subTerminal: parseFloat(document.getElementById("inputSubTerminal").value) || 0,
      cctv1: cctvMode === 1 ? cctvVal : 0,
      cctv2: cctvMode === 2 ? cctvVal : 0,
      poleRn1: poleRnMode === 1 ? poleVal : 0,
      poleRn2: poleRnMode === 2 ? poleVal : 0,
      buildingRn1: bldRnMode === 1 ? bldVal : 0,
      buildingRn2: bldRnMode === 2 ? bldVal : 0,
      cancel: parseFloat(document.getElementById("inputCancel").value) || 0,
      buildingWork: parseFloat(document.getElementById("inputBldWork").value) || 0,
      trouble: parseFloat(document.getElementById("inputTrouble").value) || 0,
      dayDuty: parseFloat(document.getElementById("inputDayDuty").value) || 0,
      nightDispatch: parseFloat(document.getElementById("inputNightDispatch").value) || 0,
      twoPersonWorker: document.getElementById("inputPartner").value.trim(),
      memo: document.getElementById("inputMemo").value.trim()
    };

    if (editId) {
      const idx = workLogs.findIndex(l => l.id === editId);
      if (idx !== -1) workLogs[idx] = newLog;
    } else {
      workLogs.unshift(newLog);
    }

    saveLogsToStorage();
    resetForm();
    renderAll();
    switchTab("list");
  });

  document.getElementById("btnResetForm").addEventListener("click", resetForm);
}

function resetForm() {
  document.getElementById("editLogId").value = "";
  document.getElementById("inputSubNo").value = "";
  document.getElementById("inputCustomerName").value = "";
  document.getElementById("inputInternet").value = "0";
  document.getElementById("inputSubTerminal").value = "0";
  document.getElementById("inputCctvVal").value = "0";
  document.getElementById("inputPoleRnVal").value = "0";
  document.getElementById("inputBldRnVal").value = "0";
  document.getElementById("inputCancel").value = "0";
  document.getElementById("inputBldWork").value = "0";
  document.getElementById("inputTrouble").value = "0";
  document.getElementById("inputDayDuty").value = "0";
  document.getElementById("inputNightDispatch").value = "0";
  document.getElementById("inputPartner").value = "";
  document.getElementById("inputMemo").value = "";

  document.getElementById("btnSubmitText").textContent = "작업일지 등록하기";
}

function editWorkLog(id) {
  const log = workLogs.find(l => l.id === id);
  if (!log) return;

  document.getElementById("editLogId").value = log.id;
  document.getElementById("inputDate").value = log.date;
  document.getElementById("inputSubNo").value = log.subNo || "";
  document.getElementById("inputCustomerName").value = log.customerName || "";
  document.getElementById("inputInternet").value = log.internet || 0;
  document.getElementById("inputSubTerminal").value = log.subTerminal || 0;

  if (log.cctv2 > 0) {
    setCctvMode(2);
    document.getElementById("inputCctvVal").value = log.cctv2;
  } else {
    setCctvMode(1);
    document.getElementById("inputCctvVal").value = log.cctv1 || 0;
  }

  if (log.poleRn2 > 0) {
    setPoleRnMode(2);
    document.getElementById("inputPoleRnVal").value = log.poleRn2;
  } else {
    setPoleRnMode(1);
    document.getElementById("inputPoleRnVal").value = log.poleRn1 || 0;
  }

  if (log.buildingRn2 > 0) {
    setBldRnMode(2);
    document.getElementById("inputBldRnVal").value = log.buildingRn2;
  } else {
    setBldRnMode(1);
    document.getElementById("inputBldRnVal").value = log.buildingRn1 || 0;
  }

  document.getElementById("inputCancel").value = log.cancel || 0;
  document.getElementById("inputBldWork").value = log.buildingWork || 0;
  document.getElementById("inputTrouble").value = log.trouble || 0;
  document.getElementById("inputDayDuty").value = log.dayDuty || 0;
  document.getElementById("inputNightDispatch").value = log.nightDispatch || 0;
  document.getElementById("inputPartner").value = log.twoPersonWorker || "";
  document.getElementById("inputMemo").value = log.memo || "";

  document.getElementById("btnSubmitText").textContent = "작업일지 수정 저장";
  switchTab("input");
}

function deleteWorkLog(id) {
  if (!confirm("해당 작업일지를 삭제하시겠습니까?")) return;
  workLogs = workLogs.filter(l => l.id !== id);
  saveLogsToStorage();
  renderAll();
}

// ----------------------------------------------------
// 7. 엑셀 내보내기 & 가져오기 (SheetJS)
// ----------------------------------------------------
function exportToExcel() {
  const currentLogs = workLogs.filter(l => l.date && l.date.startsWith(currentMonth));
  if (currentLogs.length === 0) {
    alert("내보낼 작업 내역이 없습니다.");
    return;
  }

  // 엑셀 헤더 정의 (기존 엑셀 원본 양식과 100% 동일)
  const excelData = [
    [
      "날짜", "가입번호", "고객명", "인터넷", "추가단말", "CCTV", "CCTV2",
      "전주RN 포설", "전주RN 포설2", "구내,옥상RN", "구내,옥상RN2",
      "해지", "구내공사", "장애", "주간당직", "시간외 출동", "2인 작업", "비고"
    ]
  ];

  currentLogs.sort((a, b) => a.date.localeCompare(b.date));

  currentLogs.forEach(l => {
    excelData.push([
      l.date || "",
      l.subNo || "",
      l.customerName || "",
      l.internet || "",
      l.subTerminal || "",
      l.cctv1 || "",
      l.cctv2 || "",
      l.poleRn1 || "",
      l.poleRn2 || "",
      l.buildingRn1 || "",
      l.buildingRn2 || "",
      l.cancel || "",
      l.buildingWork || "",
      l.trouble || "",
      l.dayDuty || "",
      l.nightDispatch || "",
      l.twoPersonWorker || "",
      l.memo || ""
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${currentMonth} 작업일지`);

  const fileName = `작업일지_${currentMonth}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (rows.length < 2) {
        alert("엑셀 데이터가 올바르지 않습니다.");
        return;
      }

      let importedCount = 0;
      // 첫 행(헤더)을 제외하고 데이터 파싱
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0] || !row[2]) continue; // 날짜와 고객명 없으면 건너뜀

        let dateVal = String(row[0]).trim();
        // 엑셀 날짜 일련번호인 경우 변환
        if (!isNaN(dateVal) && dateVal.length === 5) {
          const dateObj = new Date((parseInt(dateVal, 10) - 25569) * 86400 * 1000);
          dateVal = dateObj.toISOString().substring(0, 10);
        }

        const newLog = {
          id: `log-import-${Date.now()}-${i}`,
          date: dateVal,
          subNo: String(row[1] || "").trim(),
          customerName: String(row[2] || "").trim(),
          internet: parseFloat(row[3]) || 0,
          subTerminal: parseFloat(row[4]) || 0,
          cctv1: parseFloat(row[5]) || 0,
          cctv2: parseFloat(row[6]) || 0,
          poleRn1: parseFloat(row[7]) || 0,
          poleRn2: parseFloat(row[8]) || 0,
          buildingRn1: parseFloat(row[9]) || 0,
          buildingRn2: parseFloat(row[10]) || 0,
          cancel: parseFloat(row[11]) || 0,
          buildingWork: parseFloat(row[12]) || 0,
          trouble: parseFloat(row[13]) || 0,
          dayDuty: parseFloat(row[14]) || 0,
          nightDispatch: parseFloat(row[15]) || 0,
          twoPersonWorker: String(row[16] || "").trim(),
          memo: String(row[17] || "").trim()
        };

        workLogs.push(newLog);
        importedCount++;
      }

      saveLogsToStorage();
      initMonthSelector();
      renderAll();
      alert(`총 ${importedCount}건의 작업 내역을 성공적으로 가져왔습니다.`);
      event.target.value = "";
    } catch (err) {
      alert("엑셀 파일을 파싱하는 중 오류가 발생했습니다: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ----------------------------------------------------
// 8. 설정 및 단가표 관리
// ----------------------------------------------------
const RATE_LABELS = {
  internet: "인터넷",
  subTerminal: "추가단말",
  cctv1: "CCTV (1인)",
  cctv2: "CCTV (2인/0.8)",
  poleRn1: "전주RN (1인)",
  poleRn2: "전주RN (2인/0.8)",
  buildingRn1: "구내,옥상RN (1인)",
  buildingRn2: "구내,옥상RN (2인/0.8)",
  cancel: "해지",
  buildingWork: "구내공사",
  trouble: "장애(AS)",
  dayDuty: "주간당직",
  nightDispatch: "시간외 출동"
};

function initRatesSettings() {
  const container = document.getElementById("ratesInputsContainer");
  container.innerHTML = Object.keys(RATE_LABELS).map(key => `
    <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
      <label class="block text-xs font-semibold text-slate-600 mb-1">${RATE_LABELS[key]}</label>
      <div class="relative">
        <input type="number" id="rate_${key}" value="${rates[key]}" class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
        <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
      </div>
    </div>
  `).join("");

  document.getElementById("ratesForm").addEventListener("submit", (e) => {
    e.preventDefault();
    Object.keys(RATE_LABELS).forEach(key => {
      const val = parseInt(document.getElementById(`rate_${key}`).value, 10);
      if (!isNaN(val)) rates[key] = val;
    });
    saveRatesToStorage();
    renderAll();
    alert("단가표가 성공적으로 저장되었습니다!");
  });
}

function resetRatesToDefault() {
  if (!confirm("기본 단가로 초기화하시겠습니까?")) return;
  rates = { ...DEFAULT_RATES };
  saveRatesToStorage();
  initRatesSettings();
  renderAll();
}

function backupDataJson() {
  const data = {
    workLogs,
    rates,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `작업일지_백업_${new Date().toISOString().substring(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function restoreDataJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if (json.workLogs && Array.isArray(json.workLogs)) {
        workLogs = json.workLogs;
        if (json.rates) rates = { ...DEFAULT_RATES, ...json.rates };
        saveLogsToStorage();
        saveRatesToStorage();
        initMonthSelector();
        initRatesSettings();
        renderAll();
        alert("백업 파일에서 성공적으로 데이터를 복원했습니다!");
      }
    } catch (err) {
      alert("백업 파일 복원 실패: " + err.message);
    }
  };
  reader.readAsText(file);
}

function loadSampleData() {
  if (!confirm("엑셀 원본의 6월~9월 초기 샘플 데이터를 다시 불러오시겠습니까?")) return;
  workLogs = [...INITIAL_WORK_LOGS];
  saveLogsToStorage();
  initMonthSelector();
  renderAll();
  alert("초기 데이터가 정상적으로 로드되었습니다.");
}
