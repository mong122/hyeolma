// 혈마 키우기 — 숫자·카드·몬스터 자료 (화면과 상관없는 것만)
var HM = (typeof HM !== 'undefined') ? HM : {};

HM.VERSION = '0.1.2';

// 균형 숫자 (여기만 고치면 게임 빠르기가 바뀜)
HM.B = {
  baseAtk: 10, baseHp: 100, baseSpd: 1.0,      // 혈마 처음 공격력·체력·초당 공격 수
  monHp0: 30, monHpGrow: 1.18,                  // 몬스터 체력 (층마다 곱함)
  monAtk0: 3, monAtkGrow: 1.16,                 // 몬스터 공격력
  monAtkGap: 1.5,                               // 몬스터가 몇 초마다 때리나
  bossHpMul: 8, bossAtkMul: 1.5, bossTime: 30,  // 보스: 체력 배수·공격 배수·제한 시간(초)
  killsPerFloor: 10,                             // 한 층에서 잡을 몬스터 수
  spawnGap: 0.5,                               // 다음 몬스터 나오기까지(초)
  silver0: 3, silverGrow: 1.14,                 // 한 마리당 은자
  exp0: 3, expGrow: 1.15,                       // 한 마리당 경험치
  bossRewardMul: 10,                            // 보스 보상 배수
  lvExp0: 25, lvExpGrow: 1.4,                  // 다음 레벨까지 필요한 경험치
  offlineMaxH: 8, offlineEff: 0.5,              // 방치: 최대 시간 · 켜 둔 때 대비 몇 배
  upLin: 0.1, upPow: 1.03,                     // 강화 한 번에 늘어나는 정도
  critBase: 0.05, critMulBase: 1.5,             // 처음 치명 확률·치명 피해 배수
  rarW: [60, 28, 10, 2]                         // 카드 등급 확률 (일반·희귀·영웅·전설)
};

// 강화 (은자로 올림)
HM.UPS = {
  atk:     { name: '공격력',    emoji: '🗡', cost0: 8,  costGrow: 1.15, max: 99999, desc: '한 번 때릴 때 피해' },
  hp:      { name: '체력',      emoji: '❤️', cost0: 8,  costGrow: 1.15, max: 99999, desc: '0이 되면 쓰러져요' },
  def:     { name: '방어력',    emoji: '🛡', cost0: 15, costGrow: 1.16, max: 99999, desc: '받는 피해가 줄어요' },
  spd:     { name: '공격 속도', emoji: '💨', cost0: 30, costGrow: 1.3,  max: 40,    desc: '1초에 몇 번 때리나' },
  crit:    { name: '치명 확률', emoji: '🎯', cost0: 40, costGrow: 1.22, max: 45,    desc: '치명타가 터질 확률' },
  critDmg: { name: '치명 피해', emoji: '💥', cost0: 40, costGrow: 1.18, max: 99999, desc: '치명타 때 몇 배로 때리나' }
};

HM.RAR = [
  { name: '일반', cls: 'r0' }, { name: '희귀', cls: 'r1' },
  { name: '영웅', cls: 'r2' }, { name: '전설', cls: 'r3' }
];

