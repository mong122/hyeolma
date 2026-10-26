// 혈마 키우기 — 게임 규칙 (화면 없이 숫자만 움직임)
var HM = (typeof HM !== 'undefined') ? HM : {};

(function (HM) {
  const B = HM.B;

  // ── 숫자 줄여 쓰기: 1K · 1M · 1B · 1aa · 1ab …
  HM.fmt = function (n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + HM.fmt(-n);
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
    const units = ['K', 'M', 'B'];
    let i = Math.floor(Math.log10(n) / 3);
    const v = n / Math.pow(1000, i);
    const s = v >= 100 ? Math.floor(v) : v >= 10 ? (Math.floor(v * 10) / 10) : (Math.floor(v * 100) / 100);
    let u;
    if (i <= 3) u = units[i - 1];
    else { const k = i - 4; u = String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26); }
    return s + u;
  };

  // ── 새 저장 자료
  HM.newState = function () {
    return {
      v: 1, cycle: 1, level: 1, exp: 0, silver: 0,
      floor: 1, maxFloor: 1, kills: 0, autoUp: true,
      up: { atk: 0, hp: 0, def: 0, spd: 0, crit: 0, critDmg: 0 },
      cards: {}, pending: 0, seen: {},
      autoSkill: { s1: false, s2: false },
      talked: {}, lastSave: Date.now(),
      goal: 2, hold: false,                       // 멈췄을 때 다시 갈 층 · 내가 골라 머무는 중인지
      opt: { autoBoss: true, onFail: 'down' },    // 보스 자동 도전 · 지면 down(한 층 아래) / stay(이 층에 머묾)
      rec: { kills: 0, playSec: 0, cardsPicked: 0 }
    };
  };

  // ── 지금 능력치 계산 (강화 + 레벨 + 카드)
  HM.calc = function (st) {
    const s = { atkMul: 1, hpMul: 1, spdMul: 1, regen: 0, taken: 1, silverMul: 1, expMul: 1,
      dbl: 0, crit: B.critBase, critMul: B.critMulBase, steal: 0, bleed: 0, bleedMul: 1, bleedAmp: 0, berserk: 0, drain: 0 };
    for (const id in st.cards) {
      const c = HM.CARD[id];
      if (!c) continue;
      for (let i = 0; i < st.cards[id]; i++) c.fx(s);
    }
    const L = st.up;
    const lv = 1 + 0.05 * (st.level - 1);
    s.atk = B.baseAtk * (1 + B.upLin * L.atk) * Math.pow(B.upPow, L.atk) * lv * s.atkMul;
    s.maxHp = B.baseHp * (1 + B.upLin * L.hp) * Math.pow(B.upPow, L.hp) * lv * Math.max(0.1, s.hpMul);
    s.spd = Math.min(6, B.baseSpd * (1 + 0.05 * L.spd) * s.spdMul);
    s.taken /= 1 + 0.03 * L.def;
    s.crit = Math.min(0.9, s.crit + 0.01 * L.crit);
    s.critMul += 0.1 * L.critDmg;
    s.dbl = Math.min(0.9, s.dbl);
    return s;
  };

  HM.upCost = function (st, key, n) {
    const u = HM.UPS[key];
    let lv = st.up[key], total = 0, cnt = 0;
    const lim = n === 'max' ? 1e4 : n;
    while (cnt < lim && lv < u.max) {
      const c = u.cost0 * Math.pow(u.costGrow, lv);
      if (n === 'max' && total + c > st.silver) break;
      total += c; lv++; cnt++;
    }
    return { cost: total, count: cnt };
  };
  HM.buyUp = function (st, key, n) {
    const r = HM.upCost(st, key, n);
    if (r.count === 0 || r.cost > st.silver) return false;
    st.silver -= r.cost;
    st.up[key] += r.count;
    return true;
  };

  HM.needExp = lv => B.lvExp0 * Math.pow(B.lvExpGrow, lv - 1);
  HM.isBoss = f => f % 10 === 0;
  HM.stageOf = f => HM.STAGES.find(x => f >= x.from && f <= x.to) || HM.STAGES[HM.STAGES.length - 1];

  HM.monster = function (f) {
    const boss = HM.isBoss(f);
    const g = f - 1;
    let look;
    if (boss) look = HM.BOSSES[f] || HM.BOSS_LATER[(f / 10) % HM.BOSS_LATER.length];
    else { const pool = HM.MOBS[Math.floor((f - 1) / 10) % HM.MOBS.length]; look = pool[Math.floor(Math.random() * pool.length)]; }
    const hp = B.monHp0 * Math.pow(B.monHpGrow, g) * (boss ? B.bossHpMul : 1);
    return {
      boss, emoji: look[0], name: look[1], hp, maxHp: hp,
      atk: B.monAtk0 * Math.pow(B.monAtkGrow, g) * (boss ? B.bossAtkMul : 1),
      bleedT: 0
    };
  };
  HM.reward = function (st, f, s) {
    const m = HM.isBoss(f) ? B.bossRewardMul : 1;
    return {
      silver: B.silver0 * Math.pow(B.silverGrow, f - 1) * m * s.silverMul,
      exp: B.exp0 * Math.pow(B.expGrow, f - 1) * m * s.expMul
    };
  };

  // 경험치 넣고 레벨업 처리 → 오른 레벨 수
  HM.addExp = function (st, x) {
    st.exp += x;
    let up = 0;
    while (st.exp >= HM.needExp(st.level)) {
      st.exp -= HM.needExp(st.level);
      st.level++; st.pending++; up++;
    }
    return up;
  };

  // ── 카드 뽑기 3장
  function cardOk(st, c) {
    if (c.combo) return false;
    return !c.max || (st.cards[c.id] || 0) < c.max;
  }
  HM.tagCount = (st, tag) => Object.keys(st.cards).reduce((n, id) => n + (HM.CARD[id] && HM.CARD[id].tag === tag ? st.cards[id] : 0), 0);
  HM.comboReady = function (st) {
    return HM.CARDS.filter(c => c.combo && !st.cards[c.id] && HM.tagCount(st, c.combo.tag) >= c.combo.need);
  };
  HM.draw = function (st, rnd) {
    rnd = rnd || Math.random;
    const hand = [];
    HM.comboReady(st).forEach(c => { if (hand.length < 3) hand.push(c.id); });
    let guard = 0;
    while (hand.length < 3 && guard++ < 200) {
      let r = rnd() * B.rarW.reduce((a, b) => a + b, 0), rar = 0;
      while (r >= B.rarW[rar]) { r -= B.rarW[rar]; rar++; }
      const pool = HM.CARDS.filter(c => c.rar === rar && cardOk(st, c) && hand.indexOf(c.id) < 0);
      if (!pool.length) continue;
      hand.push(pool[Math.floor(rnd() * pool.length)].id);
    }
    return hand;
  };
  HM.pick = function (st, id) {
    st.cards[id] = (st.cards[id] || 0) + 1;
    st.pending = Math.max(0, st.pending - 1);
    st.rec.cardsPicked++;
    st.seen[id] = 1;
  };

  // ── 전투 (저장 안 하는 순간 상태)
  HM.SKILLS = {
    s1: { name: '혈살참', emoji: '🩸', cd: 10, desc: '공격력 8배 한 방' },
    s2: { name: '호신강기', emoji: '🛡', cd: 20, desc: '3초 무적 · 체력 30% 회복' }
  };
  HM.newBattle = function (st) {
    const s = HM.calc(st);
    return { s, hp: s.maxHp, mon: null, spawnT: 0.3, pT: 0, mT: 0, bossT: 0, inv: 0,
      cd: { s1: 0, s2: 0 }, paused: false };
  };
  HM.refresh = function (st, b) {
    const old = b.s.maxHp;
    b.s = HM.calc(st);
    b.hp = Math.min(b.s.maxHp, b.hp * (b.s.maxHp / old));
  };

  function hitDmg(b, mul) {
    const s = b.s;
    let d = s.atk * mul;
    if (s.berserk && b.hp < s.maxHp * 0.5) d *= 1 + s.berserk;
    if (b.mon.bleedT > 0) d *= 1 + s.bleedAmp;
    const crit = Math.random() < s.crit;
    if (crit) d *= s.critMul;
    return { d, crit };
  }
  function dealHit(st, b, ev, mul, kind) {
    const r = hitDmg(b, mul);
    b.mon.hp -= r.d;
    if (b.s.steal) b.hp = Math.min(b.s.maxHp, b.hp + r.d * b.s.steal);
    if (b.s.bleed > 0) b.mon.bleedT = 3;
    ev.push({ t: 'hit', d: r.d, crit: r.crit, kind });
  }

  // 지면: 다시 갈 층을 기억하고, 고른 방식대로 이 층에 머물거나 한 층 내려가 파밍
  function fail(st, b, ev, why) {
    const at = st.floor;
    if (!st.hold) st.goal = at;  // 내가 골라 머무는 중이면 머물기는 그대로
    if (st.opt.onFail === 'down' || HM.isBoss(at)) st.floor = Math.max(1, at - 1);
    st.kills = 0; st.autoUp = false;
    b.mon = null; b.spawnT = 0.8; b.hp = b.s.maxHp;
    ev.push({ t: 'fail', why });
  }

  HM.useSkill = function (st, b, key, ev) {
    if (b.cd[key] > 0 || !b.mon || b.mon.hp <= 0) return false;
    b.cd[key] = HM.SKILLS[key].cd;
    if (key === 's1') dealHit(st, b, ev, 8, 's1');
    else { b.inv = 3; b.hp = Math.min(b.s.maxHp, b.hp + b.s.maxHp * 0.3); }
    ev.push({ t: 'skill', key });
    return true;
  };

  // dt 초만큼 싸움 진행. ev 에 일어난 일을 쌓음 (화면이 보고 그림)
  HM.step = function (st, b, dt, ev) {
    if (b.paused) return;
    const s = b.s;
    st.rec.playSec += dt;
    for (const k in b.cd) b.cd[k] = Math.max(0, b.cd[k] - dt);
    b.inv = Math.max(0, b.inv - dt);
    // 체력 회복·깎임 (깎임으로는 쓰러지지 않음)
    b.hp = Math.min(s.maxHp, b.hp + s.maxHp * s.regen * dt);
    if (s.drain) b.hp = Math.max(1, b.hp - s.maxHp * s.drain * dt);

    if (!b.mon) {
      b.spawnT -= dt;
      if (b.spawnT > 0) return;
      b.mon = HM.monster(st.floor);
      b.pT = 0; b.mT = 0;
      if (b.mon.boss) { b.bossT = B.bossTime; ev.push({ t: 'boss', f: st.floor }); }
      ev.push({ t: 'spawn' });
      return;
    }
    const m = b.mon;

    // 자동 스킬
    for (const k in st.autoSkill) if (st.autoSkill[k] && b.cd[k] <= 0) {
      if (k === 's2' && b.hp > s.maxHp * 0.6) continue; // 호신강기는 체력 60% 아래에서만
      HM.useSkill(st, b, k, ev);
    }

    // 혈마 공격
    b.pT += dt;
    const gap = 1 / s.spd;
    while (b.pT >= gap && m.hp > 0) {
      b.pT -= gap;
      dealHit(st, b, ev, 1, 'atk');
      if (m.hp > 0 && Math.random() < s.dbl) dealHit(st, b, ev, 1, 'dbl');
    }
    // 출혈
    if (m.bleedT > 0 && m.hp > 0) {
      m.bleedT -= dt;
      m.hp -= s.atk * s.bleed * s.bleedMul * dt;
    }
    // 보스 시간
    if (m.boss && m.hp > 0) {
      b.bossT -= dt;
      if (b.bossT <= 0) { fail(st, b, ev, 'time'); return; }
    }
    // 몬스터 쓰러짐
    if (m.hp <= 0) {
      const r = HM.reward(st, st.floor, s);
      st.silver += r.silver;
      st.rec.kills++;
      const lv = HM.addExp(st, r.exp);
      ev.push({ t: 'kill', silver: r.silver, exp: r.exp, boss: m.boss, f: st.floor });
      if (lv) { HM.refresh(st, b); b.hp = b.s.maxHp; ev.push({ t: 'lvl', n: lv }); }
      b.mon = null; b.spawnT = B.spawnGap;
      if (m.boss) {
        st.kills = 0;
        ev.push({ t: 'bossDown', f: st.floor });
        st.floor++; st.autoUp = true; st.hold = false;
      } else {
        st.kills++;
        if (st.kills >= B.killsPerFloor) {
          st.kills = 0;
          if (st.autoUp) {
            // 보스 자동 도전을 껐으면 보스 앞에서 멈추고 기다림
            if (HM.isBoss(st.floor + 1) && !st.opt.autoBoss) {
              st.autoUp = false; st.goal = st.floor + 1;
              ev.push({ t: 'bossWait', f: st.goal });
            } else st.floor++;
          } else if (!st.hold && st.opt.autoBoss) {
            // 보스 자동 도전: 한 바퀴(한 층 몫) 파밍한 뒤 저절로 다시 도전
            if (st.goal <= st.floor) st.goal = st.floor + 1; // 머문 층을 한 바퀴 깼으면 다음 층으로
            HM.challenge(st, b);
            ev.push({ t: 'retry', f: st.floor });
            return;
          }
        }
      }
      st.maxFloor = Math.max(st.maxFloor, st.floor);
      return;
    }
    // 몬스터 공격
    b.mT += dt;
    while (b.mT >= B.monAtkGap) {
      b.mT -= B.monAtkGap;
      if (b.inv > 0) { ev.push({ t: 'block' }); continue; }
      const d = m.atk * s.taken;
      b.hp -= d;
      ev.push({ t: 'hurt', d });
      if (b.hp <= 0) { fail(st, b, ev, 'die'); return; }
    }
  };

  // 다시 도전 (아래 층에서 머물던 걸 풀고 다음 층으로)
  HM.challenge = function (st, b) {
    // 다시 갈 층이 위에 있으면 거기로, 이 층에 머물러 있었으면 이 층부터 다시 올라감
    if (st.goal > st.floor) st.floor = Math.min(st.goal, st.maxFloor + 1);
    st.autoUp = true; st.hold = false; st.kills = 0;
    st.maxFloor = Math.max(st.maxFloor, st.floor);
    b.mon = null; b.spawnT = 0.3; b.hp = b.s.maxHp;
  };

  // 층 고르기 (1층 ~ 최고층). hold = 그 층에 머물며 파밍, 아니면 거기서부터 올라감
  HM.goFloor = function (st, b, f, hold) {
    st.floor = Math.max(1, Math.min(st.maxFloor, Math.floor(f)));
    st.kills = 0; st.hold = !!hold; st.autoUp = !hold; st.goal = st.floor + 1;
    b.mon = null; b.spawnT = 0.3; b.hp = b.s.maxHp;
  };

  // 초당 피해 (대략, 출혈 포함)
  HM.dps = s => s.atk * s.spd * (1 + s.dbl) * (1 + s.crit * (s.critMul - 1)) + s.atk * s.bleed * s.bleedMul;

  // ── 방치 보상: 꺼 둔 동안 지금 층(보스 층이면 한 층 아래)에서 잡았을 만큼
  HM.offline = function (st, sec) {
    const max = B.offlineMaxH * 3600;
    sec = Math.min(Math.max(0, sec), max);
    const s = HM.calc(st);
    let f = st.floor; if (HM.isBoss(f)) f = Math.max(1, f - 1);
    const hp = B.monHp0 * Math.pow(B.monHpGrow, f - 1);
    const dps = HM.dps(s);
    const perKill = hp / dps + B.spawnGap;
    const kills = sec / perKill * B.offlineEff;
    const r = HM.reward(st, f, s);
    return { sec, max, kills, silver: kills * r.silver, exp: kills * r.exp };
  };

  // ── 백업 코드: HM1.(글자 덩어리).(확인 숫자)
  function sum(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1679616; return h.toString(36); }
  HM.exportCode = function (st) {
    const json = JSON.stringify(st);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return 'HM1.' + b64 + '.' + sum(b64);
  };
  HM.importCode = function (code) {
    const p = String(code).trim().split('.');
    if (p.length !== 3 || p[0] !== 'HM1') throw new Error('백업 코드 모양이 아니에요');
    if (sum(p[1]) !== p[2]) throw new Error('백업 코드가 중간에 잘렸거나 바뀌었어요');
    const st = JSON.parse(decodeURIComponent(escape(atob(p[1]))));
    return HM.fixState(st);
  };
  // 옛 저장에 없는 칸은 기본값으로 채움
  HM.fixState = function (st) {
    const base = HM.newState();
    for (const k in base) if (st[k] === undefined) st[k] = base[k];
    for (const k in base.up) if (st.up[k] === undefined) st.up[k] = 0;
    for (const k in base.rec) if (st.rec[k] === undefined) st.rec[k] = 0;
    for (const id in st.cards) st.seen[id] = 1;
    for (const k in base.opt) if (st.opt[k] === undefined) st.opt[k] = base.opt[k];
    for (const k in base.autoSkill) if (st.autoSkill[k] === undefined) st.autoSkill[k] = false;
    return st;
  };
})(HM);

if (typeof module !== 'undefined') module.exports = HM;
