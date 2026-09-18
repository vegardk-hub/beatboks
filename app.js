/* Beatboks — brettet, opptaksflyten og lagringen.

   Bumpes for hånd ved hver endring som pushes, sammen med CACHE i sw.js.
   Vises nederst i appen, så det er lett å se om nettbrettet faktisk har hentet
   siste versjon. */
var VERSJON = 'v11';
var NOKKEL = 'beatboks-v1';
var MAKS_STEMMER = 200;
var VIS_FORST = 23;             // med TA OPP blir det fire hele rader på et nettbrett
var EKSPORT_TAKTER = 8;

var S = null;
var ui = {
  skjerm: 'start', opptak: 'klar', nyLyd: null, nyId: null, stellId: null, ark: null,
  aktivSang: null, visAlleLyder: false, nyVerden: false
};

/* Merket «denne sangen spiller nå» skal være ærlig. Så fort barnet skrur på et
   monster eller vrir på tempoet, er det ikke lenger den lagrede sangen som
   går, og da skal merket vekk. */
function brettEndret() {
  if (ui.aktivSang === null) return;
  ui.aktivSang = null;
  var el = document.querySelector('.sangkort.aktiv');
  if (el) el.classList.remove('aktiv');
}

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
  return {
    v: 1,
    bpm: 92,
    grunnbeat: 'boombap',
    hodetelefoner: false,
    /* id -> på/av for monstrene i beatene. Et monster som ikke står her har
       aldri vært rørt, og står på bare hvis beaten sier det skal det fra
       start. Slik husker hver verden sitt eget oppsett når barnet bytter. */
    trommer: {},
    stemmer: [],
    sanger: [],
    teller: 0
  };
}

function les() {
  try {
    var r = JSON.parse(localStorage.getItem(NOKKEL));
    if (r && r.v === 1) return oppgrader(r);
  } catch (e) {}
  return tomTilstand();
}

/* Tilstand fra før beatene ble egne verdener. Den gang ble bare de avslåtte
   monstrene husket, og alt annet sto på — det oversettes her, så brettet ser
   likt ut som sist. Disko, trap, rock, reggae og barnas egen beat finnes ikke
   lenger; sanger som brukte dem åpnes i BOOM BAP, med de samme monstrene de
   ble laget med. */
function oppgrader(r) {
  if (!r.trommer) {
    r.trommer = {};
    Motor.finnGrunnbeat('boombap').lyder.forEach(function (l) {
      r.trommer[l.id] = !(r.av && r.av[l.id]);
    });
  }
  delete r.av;
  delete r.egenBeat;
  r.grunnbeat = Motor.finnGrunnbeat(r.grunnbeat).id;
  (r.sanger || []).forEach(function (sa) { sa.grunnbeat = Motor.finnGrunnbeat(sa.grunnbeat).id; });
  return r;
}

function skriv() {
  /* Bare det som ikke kan regnes ut på nytt lagres. Lydbufrene ligger i
     IndexedDB, og signalkjedene bygges opp igjen ved oppstart. */
  S.stemmer.forEach(function (st) {
    var p = finnPlass(st.id);
    if (p) { st.paa = p.paa; st.effekt = p.effekt; st.rytme = p.rytme; }
  });
  Motor.plasser.forEach(function (p) {
    if (p.kind === 'trommer') S.trommer[p.id] = p.paa;
  });
  S.bpm = Motor.bpm;
  S.grunnbeat = Motor.grunnbeat.id;
  try { localStorage.setItem(NOKKEL, JSON.stringify(S)); } catch (e) {}
}

function finnPlass(id) {
  var p = Motor.plasser;
  for (var i = 0; i < p.length; i++) if (p[i].id === id) return p[i];
  return null;
}

/* Brettet bygges av to kilder: monstrene i beaten som er valgt, og barnas
   egne opptak, som hentes fra lageret. Egne lyder følger med fra verden til
   verden — det er barnets band, beaten er bare scenen de står på. */
