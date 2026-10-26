// 혈마 키우기 — 화면 그리기·누르기
(function (HM) {
  const $ = id => document.getElementById(id);
  const fmt = HM.fmt;
  const SAVE_KEY = 'hyeolma.save';

  // ── 저장·불러오기 (폰 안)
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return HM.fixState(JSON.parse(raw));
    } catch (e) { console.warn('저장 읽기 실패', e); }
    return HM.newState();
  }
  function save() {
    st.lastSave = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) { console.warn('저장 실패', e); }
  }

  let st = load();
  const awaySec = (Date.now() - (st.lastSave || Date.now())) / 1000;
  const firstTime = st.rec.playSec < 1;
  const b = HM.newBattle(st);
  let mult = 1; // 강화 한 번에 몇 번 (1·10·'max')

  // ── 겹쳐 뜨는 창 (차례대로)
  const queue = [];
  let modalOpen = false;
  function showModal(build) { queue.push(build); }
  function openNext() {
    if (modalOpen) return;
    let build = queue.shift();
    if (!build && st.pending > 0) build = cardModal;
    if (!build) { b.paused = false; return; }
    modalOpen = true; b.paused = true;
    $('modal').hidden = false;
    build($('modalBox'));
  }
  function closeModal() {
    modalOpen = false;
    $('modal').hidden = true;
    $('modalBox').innerHTML = '';
    save();
    openNext();
  }

  // ── 광고 자리 (지금은 가짜 — 5판에서 애드몹 보상형 광고로 바꿀 곳은 여기 하나)
  HM.showRewardAd = function (done) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:#000e;z-index:30;display:flex;align-items:center;justify-content:center;text-align:center';
    d.innerHTML = '<div class="adBox">📺 광고 자리 (지금은 가짜)<div class="sec">3</div>잠깐만요…</div>';
    document.body.appendChild(d);
    let n = 3;
    const t = setInterval(() => {
      n--; d.querySelector('.sec').textContent = n;
      if (n <= 0) { clearInterval(t); d.remove(); done(); }
    }, 1000);
  };

  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, ms || 1600);
  }

  // ── 처음 화면
  function titleModal(box) {
    box.innerHTML = `<div class="title">
      <div class="hero">🧒</div>
      <h1>혈마 키우기</h1>
      <p class="line">혈교의 꼬마가 무림을, 이계를,<br>신까지 집어삼킨다.</p>
      <button class="big" id="go">${firstTime ? '시작하기' : '이어하기'}</button>
      <p style="font-size:11px;margin-top:12px">${HM.VERSION} · 1판</p></div>`;
    $('go').onclick = closeModal;
  }

  // ── 방치 보상
  function offlineModal(sec) {
    const r = HM.offline(st, sec);
    if (r.kills < 1) return;
    showModal(box => {
      const h = Math.floor(r.sec / 3600), m = Math.floor(r.sec % 3600 / 60);
      const capped = sec >= r.max;
      box.innerHTML = `<h2>🌙 자리를 비운 동안</h2>
        <p>${h ? h + '시간 ' : ''}${m}분 동안 혈마가 혼자 수련했어요${capped ? '<br>(최대 ' + HM.B.offlineMaxH + '시간까지 쌓여요)' : ''}</p>
        <div class="row"><div class="ic">🪙</div><div class="info"><b>은자 ${fmt(r.silver)}</b></div></div>
        <div class="row"><div class="ic">✨</div><div class="info"><b>경험치 ${fmt(r.exp)}</b></div></div>
        <button class="big gold" id="ad2">📺 광고 보고 2배 받기</button>
        <button class="big dim" id="take">그냥 받기</button>`;
      const give = k => {
        st.silver += r.silver * k;
        const lv = HM.addExp(st, r.exp * k);
        HM.refresh(st, b); b.hp = b.s.maxHp;
        if (lv) toast(`레벨 ${lv} 올랐어요! 카드 ${lv}장 고르기`);
        closeModal();
      };
      $('take').onclick = () => give(1);
      $('ad2').onclick = () => HM.showRewardAd(() => give(2));
    });
  }

  // ── 레벨업 카드 3장 중 1장
  function cardModal(box) {
    let hand = HM.draw(st), rerolled = false;
    const draw = () => {
      box.innerHTML = `<h2>⬆️ 레벨 업! 카드 1장 고르기</h2>
        <p>이번 판에만 유효해요${st.pending > 1 ? ' · 남은 카드 ' + st.pending + '장' : ''}</p>
        <div class="pick">${hand.map(id => {
          const c = HM.CARD[id], have = st.cards[id] || 0;
          return `<button class="pcard ${HM.RAR[c.rar].cls}" data-id="${id}">
            <div class="e">${c.emoji}</div>
            <div><b>${c.name}</b> ${have ? '<span style="color:var(--gold)">×' + (have + 1) + '</span>' : ''}
              <small>${c.desc}</small>
              <div class="tags"><span class="rt ${HM.RAR[c.rar].cls}">${HM.RAR[c.rar].name}</span> ·
                <span class="side${c.side}">${c.side === '정' ? '정파 무공' : '혈공'}</span>${c.tag ? ' · ' + c.tag : ''}</div></div>
          </button>`;
        }).join('')}</div>
        <button class="big dim" id="reroll" ${rerolled ? 'disabled style="opacity:.4"' : ''}>📺 광고 보고 다시 뽑기</button>`;
      box.querySelectorAll('.pcard').forEach(el => el.onclick = () => {
        const c = HM.CARD[el.dataset.id];
        HM.pick(st, c.id);
        HM.refresh(st, b);
        if (c.combo) toast(`💥 조합 완성! ${c.name}`, 2200);
        else { const ready = HM.comboReady(st); if (ready.length) toast(`✨ 조합 카드가 열렸어요: ${ready[0].name}`, 2200); }
        if (curTab === 'cards') renderTab();
        closeModal();
      });
      $('reroll').onclick = () => { if (!rerolled) HM.showRewardAd(() => { rerolled = true; hand = HM.draw(st); draw(); }); };
    };
    draw();
  }

  // ── 보스 앞뒤 대사
  function talkModal(lines, after) {
    showModal(box => {
      let i = 0;
      const show = () => {
        const [e, nm, say] = lines[i];
        box.innerHTML = `<div class="talk"><div class="who">${e}</div>
          <div class="say"><div class="nm">${nm}</div>${say}</div>
          <button class="big" id="nx">${i < lines.length - 1 ? '다음' : (after ? '계속' : '싸운다!')}</button>
          <button class="big dim" id="sk">건너뛰기</button></div>`;
        $('nx').onclick = () => { i++; i < lines.length ? show() : closeModal(); };
        $('sk').onclick = closeModal;
      };
      show();
    });
  }

  // ── 스킬 단추
  function buildSkills() {
    $('skills').innerHTML = Object.keys(HM.SKILLS).map(k => {
      const s = HM.SKILLS[k];
      return `<div class="skill"><button class="sb" id="sb_${k}">${s.emoji}<div class="cd" id="cd_${k}"></div><div class="cdTxt" id="ct_${k}"></div></button>
        <div class="nm">${s.name}</div><button class="auto" id="au_${k}">자동</button></div>`;
    }).join('');
    for (const k in HM.SKILLS) {
      $('sb_' + k).onclick = () => { const ev = []; if (HM.useSkill(st, b, k, ev)) handle(ev); };
      $('au_' + k).onclick = () => { st.autoSkill[k] = !st.autoSkill[k]; toast(`${HM.SKILLS[k].name} 자동 ${st.autoSkill[k] ? '켬' : '끔'}`); };
    }
  }

  // ── 아래 칸 (강화·카드·던전·설정)
  let curTab = 'up';
  document.querySelectorAll('#tabs button').forEach(btn => btn.onclick = () => {
    curTab = btn.dataset.tab;
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === btn));
    renderTab();
  });

  function statText(key, s) {
    if (key === 'atk') return fmt(s.atk);
    if (key === 'hp') return fmt(s.maxHp);
    return s.spd.toFixed(2) + '회/초';
  }
  function renderTab() {
    const box = $('tabBody');
    if (curTab === 'up') {
      box.innerHTML = `<div class="mult">${[1, 10, 'max'].map(m => `<button data-m="${m}" class="${m === mult ? 'on' : ''}">${m === 'max' ? '최대' : '×' + m}</button>`).join('')}</div>` +
        Object.keys(HM.UPS).map(k => `<div class="row"><div class="ic">${HM.UPS[k].emoji}</div>
          <div class="info"><b>${HM.UPS[k].name} <span id="ul_${k}"></span></b><small id="uv_${k}"></small></div>
          <button class="buy" id="ub_${k}"></button></div>`).join('') +
        `<div class="statLine" id="statLine"></div>
         <div class="note" style="padding:6px">꾹 누르고 있으면 계속 올라가요</div>`;
      box.querySelectorAll('.mult button').forEach(el => el.onclick = () => {
        mult = el.dataset.m === 'max' ? 'max' : +el.dataset.m; renderTab();
      });
      for (const k in HM.UPS) holdBuy($('ub_' + k), k);
      updateTab();
    } else if (curTab === 'cards') {
      const ids = Object.keys(st.cards);
      const combos = HM.CARDS.filter(c => c.combo).map(c => {
        const n = HM.tagCount(st, c.combo.tag);
        return `<div class="combo">${c.emoji} <b>${c.name}</b> — ${c.combo.tag} 카드 ${Math.min(n, c.combo.need)}/${c.combo.need} ${st.cards[c.id] ? '✔ 완성' : n >= c.combo.need ? '→ 다음 카드에 나와요' : ''}</div>`;
      }).join('');
      box.innerHTML = combos + (ids.length ? `<div class="cardGrid">${ids.map(id => {
        const c = HM.CARD[id];
        return `<div class="mini ${HM.RAR[c.rar].cls}"><div class="n">×${st.cards[id]}</div><div class="e">${c.emoji}</div><b>${c.name}</b><br><small style="color:var(--dim)">${c.desc}</small></div>`;
      }).join('')}</div>` : '<div class="note">아직 카드가 없어요.<br>레벨이 오르면 카드 3장 중 1장을 골라요.</div>');
    } else if (curTab === 'dungeon') {
      box.innerHTML = `<div class="note">🔒 던전은 3판에서 열려요<br><br>🥋 비무대회 · ☯️ 오행 수련장<br>👹 마두 토벌 · 🗼 심마의 탑</div>`;
    } else {
      const r = st.rec;
      box.innerHTML = `
        <div class="row"><div class="ic">📊</div><div class="info"><b>내 기록</b>
          <small>최고 ${st.maxFloor}층 · 잡은 몬스터 ${fmt(r.kills)} · 고른 카드 ${r.cardsPicked}장 · 논 시간 ${Math.floor(r.playSec / 60)}분</small></div></div>
        <div class="row"><div class="ic">📤</div><div class="info"><b>백업 코드 내보내기</b><small>복사해서 메모장·카톡에 붙여 두세요</small></div><button class="buy" id="exp">만들기</button></div>
        <div id="expBox"></div>
        <div class="row"><div class="ic">📥</div><div class="info"><b>백업 코드 불러오기</b><small>지금 진행은 지워지고 코드 상태로 바뀌어요</small></div><button class="buy" id="imp">붙여넣기</button></div>
        <div id="impBox"></div>
        <div class="row"><div class="ic">🗑</div><div class="info"><b>처음부터 다시</b><small>모든 진행이 지워져요</small></div><button class="buy" id="reset" style="background:#5a2a2a;color:#fff">지우기</button></div>
        <div class="note">혈마 키우기 ${HM.VERSION} · 1판</div>`;
      $('exp').onclick = () => {
        save();
        const code = HM.exportCode(st);
        $('expBox').innerHTML = `<textarea readonly id="expTxt">${code}</textarea><button class="big gold" id="copy">📋 복사하기</button>`;
        $('copy').onclick = () => {
          const ta = $('expTxt');
          (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject())
            .then(() => toast('복사했어요'))
            .catch(() => { ta.select(); document.execCommand('copy'); toast('복사했어요'); });
        };
      };
      $('imp').onclick = () => {
        $('impBox').innerHTML = `<textarea id="impTxt" placeholder="HM1. 로 시작하는 코드를 붙여넣으세요"></textarea><button class="big" id="impGo">불러오기</button>`;
        $('impGo').onclick = () => {
          try {
            const ns = HM.importCode($('impTxt').value);
            if (!confirm(`${ns.maxFloor}층 · Lv.${ns.level} 상태로 바꿀까요?\n지금 진행은 지워져요.`)) return;
            st = ns; replaced = true; st.lastSave = Date.now();
            localStorage.setItem(SAVE_KEY, JSON.stringify(st));
            location.reload();
          } catch (e) { toast('❌ ' + e.message, 2500); }
        };
      };
      $('reset').onclick = () => {
        if (!confirm('정말 처음부터 할까요? 모든 진행이 지워져요.')) return;
        if (!confirm('한 번 더 물을게요. 정말 지울까요?')) return;
        replaced = true;
        localStorage.removeItem(SAVE_KEY);
        location.reload();
      };
    }
  }
  let replaced = false; // 불러오기·지우기 중엔 저장 안 함

  // 강화 단추: 한 번 누르면 한 번, 꾹 누르면 계속
  function holdBuy(btn, key) {
    let t1, t2;
    const once = () => {
      if (HM.buyUp(st, key, mult)) { HM.refresh(st, b); updateTab(); return true; }
      return false;
    };
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      once();
      t1 = setTimeout(() => { t2 = setInterval(() => { if (!once()) stop(); }, 90); }, 400);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(n => btn.addEventListener(n, stop));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  }
  function updateTab() {
    if (curTab !== 'up') return;
    const s = b.s;
    for (const k in HM.UPS) {
      const u = HM.UPS[k];
      const lv = st.up[k];
      const r = HM.upCost(st, k, mult === 'max' ? 'max' : mult);
      const n = r.count || 1;
      const next = Object.assign({}, st, { up: Object.assign({}, st.up, { [k]: Math.min(u.max, lv + n) }) });
      $('ul_' + k).textContent = 'Lv.' + lv + (lv >= u.max ? ' (최대)' : '');
      $('uv_' + k).textContent = lv >= u.max ? statText(k, s) : `${statText(k, s)} → ${statText(k, HM.calc(next))}`;
      const cost = r.count ? r.cost : HM.upCost(st, k, 1).cost;
      const btn = $('ub_' + k);
      btn.textContent = lv >= u.max ? '최대' : `🪙 ${fmt(cost)}${r.count > 1 ? ' ×' + r.count : ''}`;
      btn.disabled = lv >= u.max || !r.count || cost > st.silver;
    }
    $('statLine').innerHTML = [
      s.crit ? `치명 ${Math.round(s.crit * 100)}%` : '', s.dbl ? `두 번 공격 ${Math.round(s.dbl * 100)}%` : '',
      s.regen ? `회복 ${(s.regen * 100).toFixed(0)}%/초` : '', s.drain ? `<span style="color:#ff6b6b">깎임 ${(s.drain * 100).toFixed(0)}%/초</span>` : '',
      s.bleed ? `출혈 ${Math.round(s.bleed * s.bleedMul * 100)}%/초` : '', s.steal ? `흡혈 ${Math.round(s.steal * 100)}%` : '',
      s.taken < 1 ? `받는 피해 -${Math.round((1 - s.taken) * 100)}%` : '',
      s.silverMul > 1 ? `은자 +${Math.round((s.silverMul - 1) * 100)}%` : '', s.expMul > 1 ? `경험치 +${Math.round((s.expMul - 1) * 100)}%` : ''
    ].filter(Boolean).join('<span>·</span>');
  }

  // ── 무대 그리기
  function fxText(txt, cls, side) {
    const fx = $('fx');
    if (fx.childElementCount > 24) fx.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'dmg ' + cls;
    d.textContent = txt;
    const stage = $('stage').getBoundingClientRect();
    const unit = $(side === 'hero' ? 'hero' : 'mob').getBoundingClientRect();
    d.style.left = (unit.left - stage.left + 20 + Math.random() * 40) + 'px';
    d.style.top = (unit.top - stage.top - 10 + Math.random() * 20) + 'px';
    fx.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }
  function flash(el, cls, ms) { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms || 90); }

  function drawMob() {
    const mob = $('mob');
    if (!b.mon) { mob.classList.add('gone'); return; }
    mob.classList.remove('gone');
    mob.classList.toggle('boss', b.mon.boss);
    $('mobBody').textContent = b.mon.emoji;
    $('mobName').textContent = b.mon.name + (b.mon.boss ? ' 👑' : '');
    mob.classList.remove('enter'); void mob.offsetWidth; mob.classList.add('enter');
  }

  function handle(ev) {
    for (const e of ev) {
      if (e.t === 'hit') {
        fxText(fmt(e.d), e.kind === 's1' ? 's1' : e.crit ? 'crit' : '', 'mob');
        flash($('mob'), 'hit'); flash($('hero'), 'lunge');
        if (e.kind === 's1') {
          const s = document.createElement('div'); s.className = 'slash'; s.textContent = '🩸';
          s.style.right = '14%'; s.style.bottom = '22%'; $('fx').appendChild(s); setTimeout(() => s.remove(), 400);
        }
      } else if (e.t === 'hurt') {
        fxText('-' + fmt(e.d), 'hurt', 'hero'); flash($('hero'), 'hurtFlash', 150);
      } else if (e.t === 'block') {
        fxText('막음', 'gain', 'hero');
      } else if (e.t === 'spawn') {
        drawMob();
      } else if (e.t === 'kill') {
        fxText('+🪙' + fmt(e.silver), 'gain', 'mob');
        drawMob();
        if (e.boss) toast(`👑 ${e.f}층 보스를 쓰러뜨렸어요!`);
      } else if (e.t === 'lvl') {
        toast(`⬆️ 레벨 업! Lv.${st.level}`);
      } else if (e.t === 'boss') {
        const t = HM.TALK[e.f];
        if (t && !st.talked[e.f + 'b']) { st.talked[e.f + 'b'] = 1; talkModal(t.before, false); }
      } else if (e.t === 'bossDown') {
        const t = HM.TALK[e.f];
        if (t && !st.talked[e.f + 'a']) { st.talked[e.f + 'a'] = 1; talkModal(t.after, true); }
      } else if (e.t === 'fail') {
        drawMob();
        toast(e.why === 'time' ? '⏰ 보스를 못 잡았어요… 한 층 아래에서 수련' : '💫 쓰러졌어요… 한 층 아래에서 수련', 2200);
      } else if (e.t === 'skill') {
        if (e.key === 's2') flash($('hero'), 'inv', 3000);
      }
    }
  }

  let lastHud = 0;
  function hud() {
    const s = b.s;
    $('tCycle').textContent = `혈마 · ${st.cycle}회차`;
    const boss = HM.isBoss(st.floor);
    $('tFloor').textContent = `${boss ? '👹' : HM.stageOf(st.floor).emoji} ${st.floor}층${boss ? ' 보스' : ''}`;
    $('tSilver').textContent = '🪙 ' + fmt(st.silver);
    $('stageName').textContent = HM.stageOf(st.floor).name + ` · 최고 ${st.maxFloor}층`;
    $('lvTxt').textContent = 'Lv.' + st.level;
    $('expFill').style.width = Math.min(100, st.exp / HM.needExp(st.level) * 100) + '%';
    $('heroHp').style.width = Math.max(0, b.hp / s.maxHp * 100) + '%';
    $('mobHp').style.width = b.mon ? Math.max(0, b.mon.hp / b.mon.maxHp * 100) + '%' : '0%';
    const bb = $('bossBar');
    bb.hidden = !(b.mon && b.mon.boss);
    if (!bb.hidden) { $('bossTxt').textContent = `보스 ${Math.ceil(b.bossT)}초`; $('bossFill').style.width = (b.bossT / HM.B.bossTime * 100) + '%'; }
    const dots = $('floorDots');
    if (dots.childElementCount !== HM.B.killsPerFloor) dots.innerHTML = '<i></i>'.repeat(HM.B.killsPerFloor);
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i < st.kills));
    dots.hidden = boss;
    $('btnChallenge').hidden = st.autoUp;
    for (const k in HM.SKILLS) {
      const left = b.cd[k], full = HM.SKILLS[k].cd;
      $('cd_' + k).style.background = left > 0 ? `conic-gradient(#000a ${left / full * 360}deg, transparent 0)` : 'none';
      $('ct_' + k).textContent = left > 0 ? Math.ceil(left) : '';
      $('sb_' + k).classList.toggle('ready', left <= 0);
      $('au_' + k).classList.toggle('on', !!st.autoSkill[k]);
    }
    updateTab();
  }

  $('btnChallenge').onclick = () => { HM.challenge(st, b); drawMob(); toast(`⏫ ${st.floor}층 다시 도전!`); };

  // ── 돌아가는 고리
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25; // 잠깐 멈췄던 건 무시 (긴 쉼은 방치 보상으로)
    const ev = [];
    while (dt > 0) { const d = Math.min(0.05, dt); HM.step(st, b, d, ev); dt -= d; }
    if (ev.length) handle(ev);
    if (!modalOpen) openNext();
    if (now - lastHud > 100) { hud(); lastHud = now; }
    requestAnimationFrame(loop);
  }

  // 화면을 껐다 켜면: 1분 넘게 비웠으면 방치 보상 창, 짧으면 조용히 더해 줌
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); if (!replaced) save(); return; }
    if (!hiddenAt) return;
    const sec = (Date.now() - hiddenAt) / 1000; hiddenAt = 0;
    if (sec >= 60) { offlineModal(sec); }
    else if (sec > 1) {
      const r = HM.offline(st, sec);
      st.silver += r.silver; if (HM.addExp(st, r.exp)) HM.refresh(st, b);
    }
    last = performance.now();
  });
  window.addEventListener('pagehide', () => { if (!replaced) save(); });
  setInterval(() => { if (!replaced) save(); }, 5000);

  // ── 시작
  buildSkills();
  renderTab();
  showModal(titleModal);
  if (!firstTime && awaySec >= 60) offlineModal(awaySec);
  requestAnimationFrame(loop);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  HM._dbg = { get st() { return st; }, b, save }; // 시험용
})(HM);
