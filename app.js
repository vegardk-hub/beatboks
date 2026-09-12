/* Beatboks — brettet, opptaksflyten og lagringen.

   Bumpes for hånd ved hver endring som pushes, sammen med CACHE i sw.js.
   Vises nederst i appen, så det er lett å se om nettbrettet faktisk har hentet
   siste versjon. */
var VERSJON = 'v2';
var NOKKEL = 'beatboks-v1';
var MAKS_STEMMER = 8;
var EKSPORT_TAKTER = 8;

var S = null;
var ui = { skjerm: 'start', opptak: 'klar', nyLyd: null, nyId: null, stellId: null, ark: null };

/* ---------- små hjelpere ---------- */

function E(id) { return document.getElementById(id); }

function tekst(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

var toastTid = null;
function toast(melding) {
  var t = E('toast');
  t.textContent = melding;
  t.classList.add('vis');
  clearTimeout(toastTid);
  toastTid = setTimeout(function () { t.classList.remove('vis'); }, 2600);
}

/* ---------- tilstand ---------- */

function tomTilstand() {
  /* Ved aller første oppstart står bare grunnbeaten på. Ni monstre som spiller
     samtidig er en vegg av lyd, ikke en invitasjon til å leke — og da mister
     barnet følelsen av at det er de som bygger opp låten. */
  var fraStart = { dunder: 1, klapp: 1, tikk: 1 };
  var av = {};
  Motor.BEATS.forEach(function (b) { if (!fraStart[b.id]) av[b.id] = true; });
  return {
    v: 1,
    bpm: 92,
    hodetelefoner: false,
    av: av,            // id -> true for innebygde beats som står av
    stemmer: [],
    sanger: [],
    teller: 0
  };
}

function les() {
  try {
    var r = JSON.parse(localStorage.getItem(NOKKEL));
    if (r && r.v === 1) return r;
  } catch (e) {}
  return tomTilstand();
}

function skriv() {
  /* Bare det som ikke kan regnes ut på nytt lagres. Lydbufrene ligger i
     IndexedDB, og signalkjedene bygges opp igjen ved oppstart. */
  S.stemmer.forEach(function (st) {
    var p = finnPlass(st.id);
    if (p) { st.paa = p.paa; st.effekt = p.effekt; st.rytme = p.rytme; }
  });
  S.av = {};
  Motor.plasser.forEach(function (p) {
    if (p.kind === 'trommer' && !p.paa) S.av[p.id] = true;
  });
  S.bpm = Motor.bpm;
  try { localStorage.setItem(NOKKEL, JSON.stringify(S)); } catch (e) {}
}

function finnPlass(id) {
  var p = Motor.plasser;
  for (var i = 0; i < p.length; i++) if (p[i].id === id) return p[i];
  return null;
}

/* Brettet bygges av to kilder: de innebygde beatene, som alltid finnes, og
   barnas egne opptak, som hentes fra lageret. */
function byggBrett() {
  /* Brettet bygges om hver gang en lyd kommer til eller forsvinner. De andre
     lydene skal ikke måtte hentes fra lageret på nytt av den grunn — uten
     dette blir de utilgjengelige i noen hundre millisekunder hver gang. */
  var gamle = {};
  Motor.plasser.forEach(function (p) { if (p.buffer) gamle[p.id] = p.buffer; });

  var plasser = Motor.BEATS.map(function (def, i) {
    return {
      id: def.id, kind: 'trommer', def: def, navn: def.navn, emoji: def.emoji,
      hue: def.hue, paa: !S.av[def.id],
      pan: (i % 3 - 1) * 0.18, volum: 1, rigg: null, sistSpilt: 0
    };
  });
  S.stemmer.forEach(function (st) {
    plasser.push({
      id: st.id, kind: 'stemme', navn: st.navn, hue: st.hue,
      paa: !!st.paa, effekt: st.effekt || 'ren', rytme: st.rytme || 'slag',
      pan: st.pan || 0, volum: 1, buffer: gamle[st.id] || null, lydId: st.id,
      rigg: null, sistSpilt: 0
    });
  });
  Motor.plasser = plasser;
}

function lastLyder() {
  var jobber = S.stemmer.map(function (st) {
    return Lager.hent(st.id).then(function (blob) {
      if (!blob) return null;
      return Lager.tilBuffer(blob).then(function (buf) {
        var p = finnPlass(st.id);
        if (p) p.buffer = buf;
      });
    }).catch(function () { return null; });
  });
  return Promise.all(jobber);
}

/* ---------- tegning ---------- */

function svgFor(p) {
  return Monstre.tegn(p.id + (p.kind === 'trommer' ? '' : ':' + p.hue), p.hue);
}

function kortHtml(p) {
  var e = p.kind === 'stemme' ? Motor.effekt(p.effekt) : null;
  var r = p.kind === 'stemme' ? Motor.rytme(p.rytme) : null;
  return '<div class="kort' + (p.paa ? ' paa' : '') + '" data-h="veksle" data-id="' +
    p.id + '" role="button" tabindex="0" style="--hue:' + p.hue + '">' +
    '<div class="figur">' + svgFor(p) + '</div>' +
    '<div class="navn">' + tekst(p.navn) + '</div>' +
    (p.kind === 'stemme'
      ? '<div class="merke" data-h="stell" data-id="' + p.id + '">' + e.emoji + r.emoji + '</div>'
      : '') +
    '<div class="lys"></div></div>';
}

function tegnBrett() {
  var stemmer = Motor.plasser.filter(function (p) { return p.kind === 'stemme'; });
  var beats = Motor.plasser.filter(function (p) { return p.kind === 'trommer'; });

  var h = '<div class="topp">' +
    '<div class="merkeord">BEAT<span>BOKS</span></div>' +
    '<div class="tempo">' +
    '<button class="rund" data-h="tempo" data-d="-4">−</button>' +
    '<div class="tall"><b>' + Motor.bpm + '</b><span>TEMPO</span></div>' +
    '<button class="rund" data-h="tempo" data-d="4">+</button>' +
    '</div>' +
    '<button class="spill' + (Motor.spiller ? ' gaar' : '') + '" data-h="transport">' +
    (Motor.spiller ? '◼' : '▶') + '</button>' +
    '<button class="rund stor" data-h="sanger">💾</button>' +
    '</div>';

  h += '<div class="seksjon"><h2>BEATS</h2><div class="rutenett">' +
    beats.map(kortHtml).join('') + '</div></div>';

  h += '<div class="seksjon"><h2>DINE LYDER</h2><div class="rutenett">' +
    stemmer.map(kortHtml).join('');
  if (stemmer.length < MAKS_STEMMER) {
    h += '<div class="kort nytt" data-h="tilOpptak" role="button" tabindex="0">' +
      '<div class="mikro">🎤</div><div class="navn">TA OPP</div></div>';
  }
  h += '</div></div>';

  h += '<div class="steglys">';
  for (var i = 0; i < Motor.STEG; i++) {
    h += '<i class="' + (i % 4 === 0 ? 'slag' : '') + '"></i>';
  }
  h += '</div><div class="versjon">' + VERSJON + '</div>';

  E('app').innerHTML = h;
  finnElementer();
}

/* ---------- opptaksskjermen ---------- */

function tegnOpptak() {
  var h = '<div class="opptak">';
  h += '<button class="tilbake" data-h="tilBrett">✕</button>';

  if (ui.opptak === 'nekta') {
    h += '<div class="beskjed"><div class="stortEmoji">🎤</div>' +
      '<h1>Mikrofonen er ikke slått på</h1>' +
      '<p>Appen trenger å høre stemmen din. Si ja til mikrofon i nettleseren, ' +
      'og prøv igjen.</p>' +
      '<button class="hoved" data-h="prov">PRØV IGJEN</button></div>';
  } else if (ui.opptak === 'klar') {
    h += '<div class="beskjed">' +
      '<h1>LAG EN LYD</h1>' +
      '<p>Si <b>BDUM</b>, <b>TSS</b> eller <b>PA-TSJ</b> rett inn i nettbrettet.</p>' +
      '<button class="rekord" data-h="startOpptak"><span>🎤</span>TRYKK OG LAG LYD</button>' +
      '<label class="bryter"><input type="checkbox" data-h="hodetelefoner"' +
      (S.hodetelefoner ? ' checked' : '') + '><span>🎧 Jeg har hodetelefoner — behold beatet</span></label>' +
      '</div>';
  } else if (ui.opptak === 'teller') {
    h += '<div class="nedtelling"><div class="tall" id="nedtall">3</div>' +
      '<p>GJØR DEG KLAR</p></div>';
  } else if (ui.opptak === 'tar') {
    h += '<canvas id="ring"></canvas>' +
      '<div class="midtIRing"><div class="stortEmoji">🎤</div></div>' +
      '<div class="tidslinje"><i id="tidsfyll"></i></div>' +
      '<button class="hoved stopp" data-h="stoppOpptak">FERDIG</button>';
  } else if (ui.opptak === 'lytt') {
    var p = ui.nyLyd;
    h += '<div class="lytt">' +
      '<div class="nyttMonster" style="--hue:' + p.hue + '">' + Monstre.tegn(p.id + ':' + p.hue, p.hue) + '</div>' +
      '<div class="effektvalg">' +
      Motor.EFFEKTER.map(function (e) {
        return '<button class="eff' + (p.effekt === e.id ? ' valgt' : '') +
          '" data-h="velgEffekt" data-e="' + e.id + '" style="--hue:' + e.hue + '">' +
          '<span>' + e.emoji + '</span>' + e.navn + '</button>';
      }).join('') +
      '</div>' +
      '<div class="knapperad">' +
      '<button class="sekundaer" data-h="omigjen">↺ PRØV IGJEN</button>' +
      '<button class="hoved" data-h="lagreLyd">LEGG TIL ✓</button>' +
      '</div></div>';
  }

  h += '</div>';
  E('app').innerHTML = h;

  if (ui.opptak === 'tar') {
    stoppRing = Visuell.opptaksring(E('ring'), function () { return Opptak.analyse; });
  }
}

/* ---------- sanger og eksport ---------- */

function tegnSanger() {
  var h = '<div class="side"><button class="tilbake" data-h="tilBrett">✕</button>' +
    '<h1>SANGENE DINE</h1>' +
    '<div class="knapperad bred">' +
    '<button class="hoved" data-h="lagreSang">💾 LAGRE DENNE</button>' +
    '<button class="sekundaer" data-h="lagFil">🎵 LAG LYDFIL</button>' +
    '</div>';
  if (!S.sanger.length) {
    h += '<p class="tomt">Ingen lagrede sanger ennå. Skru på monstrene du liker, ' +
      'og trykk «Lagre denne».</p>';
  } else {
    h += '<div class="sangliste">' + S.sanger.map(function (sa) {
      return '<div class="sang"><button class="sangnavn" data-h="hentSang" data-id="' + sa.id + '">' +
        '<b>' + tekst(sa.navn) + '</b><span>' + sa.bpm + ' tempo · ' +
        sa.oppsett.filter(function (x) { return x.paa; }).length + ' monstre</span></button>' +
        '<button class="slett" data-h="slettSang" data-id="' + sa.id + '">🗑</button></div>';
    }).join('') + '</div>';
  }
  h += '</div>';
  E('app').innerHTML = h;
}

/* ---------- arket for én stemme ---------- */

function tegnArk() {
  var el = E('ark');
  if (!ui.stellId) { el.innerHTML = ''; el.classList.remove('vis'); return; }
  var p = finnPlass(ui.stellId);
  if (!p) { ui.stellId = null; el.innerHTML = ''; el.classList.remove('vis'); return; }

  var h = '<div class="arkbakgrunn" data-h="lukkArk"></div><div class="arkinnhold" style="--hue:' + p.hue + '">' +
    '<div class="arktopp">' +
    '<div class="arkfigur">' + svgFor(p) + '</div>' +
    '<input class="navnefelt" data-h="navn" value="' + tekst(p.navn) + '" maxlength="10">' +
    '</div>' +
    '<h3>STEMME</h3><div class="valgrad">' +
    Motor.EFFEKTER.map(function (e) {
      return '<button class="eff' + (p.effekt === e.id ? ' valgt' : '') +
        '" data-h="settEffekt" data-e="' + e.id + '" style="--hue:' + e.hue + '">' +
        '<span>' + e.emoji + '</span>' + e.navn + '</button>';
    }).join('') + '</div>' +
    '<h3>RYTME</h3><div class="valgrad">' +
    Motor.RYTMER.map(function (r) {
      return '<button class="eff' + (p.rytme === r.id ? ' valgt' : '') +
        '" data-h="settRytme" data-r="' + r.id + '"><span>' + r.emoji + '</span>' + r.navn + '</button>';
    }).join('') + '</div>' +
    '<div class="knapperad">' +
    '<button class="sekundaer fare" data-h="slettLyd">🗑 SLETT LYDEN</button>' +
    '<button class="hoved" data-h="lukkArk">FERDIG</button>' +
    '</div></div>';
  el.innerHTML = h;
  el.classList.add('vis');
}

/* ---------- skjermbytte ---------- */

var stoppRing = null;

function vis(skjerm) {
  if (stoppRing) { stoppRing(); stoppRing = null; }
  ui.skjerm = skjerm;
  if (skjerm === 'brett') tegnBrett();
  else if (skjerm === 'opptak') tegnOpptak();
  else if (skjerm === 'sanger') tegnSanger();
  else tegnStart();
}

function tegnStart() {
  E('app').innerHTML = '<div class="startskjerm">' +
    '<div class="merkeord stor">BEAT<span>BOKS</span></div>' +
    '<p>Lag beat med din egen stemme</p>' +
    '<button class="rekord" data-h="begynn"><span>▶</span>START</button>' +
    '<div class="versjon">' + VERSJON + '</div></div>';
}

/* ---------- hendelser ---------- */

function veksle(id, stille) {
  var p = finnPlass(id);
  if (!p) return;
  if (p.kind === 'stemme' && !p.buffer) { toast('Lyden er ikke lastet ennå'); return; }
  p.paa = !p.paa;
  Motor.sikreKjeder();
  if (stille) {
    var e0 = kortEl[id];
    if (e0) e0.classList.toggle('paa', p.paa);
    skriv();
    return;
  }
  /* Når noe skrus på skal det høres med en gang, ellers tror barnet at
     trykket ikke virket. Men en tromme som smeller utenom takten mens beatet
     går, høres ut som en feil — så trommene får bare denne kvitteringen når
     alt står stille. En stemme er en enkeltlyd og tåler det når som helst. */
  if (p.paa && (p.kind === 'stemme' || !Motor.spiller)) Motor.smak(p);
  var el = kortEl[id];
  if (el) el.classList.toggle('paa', p.paa);
  else tegnBrett();
  skriv();
}

function tempo(d) {
  Motor.settBpm(Motor.bpm + d);
  var t = document.querySelector('.tempo .tall b');
  if (t) t.textContent = Motor.bpm;
  skriv();
}

function transport() {
  if (Motor.spiller) Motor.stopp(); else Motor.spill();
  tegnBrett();
}

/* --- opptak --- */

var opptaksklokke = null, nedtellingsklokke = null;

/* Alt som er i gang med et opptak stoppes på ett sted. Uten dette fortsetter
   nedtellingen å tikke etter at barnet har trykket ✕, og drar dem tilbake til
   opptaksskjermen et par sekunder senere. */
function avbrytOpptak() {
  clearInterval(opptaksklokke); opptaksklokke = null;
  clearInterval(nedtellingsklokke); nedtellingsklokke = null;
  if (Opptak.aktiv) Opptak.avslutt();
  Opptak.slipp();
  Motor.demp(false);
}

function tilOpptak() {
  ui.opptak = 'klar';
  vis('opptak');
  Opptak.aapne().catch(function () {
    ui.opptak = 'nekta';
    tegnOpptak();
  });
}

function startOpptak() {
  Opptak.aapne().then(function () {
    if (!S.hodetelefoner) Motor.demp(true);
    ui.opptak = 'teller';
    tegnOpptak();
    var slagtid = 60 / Motor.bpm * 1000;
    var n = 3;
    var el = E('nedtall');
    nedtellingsklokke = setInterval(function () {
      if (ui.skjerm !== 'opptak' || ui.opptak !== 'teller') {
        clearInterval(nedtellingsklokke);
        nedtellingsklokke = null;
        return;
      }
      n--;
      if (n > 0) {
        if (el) { el.textContent = n; el.classList.remove('slag'); void el.offsetWidth; el.classList.add('slag'); }
      } else {
        clearInterval(nedtellingsklokke);
        nedtellingsklokke = null;
        gjorOpptak();
      }
    }, slagtid);
  }).catch(function () {
    ui.opptak = 'nekta';
    tegnOpptak();
  });
}

function gjorOpptak() {
  ui.opptak = 'tar';
  tegnOpptak();
  Opptak.begynn();
  var start = performance.now();
  opptaksklokke = setInterval(function () {
    var gaatt = (performance.now() - start) / 1000;
    var f = E('tidsfyll');
    if (f) f.style.width = Math.min(100, gaatt / Opptak.MAKS_SEK * 100) + '%';
    if (gaatt >= Opptak.MAKS_SEK) stoppOpptak();
  }, 60);
}

function stoppOpptak() {
  if (ui.opptak !== 'tar') return;
  clearInterval(opptaksklokke);
  opptaksklokke = null;
  var buf = Opptak.avslutt();
  Opptak.slipp();
  Motor.demp(false);
  if (!buf) {
    ui.opptak = 'klar';
    tegnOpptak();
    toast('Vi hørte ingenting — prøv å komme litt nærmere');
    return;
  }
  S.teller++;
  var langt = buf.duration > (60 / Motor.bpm * 4) * 1.05;
  ui.nyLyd = {
    id: 'lyd' + Date.now().toString(36),
    navn: 'LYD ' + S.teller,
    hue: Monstre.nyHue(S.teller),
    effekt: 'ren',
    /* Et langt opptak er en frase og skal gå én gang per runde; et kort er et
       slag og skal gjenta seg. Å gjette riktig her sparer barnet for et valg
       de ikke vet at finnes. */
    rytme: langt ? 'hel' : 'slag',
    buffer: buf
  };
  ui.opptak = 'lytt';
  tegnOpptak();
  Motor.prov(buf, 'ren');
}

function velgEffekt(id) {
  ui.nyLyd.effekt = id;
  tegnOpptak();
  Motor.prov(ui.nyLyd.buffer, id);
}

function lagreLyd() {
  var ny = ui.nyLyd;
  var blob = Motor.wav(ny.buffer);
  Lager.lagre(ny.id, blob).catch(function () { toast('Fikk ikke lagret lyden'); });
  S.stemmer.push({
    id: ny.id, navn: ny.navn, hue: ny.hue, effekt: ny.effekt,
    rytme: ny.rytme, paa: true, pan: (S.teller % 3 - 1) * 0.22
  });
  byggBrett();
  var p = finnPlass(ny.id);
  p.buffer = ny.buffer;
  Motor.sikreKjeder();
  if (!Motor.spiller) Motor.spill();
  skriv();
  ui.nyLyd = null;
  vis('brett');
  toast(ny.navn + ' er med i bandet!');
}

/* --- stell av én stemme --- */

function settEffekt(id) {
  var p = finnPlass(ui.stellId);
  if (!p) return;
  p.effekt = id;
  Motor.plassEndret(p);
  Motor.smak(p);
  tegnArk();
  skriv();
}

function settRytme(id) {
  var p = finnPlass(ui.stellId);
  if (!p) return;
  p.rytme = id;
  tegnArk();
  skriv();
}

function slettLyd() {
  var id = ui.stellId;
  var p = finnPlass(id);
  if (!p) return;
  S.stemmer = S.stemmer.filter(function (st) { return st.id !== id; });
  Lager.slett(id).catch(function () {});
  ui.stellId = null;
  byggBrett();
  lastLyder();
  Motor.sikreKjeder();
  skriv();
  tegnArk();
  vis('brett');
  toast(p.navn + ' er borte');
}

/* --- sanger --- */

function lagreSang() {
  var sang = {
    id: 's' + Date.now().toString(36),
    navn: 'SANG ' + (S.sanger.length + 1),
    bpm: Motor.bpm,
    oppsett: Motor.plasser.map(function (p) {
      return { id: p.id, paa: p.paa, effekt: p.effekt, rytme: p.rytme };
    })
  };
  S.sanger.unshift(sang);
  skriv();
  tegnSanger();
  toast(sang.navn + ' er lagret');
}

function hentSang(id) {
  var sang = null;
  S.sanger.forEach(function (s) { if (s.id === id) sang = s; });
  if (!sang) return;
  Motor.settBpm(sang.bpm);
  /* En sang kan peke på en lyd som siden er slettet. Da hopper vi bare over
     den i stedet for å nekte å åpne sangen. */
  Motor.plasser.forEach(function (p) { p.paa = false; });
  sang.oppsett.forEach(function (o) {
    var p = finnPlass(o.id);
    if (!p) return;
    p.paa = o.paa;
    if (o.effekt && p.kind === 'stemme') { p.effekt = o.effekt; p.rytme = o.rytme; Motor.plassEndret(p); }
  });
  Motor.sikreKjeder();
  if (!Motor.spiller) Motor.spill();
  skriv();
  vis('brett');
  toast(sang.navn);
}

function slettSang(id) {
  S.sanger = S.sanger.filter(function (s) { return s.id !== id; });
  skriv();
  tegnSanger();
}

function lagFil() {
  var paa = Motor.plasser.filter(function (p) { return p.paa; });
  if (!paa.length) { toast('Skru på noen monstre først'); return; }
  toast('Lager lydfil …');
  Motor.eksporter(EKSPORT_TAKTER).then(function (blob) {
    /* Delingen må starte fra et nytt trykk. iOS godtar ikke navigator.share
       etter at vi har ventet på rendringen, så barnet får en egen knapp. */
    var url = URL.createObjectURL(blob);
    E('ark').innerHTML = '<div class="arkbakgrunn" data-h="lukkArk"></div>' +
      '<div class="arkinnhold"><h3>SANGEN ER KLAR</h3>' +
      '<audio class="spiller" controls src="' + url + '"></audio>' +
      '<div class="knapperad">' +
      '<button class="hoved" data-h="delFil">📤 DEL ELLER LAGRE</button>' +
      '<button class="sekundaer" data-h="lukkArk">LUKK</button>' +
      '</div></div>';
    E('ark').classList.add('vis');
    E('ark').dataset.url = url;
    ferdigFil = blob;
  }).catch(function () {
    toast('Klarte ikke å lage lydfila');
  });
}

var ferdigFil = null;

function delFil() {
  if (!ferdigFil) return;
  var navn = 'beatboks-' + new Date().toISOString().slice(0, 10) + '.wav';
  var fil = null;
  try { fil = new File([ferdigFil], navn, { type: 'audio/wav' }); } catch (e) {}
  if (fil && navigator.canShare && navigator.canShare({ files: [fil] })) {
    navigator.share({ files: [fil], title: 'Beatboks' }).catch(function () {});
    return;
  }
  var a = document.createElement('a');
  a.href = E('ark').dataset.url;
  a.download = navn;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- hendelsesruting ---------- */

var handlinger = {
  begynn: function () {
    Motor.start();
    byggBrett();
    Motor.sikreKjeder();
    Motor.spill();
    vis('brett');
    lastLyder().then(function () { Motor.sikreKjeder(); tegnBrett(); });
  },
  tempo: function (el) { tempo(parseInt(el.dataset.d, 10)); },
  transport: transport,
  sanger: function () { vis('sanger'); },
  tilBrett: function () {
    avbrytOpptak();
    ui.nyLyd = null;
    vis('brett');
  },
  tilOpptak: tilOpptak,
  prov: function () { ui.opptak = 'klar'; tilOpptak(); },
  startOpptak: startOpptak,
  stoppOpptak: stoppOpptak,
  omigjen: function () { ui.nyLyd = null; ui.opptak = 'klar'; tilOpptak(); },
  velgEffekt: function (el) { velgEffekt(el.dataset.e); },
  lagreLyd: lagreLyd,
  hodetelefoner: function (el) { S.hodetelefoner = el.checked; skriv(); },
  stell: function (el) { ui.stellId = el.dataset.id; tegnArk(); },
  settEffekt: function (el) { settEffekt(el.dataset.e); },
  settRytme: function (el) { settRytme(el.dataset.r); },
  slettLyd: slettLyd,
  lukkArk: function () {
    ui.stellId = null;
    var u = E('ark').dataset.url;
    if (u) { URL.revokeObjectURL(u); E('ark').dataset.url = ''; ferdigFil = null; }
    E('ark').innerHTML = '';
    E('ark').classList.remove('vis');
    if (ui.skjerm === 'brett') tegnBrett();
  },
  navn: function (el) {
    var p = finnPlass(ui.stellId);
    if (!p) return;
    p.navn = (el.value || 'LYD').toUpperCase().slice(0, 10);
    S.stemmer.forEach(function (st) { if (st.id === p.id) st.navn = p.navn; });
    skriv();
  },
  lagreSang: lagreSang,
  hentSang: function (el) { hentSang(el.dataset.id); },
  slettSang: function (el) { slettSang(el.dataset.id); },
  lagFil: lagFil,
  delFil: delFil
};

function kjor(navn, el) {
  var f = handlinger[navn];
  if (f) f(el);
}

/* Monsterkortene svarer på pointerdown, ikke på click. Et musikkinstrument som
   venter til fingeren slipper føles ødelagt.

   Men brettet kan rulle når det er mange lyder, og da starter rullingen ofte
   oppå et kort. Derfor angres vekslingen hvis fingeren beveger seg — da var
   det en rulling, ikke et trykk. Vi hindrer ikke rullingen selv
   (preventDefault her ville låst siden på nettbrett). */
var trykk = null;

document.addEventListener('pointerdown', function (e) {
  var el = e.target.closest ? e.target.closest('[data-h]') : null;
  if (!el || el.dataset.h !== 'veksle') return;
  trykk = { id: el.dataset.id, x: e.clientX, y: e.clientY, angret: false };
  veksle(trykk.id);
});

document.addEventListener('pointermove', function (e) {
  if (!trykk || trykk.angret) return;
  if (Math.abs(e.clientX - trykk.x) < 14 && Math.abs(e.clientY - trykk.y) < 14) return;
  trykk.angret = true;
  veksle(trykk.id, true);      // angrer uten å gi lyd — det var en rulling
}, { passive: true });

document.addEventListener('pointerup', function () { trykk = null; });
document.addEventListener('pointercancel', function () { trykk = null; });

document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('[data-h]') : null;
  if (!el) return;
  var h = el.dataset.h;
  if (h === 'veksle' || h === 'navn' || h === 'hodetelefoner') return;
  e.preventDefault();
  kjor(h, el);
});