// 성장 카드: side 정 = 정파 무공, 혈 = 혈공 / rar 0~3 / max = 몇 장까지 / tag 출혈 = 조합용
HM.CARDS = [
  // 정파 무공 (안전·꾸준)
  { id: 'basic',   side: '정', rar: 0, emoji: '🗡', name: '기초 검법',   desc: '공격력 +12%', fx: s => { s.atkMul *= 1.12; } },
  { id: 'iron',    side: '정', rar: 0, emoji: '🧱', name: '철포삼',     desc: '최대 체력 +20%', fx: s => { s.hpMul *= 1.2; } },
  { id: 'light',   side: '정', rar: 0, emoji: '💨', name: '경신법',     desc: '공격 속도 +8%', fx: s => { s.spdMul *= 1.08; } },
  { id: 'breath',  side: '정', rar: 0, emoji: '🧘', name: '운기조식',   desc: '초당 체력 1% 회복', fx: s => { s.regen += 0.01; } },
  { id: 'greed',   side: '정', rar: 1, emoji: '💰', name: '전낭 수련',   desc: '은자 +30%', fx: s => { s.silverMul *= 1.3; } },
  { id: 'wisdom',  side: '정', rar: 1, emoji: '📜', name: '깨우침',     desc: '경험치 +30%', fx: s => { s.expMul *= 1.3; } },
  { id: 'chain',   side: '정', rar: 1, emoji: '⚔️', name: '연환검',     desc: '20% 확률로 두 번 공격', fx: s => { s.dbl += 0.2; } },
  { id: 'diamond', side: '정', rar: 1, emoji: '🛡', name: '금강불괴',   desc: '받는 피해 -15%', fx: s => { s.taken *= 0.85; } },
  { id: 'plum',    side: '정', rar: 2, emoji: '🌸', name: '매화검법',   desc: '공격력 +40%', fx: s => { s.atkMul *= 1.4; } },
  { id: 'taiji',   side: '정', rar: 2, emoji: '☯️', name: '태극심법',   desc: '초당 체력 2% 회복 · 받는 피해 -10%', fx: s => { s.regen += 0.02; s.taken *= 0.9; } },
  { id: 'best',    side: '정', rar: 3, emoji: '🌟', name: '천하제일검', desc: '공격력 +80% · 공격 속도 +20%', max: 1, fx: s => { s.atkMul *= 1.8; s.spdMul *= 1.2; } },
  // 혈공 (세지만 체력 깎음)
  { id: 'blood',   side: '혈', rar: 0, emoji: '🔥', name: '혈기',       desc: '공격력 +30% · 최대 체력 -10%', fx: s => { s.atkMul *= 1.3; s.hpMul *= 0.9; } },
  { id: 'bleed1',  side: '혈', rar: 0, emoji: '🩸', name: '출혈검',     desc: '때리면 출혈 (3초간 초당 공격력 20%) · 최대 체력 -5%', tag: '출혈', fx: s => { s.bleed += 0.2; s.hpMul *= 0.95; } },
  { id: 'vamp',    side: '혈', rar: 1, emoji: '🦇', name: '흡혈공',     desc: '준 피해의 4% 회복 · 최대 체력 -5%', fx: s => { s.steal += 0.04; s.hpMul *= 0.95; } },
  { id: 'bleed2',  side: '혈', rar: 1, emoji: '🩸', name: '혈조',       desc: '출혈 +10% · 출혈 피해 +50% · 최대 체력 -5%', tag: '출혈', fx: s => { s.bleed += 0.1; s.bleedMul *= 1.5; s.hpMul *= 0.95; } },
  { id: 'rage',    side: '혈', rar: 1, emoji: '😡', name: '광폭',       desc: '체력 절반 아래면 공격력 +60% · 최대 체력 -5%', fx: s => { s.berserk += 0.6; s.hpMul *= 0.95; } },
  { id: 'sea',     side: '혈', rar: 2, emoji: '🌊', name: '혈해',       desc: '공격 속도 +30% · 초당 체력 1% 깎임', fx: s => { s.spdMul *= 1.3; s.drain += 0.01; } },
  { id: 'mark',    side: '혈', rar: 2, emoji: '💢', name: '혈인',       desc: '치명 확률 +20% · 치명 피해 +50% · 최대 체력 -10%', fx: s => { s.crit += 0.2; s.critMul += 0.5; s.hpMul *= 0.9; } },
  { id: 'bleed3',  side: '혈', rar: 2, emoji: '🌧', name: '혈우',       desc: '출혈 +40% · 출혈 걸린 적에게 피해 +15% · 최대 체력 -10%', tag: '출혈', fx: s => { s.bleed += 0.4; s.bleedAmp += 0.15; s.hpMul *= 0.9; } },
  { id: 'demon',   side: '혈', rar: 3, emoji: '😈', name: '혈마강림',   desc: '공격력 +150% · 최대 체력 -25%', max: 1, fx: s => { s.atkMul *= 2.5; s.hpMul *= 0.75; } },
  // 조합 카드 (뽑기에 그냥은 안 나옴)
  { id: 'burst',   side: '혈', rar: 3, emoji: '💥', name: '출혈 폭발',  desc: '[조합] 출혈 피해 3배 · 공격 속도 +20%', max: 1, combo: { tag: '출혈', need: 3 }, fx: s => { s.bleedMul *= 3; s.spdMul *= 1.2; } }
];
HM.CARD = {};
HM.CARDS.forEach(c => { HM.CARD[c.id] = c; });

// 무대 1: 혈교 수련장 (1~50층, 50층 = 혈교 교주)
HM.STAGES = [
  { id: 1, name: '혈교 수련장', emoji: '🏯', from: 1, to: 50, cls: 'st1' }
];

// 10층 묶음마다 나오는 몬스터
HM.MOBS = [
  [['🪵', '수련 목인'], ['🐀', '혈쥐']],
  [['🐍', '독사'], ['🦂', '혈전갈']],
  [['🐺', '혈랑'], ['🐗', '멧돼지']],
  [['👺', '혈교 수련생'], ['🦇', '흡혈 박쥐']],
  [['🥷', '혈교 무사'], ['👻', '원귀']]
];
// 10층마다 보스
HM.BOSSES = { 10: ['🧔', '혈교 사범'], 20: ['👴', '혈교 장로'], 30: ['🧛', '혈교 호법'], 40: ['🦹', '혈교 부교주'], 50: ['👹', '혈교 교주'] };
HM.BOSS_LATER = [['🐉', '혈교 수호수'], ['💀', '혈교 망령'], ['🗿', '혈교 석상']];

// 구간 끝 보스 앞뒤 대사 (건너뛰기 가능)
HM.TALK = {
  50: {
    before: [['👹', '교주', '꼬마야, 감히 내 자리를 넘보느냐?'], ['🧒', '혈마', '넘보는 게 아니에요. 가지러 왔어요.']],
    after:  [['👹', '교주', '크윽… 혈교는… 이제 네 것이다…'], ['🧒', '혈마', '이 정도로는 배가 안 차. 다음은 강호다.']]
  }
};
