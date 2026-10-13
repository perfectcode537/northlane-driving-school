/* Northlane: page motion. */
(function () {
  gsap.registerPlugin(ScrollTrigger);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  document.body.classList.add('is-loading');

  /* ---------------- smooth scrolling ---------------- */
  let lenis = null;
  if (!reduce) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); const el = id === '#top' ? document.body : $(id);
    if (!el) return; e.preventDefault();
    lenis ? lenis.scrollTo(el, { offset: 0, duration: 1.6 }) : el.scrollIntoView({ behavior: 'smooth' });
  }));

  /* ---------------- videos: play only while on screen ---------------- */
  const vio = new IntersectionObserver(entries => entries.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; if (!v.dataset.hold) v.play().catch(() => {}); }
    else v.pause();
  }), { rootMargin: '200px 0px' });
  $$('video').forEach(v => { if (!v.classList.contains('hero__clip')) vio.observe(v); });

  /* ---------------- hero title: words rise out of a blur ---------------- */
  const title = $('.hero__title');
  (function split(node) {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const s = document.createElement('span'); s.className = 'word'; s.textContent = part; frag.appendChild(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') split(n);
    });
  })(title);
  gsap.set('.hero__title .word', { yPercent: 70, opacity: 0, filter: 'blur(14px)' });
  gsap.set(['.hero__eyebrow', '.hero__lede', '.hero__btns', '.hero__strip', '.nav', '.hero__meta'], { opacity: 0, y: 20 });
  gsap.set('.tpill', { width: 0 });
  gsap.set('.badge', { scale: 0, rotation: -120 });

  /* ---------------- intro: a film leader counts 3-2-1, then the gate opens ---------------- */
  const loadNum = $('#loadNum'), leaderNum = $('#leaderNum');
  const counter = { v: 0 }, sweep = { a: 0 };
  const firstClip = $('.hero__clip');
  const ready = Promise.race([
    Promise.all([document.fonts.ready, new Promise(r => firstClip.readyState >= 3 ? r() : firstClip.addEventListener('canplay', r, { once: true }))]),
    new Promise(r => setTimeout(r, 3500))
  ]);
  gsap.to(counter, { v: 92, duration: 2.1, ease: 'power2.out', onUpdate: () => { loadNum.textContent = Math.round(counter.v); } });
  const leaderTl = gsap.timeline();
  [3, 2, 1].forEach(n => leaderTl
    .call(() => { leaderNum.textContent = n; })
    .fromTo(sweep, { a: 0 }, { a: 360, duration: .7, ease: 'none', onUpdate: () => $('.leader__sweep').style.setProperty('--a', sweep.a + 'deg') })
    .fromTo(leaderNum, { scale: 1.15, opacity: .4 }, { scale: 1, opacity: 1, duration: .25 }, '<'));
  Promise.all([ready, new Promise(r => leaderTl.eventCallback('onComplete', r))]).then(() => {
    gsap.timeline()
      .to(counter, { v: 100, duration: .3, onUpdate: () => { loadNum.textContent = Math.round(counter.v); } })
      .to(['.leader', '.loader__count'], { opacity: 0, scale: .9, duration: .35, ease: 'power2.in' }, '<')
      .fromTo('.loader__title', { opacity: 0, letterSpacing: '.2em', filter: 'blur(12px)' }, { opacity: 1, letterSpacing: '-.04em', filter: 'blur(0px)', duration: .9, ease: 'expo.out' })
      .to('.loader__title', { opacity: 0, filter: 'blur(10px)', duration: .45, ease: 'power2.in' }, '+=.35')
      .to('.loader__bar--t', { yPercent: -100, duration: 1.2, ease: 'expo.inOut' })
      .to('.loader__bar--b', { yPercent: 100, duration: 1.2, ease: 'expo.inOut' }, '<')
      .add(() => { $('.loader').remove(); document.body.classList.remove('is-loading'); lenis && lenis.start(); ScrollTrigger.refresh(); })
      .from('.hero__clip.is-on', { scale: 1.45, duration: 2.2, ease: 'expo.out' }, '<-.9')
      .to('.hero__title .word', { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out', stagger: .055 }, '<.25')
      .to('.tpill', { width: '1.7em', duration: 1.2, ease: 'expo.inOut' }, '<.5')
      .to(['.nav', '.hero__meta', '.hero__eyebrow', '.hero__lede', '.hero__btns', '.hero__strip'], { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: .08 }, '<.2')
      .fromTo('.hud', { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'expo.out' }, '<')
      .to('.badge', { scale: 1, rotation: 0, duration: 1.4, ease: 'expo.out' }, '<.3')
      .add(startHeroCycle, '<');
  });

  /* ---------------- camera HUD: running timecode at 24 fps ---------------- */
  const tc = $('#tc'), t0 = performance.now();
  const pad2 = n => String(n).padStart(2, '0');
  gsap.ticker.add(() => {
    const f = Math.floor((performance.now() - t0) / (1000 / 24));
    tc.textContent = `${pad2(Math.floor(f / 86400))}:${pad2(Math.floor(f / 1440) % 60)}:${pad2(Math.floor(f / 24) % 60)}:${pad2(f % 24)}`;
  });

  /* ---------------- hero: five clips with a wipe ---------------- */
  const clips = $$('.hero__clip'), stepsLi = $$('.hero__steps li'), heroIdx = $('#heroIdx');
  let cur = 0;
  function startHeroCycle() {
    clips.forEach((c, i) => { if (i) c.preload = 'auto'; });
    const next = () => {
      gsap.fromTo('.hero__bar span', { scaleX: 0 }, { scaleX: 1, duration: 5, ease: 'none', onComplete: () => {
        const prev = clips[cur]; cur = (cur + 1) % clips.length; const nc = clips[cur];
        nc.currentTime = 0; nc.play().catch(() => {});
        nc.style.zIndex = 2; prev.style.zIndex = 1;
        gsap.fromTo(nc, { clipPath: 'inset(0 0 0 100%)', scale: 1.3 }, { clipPath: 'inset(0 0 0 0%)', scale: 1.12, duration: 1.4, ease: 'expo.inOut', onComplete: () => { prev.pause(); prev.classList.remove('is-on'); } });
        nc.classList.add('is-on');
        stepsLi.forEach((li, i) => li.classList.toggle('is-on', i === cur));
        heroIdx.textContent = String(cur + 1).padStart(2, '0');
        next();
      } });
    };
    next();
  }
  // hand-held drift + push-in as you scroll away
  if (!reduce) {
    gsap.to('.hero__media', { yPercent: 18, scale: 1.12, rotateX: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hud', { opacity: 0, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.hero', start: '20% top', end: '70% top', scrub: true } });
    if (fine) {
      const hx = gsap.quickTo('.hero__clips-cam', 'x', { duration: 1.4, ease: 'power3.out' }), hy = gsap.quickTo('.hero__clips-cam', 'y', { duration: 1.4, ease: 'power3.out' });
      addEventListener('pointermove', e => { hx((e.clientX / innerWidth - .5) * -26); hy((e.clientY / innerHeight - .5) * -18); });
    }
    gsap.to('.hero__inner', { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__media', { x: 8, y: -6, rotation: .25, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  /* ---------------- cursor + magnetic buttons ---------------- */
  if (fine) {
    const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
    const pos = { x: innerWidth / 2, y: innerHeight / 2 }, rp = { ...pos };
    addEventListener('pointermove', e => { pos.x = e.clientX; pos.y = e.clientY; gsap.set(dot, { x: pos.x, y: pos.y }); });
    gsap.ticker.add(() => { rp.x += (pos.x - rp.x) * .18; rp.y += (pos.y - rp.y) * .18; gsap.set(ring, { x: rp.x, y: rp.y }); });
    $$('a, button, summary, [data-tilt]').forEach(el => {
      el.addEventListener('pointerenter', () => cur.classList.add('is-link'));
      el.addEventListener('pointerleave', () => cur.classList.remove('is-link'));
    });
    $$('[data-cursor]').forEach(el => {
      el.addEventListener('pointerenter', () => { label.textContent = el.dataset.cursor; cur.classList.add('is-label'); });
      el.addEventListener('pointerleave', () => cur.classList.remove('is-label'));
    });
    $$('[data-magnetic]').forEach(el => {
      const inner = el.querySelector('span') || el;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        gsap.to(el, { x: x * .3, y: y * .4, duration: .5, ease: 'power3.out' });
        gsap.to(inner, { x: x * .12, y: y * .15, duration: .5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => { gsap.to([el, inner], { x: 0, y: 0, duration: .9, ease: 'elastic.out(1, .35)' }); });
    });
  }

  /* ---------------- nav + progress ---------------- */
  const nav = $('#nav'); let lastY = 0;
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: self => {
    const y = self.scroll();
    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > innerHeight * .8);
    lastY = y;
    gsap.set('.progress span', { scaleX: self.progress });
  } });

  /* ---------------- ticker: faster and skewed with scroll speed ---------------- */
  const track = $('.ticker__track');
  let tx = 0, boost = 0, skew = 0;
  gsap.ticker.add((t, dt) => {
    const vel = lenis ? lenis.velocity : 0;
    boost += (Math.abs(vel) * 0.6 - boost) * .1;
    skew += (gsap.utils.clamp(-12, 12, vel * -0.5) - skew) * .1;
    tx -= (0.6 + boost) * (dt / 16);
    const half = track.scrollWidth / 2;
    if (-tx >= half) tx += half;
    gsap.set(track, { x: tx, skewX: reduce ? 0 : skew });
  });

  /* ---------------- gallery: two reels drift opposite ways, faster with scroll ---------------- */
  const reels = $$('.reel__track').map((el, i) => ({ el, x: i ? -el.scrollWidth / 4 : 0, dir: i ? 1 : -1, hover: false }));
  reels.forEach(r => {
    r.el.parentElement.addEventListener('pointerenter', () => { r.hover = true; });
    r.el.parentElement.addEventListener('pointerleave', () => { r.hover = false; });
  });
  let reelBoost = 0;
  gsap.ticker.add((t, dt) => {
    reelBoost += ((lenis ? Math.abs(lenis.velocity) : 0) * .5 - reelBoost) * .08;
    reels.forEach(r => {
      const half = r.el.scrollWidth / 2;
      r.x += r.dir * ((r.hover ? .15 : .7) + reelBoost) * (dt / 16);
      if (r.x <= -half) r.x += half;
      if (r.x > 0) r.x -= half;
      gsap.set(r.el, { x: r.x });
    });
  });

  /* ---------------- statement: words light up, little clips open ---------------- */
  const words = $$('.statement__text .w');
  const pills = $$('.statement .pill');
  ScrollTrigger.create({
    trigger: '.statement__text', start: 'top 80%', end: 'bottom 45%', scrub: true,
    onUpdate: self => {
      const n = Math.round(self.progress * words.length);
      words.forEach((w, i) => w.classList.toggle('is-lit', i < n));
    }
  });
  pills.forEach(p => gsap.to(p, { width: '2.2em', ease: 'power2.out', scrollTrigger: { trigger: p, start: 'top 85%', end: 'top 55%', scrub: true } }));
  gsap.to('.statement__stroke path', { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.statement__text', start: 'bottom 75%', end: 'bottom 40%', scrub: true } });

  /* ---------------- how a lesson works: pinned, sideways ---------------- */
  const lessonTrack = $('.lesson__track');
  const lessonDist = () => Math.max(0, lessonTrack.scrollWidth - innerWidth);
  gsap.to(lessonTrack, {
    x: () => -lessonDist(), ease: 'none',
    scrollTrigger: { trigger: '.lesson', start: 'top top', end: () => '+=' + (lessonDist() + innerHeight * .4), pin: '.lesson__pin', scrub: 1, invalidateOnRefresh: true,
      onUpdate: s => gsap.set('.lesson__meter span', { scaleX: s.progress }) }
  });
  $$('.step__media video').forEach(v => gsap.fromTo(v, { scale: 1.3 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: '.lesson', start: 'top top', end: () => '+=' + (lessonDist() + innerHeight * .4), scrub: true } }));

  /* ---------------- the 3D town ---------------- */
  const caps = $$('.town__cap'), speedNum = $('#speedNum');
  let town = null;
  try {
    town = new Town($('#townCanvas'), { onSpeed: (v, p) => {
      speedNum.textContent = v;
      // captions follow where the car is on the route, not even slices of the scroll
      const i = [0.12, 0.27, 0.45, 0.8].filter(b => p >= b).length;
      caps.forEach((c, k) => c.classList.toggle('is-on', k === i));
    } });
  } catch (err) { console.warn('3D town unavailable', err); }
  ScrollTrigger.create({
    trigger: '.town', start: 'top top', end: '+=' + innerHeight * 4, pin: '.town__pin', scrub: true,
    onUpdate: s => town && town.setProgress(s.progress)
  });
  if (town) new IntersectionObserver(([e]) => { town.visible = e.isIntersecting; }).observe($('.town'));

  /* ---------------- features: cards open up, clips play on hover ---------------- */
  $$('.feat').forEach(card => {
    gsap.to(card, { clipPath: 'inset(0% 0% 0% 0% round 24px)', ease: 'power2.out', scrollTrigger: { trigger: card, start: 'top 95%', end: 'top 55%', scrub: true } });
    const v = card.querySelector('video');
    if (fine) {
      v.dataset.hold = '1';
      card.addEventListener('pointerenter', () => v.play().catch(() => {}));
      card.addEventListener('pointerleave', () => v.pause());
    }
  });

  /* ---------------- section numbers: (01), (02)... ---------------- */
  let secNo = 0;
  $$('main > section').forEach(sec => {
    const e = sec.querySelector('.eyebrow');
    if (!e || sec.classList.contains('hero')) return;
    e.insertAdjacentHTML('afterbegin', `<span class="idx">(${String(++secNo).padStart(2, '0')})</span>`);
  });

  /* ---------------- nav: a yellow pill marks the section you are in ---------------- */
  const navLinks = $$('.nav__links a'), navInk = $('.nav__ink');
  const setNav = a => {
    navLinks.forEach(l => l.classList.toggle('is-on', l === a));
    if (!a) { navInk.classList.remove('is-on'); return; }
    navInk.classList.add('is-on');
    navInk.style.width = a.offsetWidth + 'px';
    navInk.style.transform = `translateX(${a.offsetLeft}px)`;
  };
  navLinks.forEach(a => {
    const sec = $(a.getAttribute('href')); if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: st => { if (st.isActive) setNav(a); else if (navLinks.every(l => l === a || !l.classList.contains('is-on'))) setNav(null); } });
  });

  /* ---------------- courses: the clip follows the cursor ---------------- */
  const courseFloat = $('.courses__float'), courseVid = courseFloat.querySelector('video');
  if (fine) {
    const fp = { x: 0, y: 0 }, fc = { x: 0, y: 0 };
    let tilt = 0;
    addEventListener('pointermove', e => { fp.x = e.clientX; fp.y = e.clientY; });
    gsap.ticker.add(() => {
      const dx = fp.x - fc.x;
      fc.x += dx * .14; fc.y += (fp.y - fc.y) * .14;
      tilt += (gsap.utils.clamp(-14, 14, dx * .08) - tilt) * .12;
      gsap.set(courseFloat, { x: fc.x - 150, y: fc.y - 112, rotation: tilt });
    });
    $$('.course').forEach(row => {
      row.addEventListener('pointerenter', () => {
        if (!courseVid.src.endsWith(row.dataset.video)) { courseVid.src = row.dataset.video; }
        courseVid.play().catch(() => {});
        courseFloat.classList.add('is-on');
      });
      row.addEventListener('pointerleave', () => courseFloat.classList.remove('is-on'));
    });
  }
  gsap.fromTo('.course', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: .07, clearProps: 'opacity,transform', scrollTrigger: { trigger: '.courses__list', start: 'top 80%', once: true } });

  /* ---------------- chapter cards: letters flip up in 3D, the clip pushes in ---------------- */
  $$('.chapter').forEach(ch => {
    const title = ch.querySelector('.chapter__title');
    title.innerHTML = [...title.textContent].map(c => c === ' ' ? ' ' : `<span class="ch">${c}</span>`).join('');
    const tl = gsap.timeline({ scrollTrigger: { trigger: ch, start: 'top top', end: '+=' + innerHeight * 1.6, pin: ch.querySelector('.chapter__pin'), scrub: 1 } });
    tl.fromTo(ch.querySelector('.chapter__media video'), { scale: 1.45, filter: 'brightness(.2) saturate(.4) blur(6px)' }, { scale: 1.05, filter: 'brightness(.45) saturate(.75) blur(0px)', duration: 1, ease: 'none' }, 0)
      .fromTo(ch.querySelectorAll('.ch'), { rotateX: -100, yPercent: 40, opacity: 0 }, { rotateX: 0, yPercent: 0, opacity: 1, duration: .45, stagger: .03, ease: 'power3.out' }, .05)
      .fromTo(ch.querySelector('.chapter__no'), { opacity: 0, letterSpacing: '1em' }, { opacity: 1, letterSpacing: '.4em', duration: .35 }, 0)
      .fromTo(ch.querySelector('.chapter__sub'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .3 }, .4)
      .fromTo(ch.querySelector('.chapter__leak'), { opacity: 0, xPercent: -30 }, { opacity: .9, xPercent: 20, duration: .5, ease: 'sine.inOut' }, .2)
      .to(ch.querySelector('.chapter__leak'), { opacity: 0, xPercent: 40, duration: .3 }, .7)
      .to(ch.querySelectorAll('.ch'), { rotateX: 90, yPercent: -30, opacity: 0, duration: .3, stagger: .015, ease: 'power2.in' }, .8)
      .to([ch.querySelector('.chapter__no'), ch.querySelector('.chapter__sub')], { opacity: 0, y: -20, duration: .2 }, .85);
  });

  /* ---------------- cinema bars in the 3D scenes and chapter cards ---------------- */
  const cinemaOn = new Set();
  $$('.chapter, .town, .garage').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 1%', end: 'bottom 99%', refreshPriority: -1, onToggle: st => {
    st.isActive ? cinemaOn.add(el) : cinemaOn.delete(el);
    document.body.classList.toggle('is-cinema', cinemaOn.size > 0);
  } }));

  /* ---------------- the 3D car: turns as you scroll, drag to spin ---------------- */
  let showroom = null;
  try {
    const spots = [['sign', [-0.45, 2.0, 0], [0, 1, 0], .04, .96], ['brake', [0.55, 0.8, 0.92], [0, 0, 1], .1, .96], ['cam', [2.16, 0.62, 0], [1, 0, 0], .15, 1], ['box', [-0.5, 0.75, -0.92], [0, 0, -1], .2, 1]]
      .map(([k, l, n, from, to]) => ({ el: $(`.hs[data-hs="${k}"]`), local: new THREE.Vector3(...l), normal: new THREE.Vector3(...n), from, to }));
    showroom = new Showroom($('#carCanvas'), { hotspots: spots });
    new IntersectionObserver(([e]) => { showroom.visible = e.isIntersecting; }).observe($('.garage'));
  } catch (err) { console.warn('3D car unavailable', err); }
  ScrollTrigger.create({ trigger: '.garage', start: 'top top', end: '+=' + innerHeight * 2.4, pin: '.garage__pin', scrub: true, onUpdate: s => showroom && showroom.setProgress(s.progress) });
  gsap.from('.garage__head > *', { y: 60, opacity: 0, stagger: .1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.garage', start: 'top 60%', once: true } });

  /* ---------------- end credits roll up the screen ---------------- */
  const roll = $('.credits__roll');
  gsap.to(roll, { y: () => -(roll.offsetHeight + innerHeight * .5), ease: 'none',
    scrollTrigger: { trigger: '.credits', start: 'top top', end: () => '+=' + (roll.offsetHeight + innerHeight * .2), pin: '.credits__pin', scrub: 1, invalidateOnRefresh: true } });

  /* ---------------- film motion: media leans with scroll speed ---------------- */
  if (!reduce && lenis) {
    const leaners = $$('.bento, .tutors__grid, .students__rail, .reel, .packages__grid');
    let lean = 0;
    gsap.ticker.add(() => {
      lean += (gsap.utils.clamp(-5, 5, lenis.velocity * -0.12) - lean) * .1;
      leaners.forEach(el => { el.style.transform = `skewY(${lean * .5}deg)`; });
    });
  }

  /* ---------------- reveals ---------------- */
  $$('.section-head, .stat, .pack, .quote, .faq details, .closing__inner > *, .app__copy > *, .book__copy > *, .booker, .tile, .foot__cols > div').forEach(el => el.setAttribute('data-rv', ''));
  ScrollTrigger.batch('[data-rv]', { start: 'top 88%', once: true,
    onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .08 }) });

  /* ---------------- counters ---------------- */
  $$('[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0, o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => {
      el.textContent = dec ? o.v.toFixed(dec) : Math.round(o.v).toLocaleString('en-US');
    } }) });
  });

  /* ---------------- packages: cards tilt toward the pointer ---------------- */
  if (fine && !reduce) $$('[data-tilt]').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      gsap.to(card, { rotateY: (x - .5) * 14, rotateX: (.5 - y) * 12, duration: .6, ease: 'power3.out', transformPerspective: 1000 });
      card.style.setProperty('--gx', x * 100 + '%'); card.style.setProperty('--gy', y * 100 + '%');
    });
    card.addEventListener('pointerleave', () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1, .4)' }));
  });

  /* ---------------- students: drag the rail ---------------- */
  const rail = $('#rail');
  let down = false, sx = 0, sl = 0, vx = 0, lastX = 0;
  rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; sx = lastX = e.clientX; sl = rail.scrollLeft; vx = 0; rail.classList.add('is-drag'); });
  addEventListener('pointermove', e => { if (!down) return; rail.scrollLeft = sl - (e.clientX - sx); vx = e.clientX - lastX; lastX = e.clientX; });
  addEventListener('pointerup', () => { if (!down) return; down = false; rail.classList.remove('is-drag'); gsap.to(rail, { scrollLeft: rail.scrollLeft - vx * 14, duration: 1, ease: 'power3.out' }); });
  gsap.from('.quote', { x: 160, ease: 'none', stagger: .05, scrollTrigger: { trigger: '.students', start: 'top bottom', end: 'top 30%', scrub: true } });

  /* ---------------- closing band: the road moves slower than the page ---------------- */
  if (!reduce) $$('.cf').forEach(el => gsap.fromTo(el, { yPercent: +el.dataset.speed * 3 }, { yPercent: -el.dataset.speed * 3, ease: 'none', scrollTrigger: { trigger: '.closing', start: 'top bottom', end: 'bottom top', scrub: true } }));
  gsap.from('.tutor', { y: 120, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '.tutors__grid', start: 'top 85%', once: true } });
  if (!reduce) {
    gsap.fromTo('.closing__media', { yPercent: -12 }, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.closing', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.foot__big', { yPercent: 40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  /* ---------------- the app: the phone swings in, tilts, and switches roles ---------------- */
  const app = $('.app'), phone = $('#phone');
  ScrollTrigger.create({ trigger: app, start: 'top 60%', once: true, onEnter: () => app.classList.add('is-in') });
  if (!reduce) {
    gsap.fromTo(phone, { rotateX: 28, rotateY: -22, y: 120 }, { rotateX: 0, rotateY: 0, y: 0, ease: 'none', scrollTrigger: { trigger: app, start: 'top bottom', end: 'center center', scrub: true } });
    gsap.fromTo('.app__float--a', { y: 140 }, { y: -60, ease: 'none', scrollTrigger: { trigger: app, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.app__float--b', { y: -40 }, { y: 120, ease: 'none', scrollTrigger: { trigger: app, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  if (fine && !reduce) {
    const stage = $('.app__stage');
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      gsap.to('.phone__screen', { rotateY: x * 16, rotateX: -y * 12, duration: .8, ease: 'power3.out', transformPerspective: 1200 });
    });
    stage.addEventListener('pointerleave', () => gsap.to('.phone__screen', { rotateX: 0, rotateY: 0, duration: 1.2, ease: 'elastic.out(1, .4)' }));
  }
  const tabs = $$('.app__tabs button'), ink = $('.app__tabs-ink');
  const moveInk = btn => { ink.style.width = btn.offsetWidth + 'px'; ink.style.transform = `translateX(${btn.offsetLeft}px)`; };
  const pickRole = btn => {
    tabs.forEach(b => b.classList.toggle('is-on', b === btn));
    $$('.screen').forEach(s => s.classList.toggle('is-on', s.dataset.screen === btn.dataset.role));
    moveInk(btn);
  };
  tabs.forEach(b => b.addEventListener('click', () => { pickRole(b); clearInterval(roleTimer); }));
  document.fonts.ready.then(() => moveInk(tabs[0]));
  addEventListener('resize', () => moveInk($('.app__tabs .is-on')));
  // roles cycle on their own until someone picks one
  let roleIdx = 0;
  const roleTimer = setInterval(() => { if (!app.classList.contains('is-in')) return; roleIdx = (roleIdx + 1) % tabs.length; pickRole(tabs[roleIdx]); }, 4200);

  /* ---------------- booking ---------------- */
  const booker = $('#booker'), days = $('#days'), sum = $('#sum');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  for (let i = 1; i <= 10; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (i === 2 ? ' is-on' : '');
    b.dataset.v = `${dayNames[d.getDay()]} ${d.getDate()}`;
    b.innerHTML = `<small>${dayNames[d.getDay()]}</small><b>${d.getDate()}</b>`;
    days.appendChild(b);
  }
  const pick = g => $(`[data-group="${g}"] .is-on`, booker)?.dataset.v || '';
  const updateSum = () => {
    sum.innerHTML = `<b>${pick('pack')}</b> · ${pick('day')} · ${pick('time')}`;
    gsap.fromTo(sum, { opacity: .3, y: 6 }, { opacity: 1, y: 0, duration: .5, ease: 'power3.out' });
  };
  $$('.chips', booker).forEach(group => group.addEventListener('click', e => {
    const chip = e.target.closest('.chip'); if (!chip) return;
    $$('.chip', group).forEach(c => c.classList.toggle('is-on', c === chip));
    updateSum();
  }));
  // the package cards preselect the matching package here
  $$('.pack .btn').forEach(btn => btn.addEventListener('click', () => {
    const name = btn.closest('.pack').querySelector('.pack__name').textContent.trim();
    $$('[data-group="pack"] .chip', booker).forEach(c => c.classList.toggle('is-on', c.dataset.v === name));
    updateSum();
  }));
  updateSum();
  booker.addEventListener('submit', e => {
    e.preventDefault();
    const bad = $$('input', booker).filter(i => !i.value.trim() || (i.type === 'tel' && i.value.replace(/\D/g, '').length < 6));
    $$('input', booker).forEach(i => i.classList.toggle('is-bad', bad.includes(i)));
    if (bad.length) { bad[0].focus(); return; }
    const first = booker.name.value.trim().split(/\s+/)[0];
    $('#doneText').textContent = `Thanks ${first}. ${pick('pack')} · ${pick('day')} at ${pick('time')}. We'll text you to confirm.`;
    booker.classList.add('is-done');
  });
  $$('input', booker).forEach(i => i.addEventListener('input', () => i.classList.remove('is-bad')));
  $('#again').addEventListener('click', () => { booker.classList.remove('is-done'); booker.reset(); });

  // pinned scenes were created out of page order (chapters last), so sort them by position before measuring
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  addEventListener('load', () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
})();