document.addEventListener('change', function (e) {
  var el = e.target.closest ? e.target.closest('[data-h]') : null;
  if (!el) return;
  if (el.dataset.h === 'hodetelefoner' || el.dataset.h === 'navn') kjor(el.dataset.h, el);
});

document.addEventListener('input', function (e) {
  var el = e.target.closest ? e.target.closest('[data-h="navn"]') : null;
  if (el) kjor('navn', el);
});

/* ---------- animasjon av brettet ---------- */

var kortEl = {}, munnEl = {}, oyeEl = {}, lysEl = [];
var blunk = {};

function finnElementer() {
  kortEl = {}; munnEl = {}; oyeEl = {}; lysEl = [];
  var kort = document.querySelectorAll('.kort[data-id]');
  for (var i = 0; i < kort.length; i++) {
    var id = kort[i].dataset.id;
    kortEl[id] = kort[i];
    munnEl[id] = kort[i].querySelector('.munn');
    oyeEl[id] = kort[i].querySelectorAll('.oye');
  }
  var lys = document.querySelectorAll('.steglys i');
  for (var j = 0; j < lys.length; j++) lysEl.push(lys[j]);
}

var sisteLys = -1;

/* Blunking. Hvert monster blunker i sin egen takt, og vi rører DOM-en bare i
   det øyeblikket øyet faktisk skifter tilstand — ikke 60 ganger i sekundet.
   Det er den ene detaljen som skiller «tegning» fra «skapning». */