function byggBrett() {
  /* Brettet bygges om hver gang en lyd kommer til eller forsvinner. De andre
     lydene skal ikke måtte hentes fra lageret på nytt av den grunn — uten
     dette blir de utilgjengelige i noen hundre millisekunder hver gang. */
  var gamle = {};
  Motor.plasser.forEach(function (p) { if (p.buffer) gamle[p.id] = p.buffer; });

  var plasser = Motor.grunnbeat.lyder.map(function (def, i) {
    var husket = S.trommer[def.id];
    return {
      id: def.id, kind: 'trommer', def: def, navn: def.navn,
      hue: def.hue, paa: husket == null ? !!def.start : husket,
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

/* Lydene hentes fra lageret når de trengs, ikke alle ved oppstart.

   Med 200 opptak ville det tatt flere sekunder å dekode alt før appen kunne
   brukes, og holdt titalls megabyte i minnet for lyder som står av og ingen
   hører. Et kort opptak dekodes på noen millisekunder i det øyeblikket barnet
   skrur det på — det merkes ikke. Hvert opptak hentes bare én gang, også om
   det bes om flere ganger mens det holder på. */
var underveis = {};

function lastLyd(p) {
  if (!p || p.kind !== 'stemme') return Promise.resolve(null);
  if (p.buffer) return Promise.resolve(p.buffer);
  if (underveis[p.id]) return underveis[p.id];
  var id = p.id;
  underveis[id] = Lager.hent(id).then(function (blob) {
    if (!blob) return null;
    return Lager.tilBuffer(blob);
  }).then(function (buf) {
    // plassen kan ha blitt bygd på nytt mens vi ventet, så den slås opp igjen
    var plass = finnPlass(id);
    if (plass && buf) plass.buffer = buf;
    delete underveis[id];
    return buf;
  }).catch(function () { delete underveis[id]; return null; });
  return underveis[id];
}

// bare de som står på — det er dem som skal høres med en gang
function lastLyder() {
  return Promise.all(Motor.plasser.filter(function (p) {
    return p.kind === 'stemme' && p.paa;
  }).map(lastLyd));
}

/* ---------- tegning ---------- */

/* Et monster tegnes bare én gang. Samme nøkkel gir alltid samme figur, og med
   200 lyder ville brettet ellers tegnet alle på nytt ved hvert eneste bytte. */
var svgLager = {};
function svgFor(p) {
  var k = p.id + (p.kind === 'trommer' ? '' : ':' + p.hue);
  if (!svgLager[k]) {
    svgLager[k] = Monstre.tegn(k, p.hue, p.kind === 'trommer' ? { tema: p.def.tema } : null);
  }
  return svgLager[k];
}

/* Taktlysene går gjennom hele neonskalaen appen ellers bruker: magenta på
   ett-slaget, via fiolett og cyan, til limegrønt på slutten av takten. Da ser
   barna hvor i takten de er på fargen alene, ikke bare på hvilken prikk som
   lyser — og linjen blir en del av uttrykket i stedet for grå pynt. */
function stegHue(i) {
  return Math.round(320 - (i / (Motor.STEG - 1)) * 230);
}

function kortHtml(p) {
  var e = p.kind === 'stemme' ? Motor.effekt(p.effekt) : null;
  var r = p.kind === 'stemme' ? Motor.rytme(p.rytme) : null;
  return '<div class="kort' + (p.paa ? ' paa' : '') + '" data-h="veksle" data-id="' +
    p.id + '" role="button" tabindex="0" style="--hue:' + p.hue + '">' +
    '<div class="figur">' + svgFor(p) + '</div>' +
    /* Navnet på en egen lyd er selv en knapp. Det er der barnet leter når de
       vil kalle den noe annet — ikke i et merke oppe i hjørnet. */
    (p.kind === 'stemme'
      ? '<div class="navn kanEndres" data-h="stell" data-id="' + p.id + '">' + tekst(p.navn) + '</div>'
      : '<div class="navn">' + tekst(p.navn) + '</div>') +
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
    '</div>';

  /* Taktlinjen ligger rett under toppen, ikke nederst. Der er den i synsfeltet
     samtidig som monstrene, og barna ser sammenhengen mellom lyset som løper
     og lyden som kommer. Nederst måtte de flytte blikket for å finne takten. */
  h += '<div class="steglys">';
  for (var i = 0; i < Motor.STEG; i++) {
    h += '<i class="' + (i % 4 === 0 ? 'slag' : '') + '" style="--h:' + stegHue(i) + '"></i>';
  }
  h += '</div>';

  /* De seks beatene er store knapper med hvert sitt bilde, rett over
     monstrene de styrer. Et barn som ikke leser, velger på bildet — og ser med
     én gang at monstrene under skifter når de trykker. */
  var gb = Motor.grunnbeat;
  h += '<div class="seksjon"><div class="seksjonstopp"><h2>BEATS</h2></div>' +
    '<div class="verdener">' +
    Motor.GRUNNBEATS.map(function (g) {
      return '<button class="verden' + (gb.id === g.id ? ' valgt' : '') +
        '" data-h="grunnbeat" data-id="' + g.id + '" style="--hue:' + g.hue + '">' +
        '<span class="vBilde">' + g.emoji + '</span><span class="vNavn">' + g.navn + '</span></button>';
    }).join('') +
    '</div><div class="rutenett beatkort' + (ui.nyVerden ? ' inn' : '') + '">' +
    beats.map(kortHtml).join('') + '</div></div>';
  ui.nyVerden = false;

  h += stemmeSeksjon(stemmer);

  h += sangSeksjon();
  h += '<div class="versjon">' + VERSJON + '</div>';

  E('app').innerHTML = h;
  finnElementer();
}

/* Barnas egne lyder, lagt opp for at det skal gå an å ha mange.

   «TA OPP» ligger først, ikke sist. Med to hundre lyder ville den ellers
   ligget flere meter nede, og det viktigste barnet gjør — å lage en ny — ville
   blitt det vanskeligste. Lydene står med den nyeste først, rett ved siden av
   knappen, fordi det er den de nettopp laget som de vil leke med.

   Bare de nyeste vises til å begynne med. Ellers ville sangene nederst på
   brettet forsvunnet under tjue rader med monstre. Står noen av de skjulte på,
   sier knappen fra om det — et monster som spiller uten å synes er forvirrende. */
function stemmeSeksjon(stemmer) {
  var liste = stemmer.slice().reverse();
  var viste = ui.visAlleLyder ? liste : liste.slice(0, VIS_FORST);
  var skjulte = liste.length - viste.length;
  var skjultePaa = liste.slice(viste.length).filter(function (p) { return p.paa; }).length;

  var h = '<div class="seksjon"><div class="seksjonstopp"><h2>DINE LYDER' +
    (liste.length ? ' <span class="antall">' + liste.length + '</span>' : '') +
    '</h2></div><div class="rutenett">';

  if (liste.length < MAKS_STEMMER) {
    h += '<div class="kort nytt" data-h="tilOpptak" role="button" tabindex="0">' +
      '<div class="mikro">🎤</div><div class="navn">TA OPP</div></div>';
  } else {
    h += '<div class="kort nytt fullt"><div class="mikro">🎉</div>' +
      '<div class="navn">' + MAKS_STEMMER + ' LYDER!</div>' +
      '<div class="fulltTekst">Slett noen for å lage nye</div></div>';
  }
  h += viste.map(kortHtml).join('') + '</div>';

  if (skjulte > 0) {
    h += '<button class="flere" data-h="visAlle">VIS ALLE ' + liste.length +
      (skjultePaa ? '<span>' + skjultePaa + ' av dem står på</span>' : '') + '</button>';
  } else if (ui.visAlleLyder && liste.length > VIS_FORST) {
    h += '<button class="flere" data-h="visFaerre">VIS FÆRRE</button>';
  }
  return h + '</div>';
}

/* Sangene ligger nederst på brettet, ikke bak en knapp. Et barn som må huske
   at det finnes en skjerm et sted, spiller ikke av sangen sin igjen — et barn
   som ser den, gjør det. */
function sangSeksjon() {
  var h = '<div class="seksjon sanger"><div class="seksjonstopp"><h2>SANGENE DINE</h2>' +
    '<div class="grunnbeats">' +
    '<button class="gb lagre" data-h="lagreSang"><span>💾</span>LAGRE DENNE</button>' +
    (S.sanger.length
      ? '<button class="gb" data-h="lagFil"><span>🎵</span>LAG LYDFIL</button>'
      : '') +
    '</div></div>';

  if (!S.sanger.length) {
    return h + '<p class="tomt">Skru på monstrene du liker, og trykk ' +
      '«Lagre denne». Da kan du spille sangen igjen når du vil.</p></div>';
  }

  h += '<div class="sangrad">' + S.sanger.map(function (sa) {
    var gb = Motor.finnGrunnbeat(sa.grunnbeat);
    var antall = sa.oppsett.filter(function (x) { return x.paa; }).length;
    return '<div class="sangkort' + (ui.aktivSang === sa.id ? ' aktiv' : '') +
      '" data-h="hentSang" data-id="' + sa.id + '" role="button" tabindex="0">' +
      '<div class="sangtopp"><span class="sanggb">' + gb.emoji + '</span>' +
      '<span class="sangspill">▶</span>' +
      '<button class="sangslett" data-h="slettSang" data-id="' + sa.id + '">✕</button></div>' +
      '<div class="sangnavn">' + tekst(sa.navn) + '</div>' +
      '<div class="sanginfo">' + antall + ' monstre · ' + sa.bpm + '</div>' +
      '</div>';
  }).join('') + '</div>';

  return h + '</div>';
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
    h += '<div class="nedtelling"><div class="tall" id="nedtall">3</div><p>GJØR DEG KLAR</p></div>';
  } else if (ui.opptak === 'tar') {
    h += '<canvas id="ring"></canvas>' +
      '<div class="midtIRing"><div class="stortEmoji">🎤</div></div>' +
      '<div class="tidslinje"><i id="tidsfyll"></i></div>' +
      '<button class="hoved stopp" data-h="stoppOpptak">FERDIG</button>';
  } else if (ui.opptak === 'lytt') {
    var p = ui.nyLyd;
    h += '<div class="lytt">' +
      '<div class="nyttMonster" style="--hue:' + p.hue + '">' + Monstre.tegn(p.id + ':' + p.hue, p.hue) + '</div>' +
      /* Navnet settes her, i det øyeblikket lyden er ny og de vet hva den
         skal hete. Å måtte finne fram til et innstillingsark etterpå er
         grunnen til at ingen av lydene noensinne het noe annet enn LYD 1. */
      '<input class="navnefelt midtstilt" data-h="nyttNavn" value="' + tekst(p.navn) +
      '" maxlength="10" aria-label="Navn på lyden">' +
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

  finnLys();
  if (ui.opptak === 'tar') {
    stoppRing = Visuell.opptaksring(E('ring'), function () { return Opptak.analyse; });
  }
}

/* ---------- sanger og eksport ---------- */

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

  /* En stemme som ikke er hentet ennå, hentes nå og skrus på når den er klar.
     Viser det seg at barnet egentlig rullet (stille = angre), avlyses det
     bare — da skal ingenting skrus på. */
  if (p.kind === 'stemme' && !p.buffer && !p.paa) {
    if (stille) { p.venter = false; return; }
    p.venter = true;
    lastLyd(p).then(function (buf) {
      var q = finnPlass(id);
      if (!q || !q.venter) return;
      q.venter = false;
      if (buf) veksle(id);
      else toast('Fant ikke lyden');
    });
    return;
  }

  brettEndret();
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
  brettEndret();
  Motor.settBpm(Motor.bpm + d);
  var t = document.querySelector('.tempo .tall b');
  if (t) t.textContent = Motor.bpm;
  skriv();
}

function transport() {
  if (Motor.spiller) Motor.stopp(); else Motor.spill();
  tegnBrett();
}

/* Å bytte beat bytter hele verdenen: monstrene, lydene, tempoet og fargene
   på himmelen. Barnets egne lyder blir stående slik de var, og spiller videre
   oppå den nye beaten. Hver verden husker hvilke av sine monstre som sto på
   sist, så det går an å hoppe fram og tilbake uten å bygge opp alt på nytt. */
function byttGrunnbeat(id) {
  if (id === Motor.grunnbeat.id) {
    if (!Motor.spiller) { Motor.spill(); tegnBrett(); }
    return;
  }
  brettEndret();
  skriv();                       // det gamle oppsettet huskes før det forsvinner
  var g = Motor.settGrunnbeat(id);
  byggBrett();
  Motor.sikreKjeder();
  Visuell.settHimmel(g.himmel);
  if (!Motor.spiller) Motor.spill();
  skriv();
  ui.nyVerden = true;
  tegnBrett();
  toast(g.emoji + ' ' + g.navn);
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
  finnLys();
  Opptak.begynn();
  var maks = Opptak.MAKS_SEK;
  var start = performance.now();
  opptaksklokke = setInterval(function () {
    var gaatt = (performance.now() - start) / 1000;
    var f = E('tidsfyll');
    if (f) f.style.width = Math.min(100, gaatt / maks * 100) + '%';
    if (gaatt >= maks) stoppOpptak();
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
    /* Appen foreslår et navn som passer til lyden. Det står ferdig utfylt i
       feltet, så barnet kan beholde det eller skrive noe eget. */
    navn: Navn.lag(buf, S.stemmer.map(function (st) { return st.navn; })),
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
  brettEndret();
  p.effekt = id;
  Motor.plassEndret(p);
  Motor.smak(p);
  tegnArk();
  skriv();
}

function settRytme(id) {
  var p = finnPlass(ui.stellId);
  if (!p) return;
  brettEndret();
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
    grunnbeat: Motor.grunnbeat.id,
    oppsett: Motor.plasser.map(function (p) {
      return { id: p.id, paa: p.paa, effekt: p.effekt, rytme: p.rytme };
    })
  };
  S.sanger.unshift(sang);
  ui.aktivSang = sang.id;
  skriv();
  tegnBrett();
  toast(sang.navn + ' er lagret');
}

function hentSang(id) {
  var sang = null;
  S.sanger.forEach(function (s) { if (s.id === id) sang = s; });
  if (!sang) return;
  // verdenen først: den bestemmer hvilke monstre sangen kan skru på
  skriv();
  var gb = Motor.settGrunnbeat(sang.grunnbeat, false);
  Motor.settBpm(sang.bpm);
  byggBrett();
  Visuell.settHimmel(gb.himmel);
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
  /* Stemmene i sangen hentes nå. Beatet begynner med en gang, og en stemme som
     ikke er lastet ennå blir med fra neste slag den er klar — det er noen få
     millisekunder, ikke noe barnet merker. */
  lastLyder();
  if (!Motor.spiller) Motor.spill();
  ui.aktivSang = sang.id;
  skriv();
  vis('brett');
  toast('▶ ' + sang.navn);
}

function slettSang(id) {
  S.sanger = S.sanger.filter(function (s) { return s.id !== id; });
  skriv();
  tegnBrett();
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

/* ---------- navn og lagring ---------- */

/* Lyder laget før appen kunne gi navn selv, heter LYD 1, LYD 2 og så videre.
   De får nå navn etter hvordan de faktisk låter — men bare de som fortsatt har
   det automatiske navnet. Har barnet døpt en lyd selv, blir den i fred.

   De tas én og én, ikke alle på én gang: dekoding av mange opptak samtidig
   ville hakket i beatet som allerede spiller. */
function gammeleNavn() {
  var gamle = S.stemmer.filter(function (st) { return /^LYD \d+$/.test(st.navn); });
  if (!gamle.length) return;
  var kjede = Promise.resolve(), endret = 0;
  gamle.forEach(function (st) {
    kjede = kjede.then(function () {
      var p = finnPlass(st.id);
      if (!p) return null;
      var hadde = !!p.buffer;
      return lastLyd(p).then(function (buf) {
        if (!buf) return;
        var andre = S.stemmer.filter(function (s) { return s.id !== st.id; })
          .map(function (s) { return s.navn; });
        st.navn = p.navn = Navn.lag(buf, andre);
        endret++;
        // en lyd som står av, trengte vi bare for å høre på den
        if (!p.paa && !hadde) p.buffer = null;
      });
    });
  });
  kjede.then(function () {
    if (!endret) return;
    skriv();
    if (ui.skjerm === 'brett') tegnBrett();
  });
}

/* Safari kan rydde bort lagrede data fra nettsider som ikke har vært brukt på
   en stund. Her ber vi om at lydene får bli liggende — med to hundre opptak er
   det mye å miste. For en app som er lagt på hjemskjermen blir svaret som
   regel ja. */
function beOmVarigLagring() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(function () {});
    }
  } catch (e) {}
}

/* ---------- hendelsesruting ---------- */

var handlinger = {
  begynn: function () {
    Motor.start();
    byggBrett();
    Motor.sikreKjeder();
    Motor.spill();
    vis('brett');
    lastLyder().then(function () {
      Motor.sikreKjeder();
      if (ui.skjerm === 'brett') tegnBrett();
    });
    gammeleNavn();
    beOmVarigLagring();
  },
  tempo: function (el) { tempo(parseInt(el.dataset.d, 10)); },
  grunnbeat: function (el) { byttGrunnbeat(el.dataset.id); },
  transport: transport,
  tilBrett: function () {
    avbrytOpptak();
    ui.nyLyd = null;
    vis('brett');
  },
  tilOpptak: tilOpptak,
  visAlle: function () { ui.visAlleLyder = true; tegnBrett(); },
  visFaerre: function () { ui.visAlleLyder = false; tegnBrett(); },
  prov: function () { ui.opptak = 'klar'; tilOpptak(); },
  startOpptak: startOpptak,
  stoppOpptak: stoppOpptak,
  omigjen: function () { ui.nyLyd = null; ui.opptak = 'klar'; tilOpptak(); },
  velgEffekt: function (el) { velgEffekt(el.dataset.e); },
  lagreLyd: lagreLyd,
  hodetelefoner: function (el) { S.hodetelefoner = el.checked; skriv(); },
  stell: function (el) {
    ui.stellId = el.dataset.id;
    tegnArk();
    // hentes nå, så effektene kan prøves med en gang selv om lyden står av
    lastLyd(finnPlass(el.dataset.id));
  },
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
    /* Kortet bak arket oppdateres mens de skriver. Uten dette står det gamle
       navnet der helt til arket lukkes, og da ser det ut som om det ikke
       virket. */
    var kort = kortEl[p.id] && kortEl[p.id].querySelector('.navn');
    if (kort) kort.textContent = p.navn;
    skriv();
  },
  nyttNavn: function (el) {
    if (ui.nyLyd) ui.nyLyd.navn = (el.value || 'LYD').toUpperCase().slice(0, 10);
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
  if (h === 'veksle' || h === 'navn' || h === 'nyttNavn' || h === 'hodetelefoner') return;
  e.preventDefault();
  kjor(h, el);
});

document.addEventListener('change', function (e) {
  var el = e.target.closest ? e.target.closest('[data-h]') : null;
  if (!el) return;
  if (el.dataset.h === 'hodetelefoner' || el.dataset.h === 'navn' || el.dataset.h === 'nyttNavn') {
    kjor(el.dataset.h, el);
  }
});

/* Navnefeltene oppdaterer mens det skrives, ikke forst naar feltet forlates.
   Et barn som skriver og trykker rett paa LEGG TIL skal ikke miste navnet. */
document.addEventListener('input', function (e) {
  var el = e.target.closest ? e.target.closest('[data-h="navn"], [data-h="nyttNavn"]') : null;
  if (el) kjor(el.dataset.h, el);
});

// Enter lukker tastaturet paa nettbrett i stedet for aa gjore ingenting
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var el = e.target.closest ? e.target.closest('[data-h="navn"], [data-h="nyttNavn"]') : null;
  if (el) el.blur();
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
  finnLys();
}

// steglysene plukkes opp for seg, så de kan finnes på nytt uten resten av brettet
function finnLys() {
  lysEl = [];
  sisteLys = -1;
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
  if (!Motor.ctx) return;

  var s = Visuell.takt.steg;
  if (s !== sisteLys && lysEl.length) {
    if (sisteLys >= 0 && lysEl[sisteLys]) lysEl[sisteLys].classList.remove('naa');
    if (lysEl[s]) lysEl[s].classList.add('naa');
    sisteLys = s;
  }

  if (ui.skjerm !== 'brett') return;
  var naa = Motor.ctx.currentTime;
  var plasser = Motor.plasser;
  for (var i = 0; i < plasser.length; i++) {
    var p = plasser[i];
    var el = kortEl[p.id];
    if (!el) continue;
    var n = p.paa && p.rigg ? Visuell.niva(p.rigg.analyse) : 0;
    var d = naa - (p.sistSpilt || 0);
    var sprett = d >= 0 && d < 0.35 ? 1 - d / 0.35 : 0;
    /* Verdiene skrives bare når de faktisk endrer seg. Et monster som står av
       har samme verdier bilde etter bilde, og med 200 kort ble det ellers
       titusener av stilskrivinger i sekundet — hver av dem kan tvinge
       nettleseren til å regne om utseendet på siden. */
    var nT = n.toFixed(2), sT = sprett.toFixed(2);
    if (el._n !== nT) { el.style.setProperty('--niva', nT); el._n = nT; }
    if (el._s !== sT) { el.style.setProperty('--sprett', sT); el._s = sT; }
    var m = munnEl[p.id];
    if (m) {
      var mT = 'scaleY(' + (0.3 + n * 2.6).toFixed(2) + ')';
      if (m._t !== mT) { m.style.transform = mT; m._t = mT; }
    }
    blunkeAnimasjon(p.id, naaMs);
  }
});

/* ---------- oppstart ---------- */

function oppstart() {
  S = les();
  /* Beaten settes uten sitt eget tempo, slik at et tempo barnet har stilt
     selv overlever at appen lukkes. Den må settes før brettet bygges — det
     er den som bestemmer hvilke monstre som finnes. */
  var gb = Motor.settGrunnbeat(S.grunnbeat, false);
  Motor.settBpm(S.bpm || gb.bpm);
  byggBrett();
  Visuell.bakgrunn(E('bg'));
  Visuell.settHimmel(gb.himmel, true);
  vis('start');
  if ('serviceWorker' in navigator) {
    /* Hadde siden allerede en service worker da den startet, og en NY tar over
       underveis, betyr det at en oppdatering nettopp er installert. Da lastes
       siden en gang, sa barna far den nye utgaven uten a vite at det finnes noe
       som heter en versjon. Forste besok har ingen gammel arbeider a bytte fra,
       og skal ikke laste pa nytt. */
    var haddeArbeider = !!navigator.serviceWorker.controller;
    var harLastet = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!haddeArbeider || harLastet) return;
      harLastet = true;
      location.reload();
    });
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