function blunkeAnimasjon(id, naaMs) {
  var oy = oyeEl[id];
  if (!oy || !oy.length) return;
  var b = blunk[id];
  if (!b) {
    b = blunk[id] = { neste: naaMs + 800 + Math.random() * 5000, til: 0, lukket: false };
  }
  if (naaMs > b.neste) {
    b.til = naaMs + 110;
    b.neste = naaMs + 2500 + Math.random() * 6000;
  }
  var lukket = naaMs < b.til;
  if (lukket === b.lukket) return;
  b.lukket = lukket;
  for (var j = 0; j < oy.length; j++) {
    oy[j].style.transform = lukket ? 'scaleY(0.08)' : '';
  }
}

Visuell.leggTil(function (dt, naaMs) {
  if (ui.skjerm !== 'brett' || !Motor.ctx) return;
  var naa = Motor.ctx.currentTime;
  var plasser = Motor.plasser;
  for (var i = 0; i < plasser.length; i++) {
    var p = plasser[i];
    var el = kortEl[p.id];
    if (!el) continue;
    var n = p.paa && p.rigg ? Visuell.niva(p.rigg.analyse) : 0;
    var d = naa - (p.sistSpilt || 0);
    var sprett = d >= 0 && d < 0.35 ? 1 - d / 0.35 : 0;
    el.style.setProperty('--niva', n.toFixed(3));
    el.style.setProperty('--sprett', sprett.toFixed(3));
    var m = munnEl[p.id];
    if (m) m.style.transform = 'scaleY(' + (0.3 + n * 2.6).toFixed(2) + ')';
    blunkeAnimasjon(p.id, naaMs);
  }
  var s = Visuell.takt.steg;
  if (s !== sisteLys && lysEl.length) {
    if (sisteLys >= 0 && lysEl[sisteLys]) lysEl[sisteLys].classList.remove('naa');
    if (lysEl[s]) lysEl[s].classList.add('naa');
    sisteLys = s;
  }
});

/* ---------- oppstart ---------- */

function oppstart() {
  S = les();
  byggBrett();
  Motor.settBpm(S.bpm || 92);
  Visuell.bakgrunn(E('bg'));
  vis('start');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  }
}

/* Når nettbrettet legges bort skal ikke lyden fortsette i lomma — og et opptak
   som var i gang skal ikke ligge og samle på det som skjer i rommet etterpå. */
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) return;
  if (ui.skjerm === 'opptak') {
    avbrytOpptak();
    ui.opptak = 'klar';
    ui.nyLyd = null;
    vis('brett');
  }
  if (Motor.spiller) {
    Motor.stopp();
    if (ui.skjerm === 'brett') tegnBrett();
  }
});

oppstart();
