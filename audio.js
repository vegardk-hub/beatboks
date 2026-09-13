/* Lydmotoren i Beatboks.
   All lyd lages i WebAudio — appen har ingen lydfiler med seg.
   Hvorfor: den skal starte med én gang, virke uten nett, og tempoet må kunne
   endres uten at trommene låter strukket. Syntetiserte trommer følger tempoet
   gratis; ferdige loop-filer gjør det ikke.

   Alt som lager lyd tar konteksten som første argument. Det er ikke pynt:
   eksportfunksjonen kjører nøyaktig den samme koden i en OfflineAudioContext,
   så det de hører er det de får i fila. */
var Motor = (function () {
  'use strict';

  var AC = window.AudioContext || window.webkitAudioContext;
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  var STEG = 16;               // sekstendedeler i én runde (én takt)
  var FRAMSYN = 0.12;          // hvor langt fram i tid vi planlegger, i sekunder
  var TIKK = 25;               // hvor ofte planleggeren våkner, i millisekunder

  /* ---------- små byggeklosser ---------- */

  /* Ett støylager gjenbrukes av alle trommer. Å lage ny støy for hvert slag
     ville gitt hundrevis av bufre i minuttet uten at det hørtes. */
  var stoyLager = {};
  function stoy(c) {
    var k = String(c.sampleRate);
    if (stoyLager[k]) return stoyLager[k];
    var n = Math.floor(c.sampleRate * 2);
    var b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    stoyLager[k] = b;
    return b;
  }

  /* Tilfeldig startpunkt i støyen, ellers høres hvert hihat-slag helt likt ut
     og rytmen blir maskinaktig. */
  function stoyKilde(c, t, lengde) {
    var s = c.createBufferSource();
    s.buffer = stoy(c);
    s.loop = true;
    s.start(t, Math.random() * 1.5, lengde);
    return s;
  }

  function hylster(c, t, topp, angrep, forfall) {
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(topp, 0.0002), t + angrep);
    g.gain.exponentialRampToValueAtTime(0.0001, t + angrep + forfall);
    return g;
  }

  /* ---------- trommestemmer ---------- */

  function kick(c, t, ut, v) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g); g.connect(ut);
    o.start(t); o.stop(t + 0.45);
    /* Et kort klikk på toppen. Nettbretthøyttalere gjengir ikke 45 Hz i det
       hele tatt, så uten dette forsvinner kicken helt på iPad. */
    var s = stoyKilde(c, t, 0.03), f = c.createBiquadFilter();
    var ng = hylster(c, t, v * 0.5, 0.001, 0.025);
    f.type = 'bandpass'; f.frequency.value = 1800;
    s.connect(f); f.connect(ng); ng.connect(ut);
    s.stop(t + 0.06);
  }

  function skarp(c, t, ut, v) {
    var s = stoyKilde(c, t, 0.22), f = c.createBiquadFilter();
    var g = hylster(c, t, v * 0.8, 0.002, 0.15);
    f.type = 'highpass'; f.frequency.value = 1200;
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 0.26);
    var o = c.createOscillator(), og = hylster(c, t, v * 0.5, 0.002, 0.09);
    o.type = 'triangle';
    o.frequency.setValueAtTime(215, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    o.connect(og); og.connect(ut); o.start(t); o.stop(t + 0.14);
  }

  function hatt(c, t, ut, v) {
    var lengde = v > 0.9 ? 0.06 : 0.04;
    var s = stoyKilde(c, t, lengde + 0.05), f = c.createBiquadFilter();
    var g = hylster(c, t, v * 0.45, 0.001, lengde);
    f.type = 'highpass'; f.frequency.value = 7200;
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + lengde + 0.07);
  }

  function klapp(c, t, ut, v) {
    /* Tre korte smell tett etter hverandre pluss en hale. Ett enkelt støysmell
       høres ut som én hånd; tre høres ut som et rom fullt av folk. */
    for (var i = 0; i < 3; i++) {
      var tt = t + i * 0.013;
      var s = stoyKilde(c, tt, 0.04), f = c.createBiquadFilter();
      var g = hylster(c, tt, v * 0.6, 0.001, 0.03);
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.2;
      s.connect(f); f.connect(g); g.connect(ut); s.stop(tt + 0.07);
    }
    var s2 = stoyKilde(c, t + 0.026, 0.2), f2 = c.createBiquadFilter();
    var g2 = hylster(c, t + 0.026, v * 0.45, 0.002, 0.16);
    f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 0.9;
    s2.connect(f2); f2.connect(g2); g2.connect(ut); s2.stop(t + 0.26);
  }

  function riste(c, t, ut, v) {
    var s = stoyKilde(c, t, 0.09), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = 5500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 0.1);
  }

  function bjelle(c, t, ut, v) {
    var g = hylster(c, t, v * 0.32, 0.002, 0.2), f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 2;
    [540, 800].forEach(function (hz) {
      var o = c.createOscillator();
      o.type = 'square'; o.frequency.value = hz;
      o.connect(f); o.start(t); o.stop(t + 0.24);
    });
    f.connect(g); g.connect(ut);
  }

  function kant(c, t, ut, v) {
    var o = c.createOscillator(), g = hylster(c, t, v * 0.45, 0.001, 0.045);
    o.type = 'square'; o.frequency.value = 420;
    o.connect(g); g.connect(ut); o.start(t); o.stop(t + 0.07);
  }

  function bass(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz;
    f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(Math.min(hz * 12, 2400), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(hz * 2.2, 90), t + lengde);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.45, t + 0.012);
    g.gain.setValueAtTime(v * 0.45, t + lengde * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o.stop(t + lengde + 0.03);
  }

  function blipp(c, t, ut, v, hz) {
    var o = c.createOscillator(), o2 = c.createOscillator();
    var f = c.createBiquadFilter(), g = hylster(c, t, v * 0.24, 0.006, 0.24);
    o.type = 'square'; o.frequency.value = hz;
    o2.type = 'square'; o2.frequency.value = hz * 1.006;   // liten detune gir bredde
    f.type = 'lowpass'; f.frequency.value = 3400;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o2.start(t); o.stop(t + 0.32); o2.stop(t + 0.32);
  }

  function teppe(c, t, ut, v, lengde) {
    var f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 1500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.13, t + 0.4);
    g.gain.setValueAtTime(v * 0.13, t + lengde * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
    [220, 261.63, 329.63, 440].forEach(function (hz, i) {
      var o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz;
      o.detune.value = i % 2 ? 8 : -8;
      o.connect(f); o.start(t); o.stop(t + lengde + 0.06);
    });
    f.connect(g); g.connect(ut);
  }

  /* ---------- tonene ---------- */

  /* Alt som har tonehøyde holder seg til A-moll pentaton. Det er ikke en
     musikalsk finesse, det er hele grunnen til at en seksåring kan slå på alt
     samtidig uten at det låter surt. */
  var N = {
    A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, G2: 98, A2: 110,
    C3: 130.81, D3: 146.83, E3: 164.81, G3: 196, A3: 220,
    C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440,
    C5: 523.25, D5: 587.33, E5: 659.25
  };

  function toner(tekst) {
    return tekst.trim().split(/\s+/).map(function (x) { return x === '.' ? null : x; });
  }

  /* ---------- de innebygde monstrene ---------- */

  /* Mønsteret leses som 16 tegn: x = hardt slag, o = mykt, . = stille.
     Andre bokstaver er egne varianter som stemmen selv tolker. */
  /* Monsteret er instrumentet — hva det ER. Hva det SPILLER kommer fra
     grunnbeaten under. Skillet er hele grunnen til at samme monster kan gå fra
     boom bap til reggae uten å skifte utseende eller navn: barna kjenner igjen
     DUNDER som sin kick, uansett hvilken låt de bygger. */
  var BEATS = [
    { id: 'dunder', navn: 'DUNDER', emoji: '💥', hue: 348, slag: kick },
    { id: 'klapp', navn: 'KLAPP', emoji: '👏', hue: 32, slag: klapp },
    { id: 'tikk', navn: 'TIKK', emoji: '🎩', hue: 188, slag: hatt },
    { id: 'skarp', navn: 'SMELL', emoji: '🥁', hue: 12, slag: skarp },
    { id: 'riste', navn: 'RISTE', emoji: '✨', hue: 74, slag: riste },
    { id: 'rare', navn: 'RARE', emoji: '🛸', hue: 292,
      slag: function (c, t, ut, v, tegn) {
        if (tegn === 'r') kant(c, t, ut, v); else bjelle(c, t, ut, v);
      } },
    { id: 'bass', navn: 'BASS', emoji: '🟣', hue: 262, slag: bass, tonal: true },
    { id: 'blipp', navn: 'BLIPP', emoji: '💫', hue: 158, slag: blipp, tonal: true },
    { id: 'kosmisk', navn: 'KOSMISK', emoji: '🌌', hue: 212, teppe: true }
  ];

  /* ---------- grunnbeatene ---------- */

  /* Hver grunnbeat er et helt arrangement: alle monstrene får nytt mønster på
     én gang, og tempoet følger med. Det er derfor de føles som ulike låter og
     ikke bare som «samme beat, litt annerledes».

     Tonene holder seg i A-moll pentaton på tvers av alle fem, så barna kan
     bytte grunnbeat midt i en låt uten at deres egne lyder plutselig blir sure
     mot bassen. */
  var GRUNNBEATS = [
    {
      id: 'boombap', navn: 'BOOM BAP', emoji: '🥊', bpm: 92,
      spor: {
        dunder: 'x.....x...x.....',
        klapp: '....x.......x..o',
        tikk: 'x.o.x.o.x.oox.o.',
        skarp: '....x..o....x...',
        riste: '.o.x.o.x.o.x.oxx',
        rare: '..x....r...x.r..',
        bass: 'A1 . . . . . C2 . . . A1 . . . E2 .',
        blipp: 'A4 . . C5 . . E5 . D5 . . C5 . . A4 .'
      }
    },
    {
      id: 'disko', navn: 'DISKO', emoji: '🪩', bpm: 118,
      spor: {
        dunder: 'x...x...x...x...',          // stampende på hvert slag
        klapp: '....x.......x...',
        tikk: '..x...x...x...x.',            // åpne hatter mellom slagene
        skarp: '............x..o',
        riste: 'oxoxoxoxoxoxoxox',
        rare: '....k.......k..r',
        bass: 'A1 . A2 . A1 . A2 . A1 . A2 . G2 . E2 .',   // oktavsprang
        blipp: 'E5 . D5 . C5 . A4 . E5 . D5 . C5 . D5 .'
      }
    },
    {
      id: 'trap', navn: 'TRAP', emoji: '🧊', bpm: 76,
      spor: {
        dunder: 'x.....x..x...x..',
        klapp: '........x.......',
        tikk: 'xoxoxoxxxoxoxxox',          // rullende hatter er hele signaturen
        skarp: '........x.......',
        riste: '..o...o...o...oo',
        rare: '...r...........k',
        bass: 'A1 . . . . . . . C2 . . . . . E2 .',
        blipp: 'A4 . . . E5 . . . . . C5 . . . . .'
      }
    },
    {
      id: 'rock', navn: 'ROCK', emoji: '🎸', bpm: 128,
      spor: {
        dunder: 'x.......x..x....',
        klapp: '............x...',
        tikk: 'x.x.x.x.x.x.x.x.',           // rette åttendedeler
        skarp: '....x.......x...',
        riste: 'o.o.o.o.o.o.o.oo',
        rare: '..............r.',
        bass: 'A1 . A1 . A1 . A1 . G2 . G2 . E2 . E2 .',
        blipp: 'A4 . . . G4 . . . E4 . . . D4 . . .'
      }
    },
    {
      id: 'reggae', navn: 'REGGAE', emoji: '🌴', bpm: 76,
      spor: {
        dunder: '........x.......',          // ett drypp, midt i takten
        /* Klappet ligger med vilje IKKE på ettdryppet. Kick og skarptromme
           treffer allerede sammen der, og et tredje slag oppå summerte seg til
           klipping — i tillegg til at det ikke tilfører noe musikalsk. */
        klapp: '....o.......o...',
        tikk: '..x...x...x...x.',            // skank på opptakten
        skarp: '........x......o',
        riste: '....o.......o..o',
        rare: '..r.....k...r...',
        bass: 'A1 . . C2 . . E2 . . . A1 . . . . .',
        blipp: '. . E5 . . . C5 . . . A4 . . . . .'
      }
    }
  ];

  /* De tonale sporene skrives som tekst for at de skal være lesbare ved siden
     av rytmesporene, og gjøres om til noteliste én gang her. */
  (function klargjorGrunnbeats() {
    var tonale = {};
    BEATS.forEach(function (b) { if (b.tonal) tonale[b.id] = true; });
    GRUNNBEATS.forEach(function (g) {
      Object.keys(g.spor).forEach(function (id) {
        if (tonale[id] && typeof g.spor[id] === 'string') g.spor[id] = toner(g.spor[id]);
      });
    });
  })();

  var grunnbeat = GRUNNBEATS[0];

  function finnGrunnbeat(id) {
    for (var i = 0; i < GRUNNBEATS.length; i++) if (GRUNNBEATS[i].id === id) return GRUNNBEATS[i];
    return GRUNNBEATS[0];
  }

  /* Barnas egen beat kommer inn samme vei som de innebygde og oppfører seg
     likt etterpå. De tonale sporene kan komme ferdig oppdelt fra analysen,
     så normaliseringen tåler begge former. */
  function leggTilGrunnbeat(def) {
    var tonale = {};
    BEATS.forEach(function (b) { if (b.tonal) tonale[b.id] = true; });
    var spor = {};
    Object.keys(def.spor).forEach(function (id) {
      var s = def.spor[id];
      spor[id] = (tonale[id] && typeof s === 'string') ? toner(s) : s;
    });
    var ny = {
      id: def.id, navn: def.navn, emoji: def.emoji,
      bpm: def.bpm || bpm, egen: true, spor: spor
    };
    for (var i = 0; i < GRUNNBEATS.length; i++) {
      if (GRUNNBEATS[i].id === ny.id) {
        GRUNNBEATS[i] = ny;
        if (grunnbeat.id === ny.id) grunnbeat = ny;
        return ny;
      }
    }
    GRUNNBEATS.push(ny);
    return ny;
  }

  /* Brukes til utkastet mens barnet redigerer kartet sitt. Den som fjerner må
     selv velge en annen grunnbeat etterpå — vi rører ikke den som spiller, for
     da ville lyden hoppet midt i en redigering. */
  function fjernGrunnbeat(id) {
    for (var i = 0; i < GRUNNBEATS.length; i++) {
      if (GRUNNBEATS[i].id === id) { GRUNNBEATS.splice(i, 1); return true; }
    }
    return false;
  }

  /* ---------- effekter ---------- */

  /* Kurvene har et ODDE antall punkter, og x regnes ut mot n-1.
     Da treffer midtpunktet nøyaktig null. Med et partall havner inngang 0
     mellom to verdier, og en vrengekurve gir da ut en konstant likespenning
     så lenge noden finnes — også når det er helt stille. Det spiser
     styrkeforholdet i hele miksen og gir et dunk hver gang effekten kobles
     inn. Det kostet én linje å oppdage og én linje å fikse. */
  function vrengKurve(styrke) {
    var n = 1025, k = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i * 2 / (n - 1) - 1;
      k[i] = (1 + styrke) * x / (1 + styrke * Math.abs(x));
    }
    return k;
  }

  function knuseKurve(trinn) {
    var n = 1025, k = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i * 2 / (n - 1) - 1;
      k[i] = Math.round(x * trinn) / trinn;
    }
    return k;
  }

  /* Romklang uten lydfil: støy som dør ut. Det er nøyaktig det et ekte
     romopptak er, bare uten de tidlige refleksjonene. */
  function romsvar(c, sek, forfall) {
    var n = Math.floor(c.sampleRate * sek), b = c.createBuffer(2, n, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, forfall);
    }
    return b;
  }

  function robotKjede(c) {
    var inn = c.createGain(), ring = c.createGain(), osc = c.createOscillator();
    var knus = c.createWaveShaper(), ut = c.createGain(), rent = c.createGain();
    ring.gain.value = 0;                 // ganging: oscillatoren ER forsterkningen
    osc.type = 'square'; osc.frequency.value = 58;
    osc.connect(ring.gain); osc.start();
    knus.curve = knuseKurve(7);
    rent.gain.value = 0.22;              // litt ren stemme igjen, ellers blir ordene borte
    inn.connect(ring); ring.connect(knus); knus.connect(ut);
    inn.connect(rent); rent.connect(ut);
    ut.gain.value = 1.15;
    return { inn: inn, ut: ut, oscs: [osc] };
  }

  function ekkoKjede(c, bpm) {
    var inn = c.createGain(), d = c.createDelay(2), fb = c.createGain();
    var f = c.createBiquadFilter(), ut = c.createGain();
    d.delayTime.value = 60 / bpm / 2;    // én åttendedel — ekkoet lander på takten
    fb.gain.value = 0.42;
    f.type = 'highpass'; f.frequency.value = 380;
    inn.connect(ut);
    inn.connect(d); d.connect(f); f.connect(fb); fb.connect(d); d.connect(ut);
    return { inn: inn, ut: ut };
  }

  function huleKjede(c) {
    var inn = c.createGain(), rom = c.createConvolver();
    var vaat = c.createGain(), ut = c.createGain();
    rom.buffer = romsvar(c, 2.2, 2.4);
    vaat.gain.value = 0.85;
    inn.connect(ut);
    inn.connect(rom); rom.connect(vaat); vaat.connect(ut);
    return { inn: inn, ut: ut };
  }

  function romvesenKjede(c) {
    /* Modulert forsinkelse (flanger) pluss skjelving. Det er svevet som gjør
       at hjernen hører "ikke et menneske" uten at ordene forsvinner. */
    var inn = c.createGain(), d = c.createDelay(0.05), fb = c.createGain();
    var lfo = c.createOscillator(), dybde = c.createGain();
    var skjelv = c.createGain(), slfo = c.createOscillator(), sdybde = c.createGain();
    var ut = c.createGain();
    d.delayTime.value = 0.0055;
    lfo.type = 'sine'; lfo.frequency.value = 0.33;
    dybde.gain.value = 0.0042;
    lfo.connect(dybde); dybde.connect(d.delayTime); lfo.start();
    fb.gain.value = 0.55;
    skjelv.gain.value = 0.75;
    slfo.type = 'sine'; slfo.frequency.value = 6.5;
    sdybde.gain.value = 0.25;
    slfo.connect(sdybde); sdybde.connect(skjelv.gain); slfo.start();
    inn.connect(skjelv);
    skjelv.connect(ut);
    skjelv.connect(d); d.connect(fb); fb.connect(d); d.connect(ut);
    return { inn: inn, ut: ut, oscs: [lfo, slfo] };
  }

  function radioKjede(c) {
    var inn = c.createGain(), hp = c.createBiquadFilter(), lp = c.createBiquadFilter();
    var drive = c.createWaveShaper(), ut = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 550; hp.Q.value = 0.9;
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.9;
    drive.curve = vrengKurve(9);
    inn.connect(hp); hp.connect(lp); lp.connect(drive); drive.connect(ut);
    ut.gain.value = 1.4;
    return { inn: inn, ut: ut };
  }

  function vrengKjede(c) {
    var inn = c.createGain(), pre = c.createGain(), v = c.createWaveShaper();
    var lp = c.createBiquadFilter(), ut = c.createGain();
    pre.gain.value = 4;
    v.curve = vrengKurve(60);
    lp.type = 'lowpass'; lp.frequency.value = 4200;   // demper det skarpeste, ellers gjør det vondt i ørene
    inn.connect(pre); pre.connect(v); v.connect(lp); lp.connect(ut);
    ut.gain.value = 0.5;
    return { inn: inn, ut: ut };
  }

  /* rate: farten lyden spilles av i. Tonehøyde og fart henger sammen, akkurat
     som på en gammel kassett — både enklere og morsommere enn ekte
     tonehøydeskifting, og det er lyden barna kjenner igjen fra tegnefilm.
     gjenta: antall kopier som avfyres tett etter hverandre. */
  var EFFEKTER = [
    { id: 'ren', navn: 'REN', emoji: '🙂', hue: 190, rate: 1 },
    { id: 'mus', navn: 'MUS', emoji: '🐭', hue: 330, rate: 1.8 },
    { id: 'troll', navn: 'TROLL', emoji: '👹', hue: 4, rate: 0.58 },
    { id: 'robot', navn: 'ROBOT', emoji: '🤖', hue: 145, rate: 1, bygg: robotKjede },
    { id: 'ekko', navn: 'EKKO', emoji: '🌀', hue: 205, rate: 1, bygg: ekkoKjede, tempoknyttet: true },
    { id: 'hule', navn: 'HULE', emoji: '🏰', hue: 250, rate: 1, bygg: huleKjede },
    { id: 'romvesen', navn: 'ROMVESEN', emoji: '👽', hue: 100, rate: 0.94, bygg: romvesenKjede },
    { id: 'radio', navn: 'RADIO', emoji: '📻', hue: 30, rate: 1, bygg: radioKjede },
    { id: 'stotre', navn: 'STOTRE', emoji: '⏭️', hue: 278, rate: 1, gjenta: 4 },
    { id: 'vrengt', navn: 'VRENGT', emoji: '🔥', hue: 14, rate: 1, bygg: vrengKjede },
    { id: 'baklengs', navn: 'BAKLENGS', emoji: '⏪', hue: 170, rate: 1, bakvendt: true }
  ];

  function effekt(id) {
    for (var i = 0; i < EFFEKTER.length; i++) if (EFFEKTER[i].id === id) return EFFEKTER[i];
    return EFFEKTER[0];
  }

  /* ---------- rytmene en stemme kan få ---------- */

  var RYTMER = [
    { id: 'hel', navn: 'HEL', emoji: '🔁', steg: [0], avstand: 16 },
    { id: 'slag', navn: 'SLAG', emoji: '🥁', steg: [0, 4, 8, 12], avstand: 4 },
    { id: 'mellom', navn: 'MELLOM', emoji: '〰️', steg: [2, 6, 10, 14], avstand: 4 },
    { id: 'kjapt', navn: 'KJAPT', emoji: '⚡', steg: [0, 2, 4, 6, 8, 10, 12, 14], avstand: 2 }
  ];

  function rytme(id) {
    for (var i = 0; i < RYTMER.length; i++) if (RYTMER[i].id === id) return RYTMER[i];
    return RYTMER[1];
  }

  /* ---------- én plass sin egen signalkjede ---------- */

  function byggKjede(c, plass, mot, bpm) {
    var g = c.createGain();
    g.gain.value = plass.volum == null ? 1 : plass.volum;
    var an = c.createAnalyser();
    an.fftSize = 64; an.smoothingTimeConstant = 0.5;
    var e = plass.kind === 'stemme' ? effekt(plass.effekt) : null;
    var kjede = e && e.bygg ? e.bygg(c, bpm) : null;
    var hode = kjede ? kjede.inn : g;
    if (kjede) kjede.ut.connect(g);
    var sist = g;
    if (c.createStereoPanner) {
      var p = c.createStereoPanner();
      p.pan.value = plass.pan || 0;
      g.connect(p); sist = p;
    }
    sist.connect(an); an.connect(mot);
    return { hode: hode, gain: g, analyse: an, kjede: kjede };
  }

  function rivKjede(rigg) {
    if (!rigg) return;
    if (rigg.kjede && rigg.kjede.oscs) {
      rigg.kjede.oscs.forEach(function (o) { try { o.stop(); } catch (e) {} });
    }
    try { rigg.analyse.disconnect(); } catch (e) {}
  }

  /* ---------- avfyring ---------- */

  function bakvendtBuffer(c, plass) {
    if (plass._bak && plass._bakFra === plass.buffer) return plass._bak;
    var b = plass.buffer;
    var ny = c.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (var ch = 0; ch < b.numberOfChannels; ch++) {
      var inn = b.getChannelData(ch), ut = ny.getChannelData(ch);
      for (var i = 0, n = b.length; i < n; i++) ut[i] = inn[n - 1 - i];
    }
    plass._bak = ny; plass._bakFra = b;
    return ny;
  }

  function spillStemme(c, plass, t, e, maksLengde, stegLengde) {
    var buf = e.bakvendt ? bakvendtBuffer(c, plass) : plass.buffer;
    if (!buf) return;
    var kopier = e.gjenta || 1;
    var mellom = kopier > 1 ? stegLengde / 2 : 0;
    for (var i = 0; i < kopier; i++) {
      var tt = t + i * mellom;
      var s = c.createBufferSource(), g = c.createGain();
      s.buffer = buf;
      s.playbackRate.value = e.rate || 1;
      s.connect(g); g.connect(plass.rigg.hode);
      var full = buf.duration / (e.rate || 1);
      var tak = kopier > 1 ? mellom * 0.92 : maksLengde;
      var lengde = tak > 0 && tak < full ? tak : full;
      g.gain.setValueAtTime(1, tt);
      if (lengde < full) {
        /* Kutt halen mykt. Et rått stopp midt i en stemme knepper, og i en
           loop kommer knepset igjen hver eneste runde. */
        g.gain.setValueAtTime(1, tt + lengde - 0.012);
        g.gain.linearRampToValueAtTime(0, tt + lengde);
      }
      s.start(tt);
      s.stop(tt + lengde + 0.03);
    }
    plass.sistSpilt = t;
  }

  function fyrPlass(c, plass, steg, takt, t, stegLengde) {
    if (plass.kind === 'trommer') {
      var d = plass.def;
      if (d.teppe) {
        if (steg === 0 && takt % 2 === 0) teppe(c, t, plass.rigg.hode, 1, stegLengde * 32);
        return;
      }
      var spor = grunnbeat.spor[d.id];
      if (!spor) return;
      if (d.tonal) {
        var nm = spor[steg];
        if (!nm) return;
        d.slag(c, t, plass.rigg.hode, 1, N[nm], stegLengde * 2);
        plass.sistSpilt = t;
        return;
      }
      var tegn = spor.charAt(steg);
      if (tegn === '.') return;
      d.slag(c, t, plass.rigg.hode, tegn === 'o' ? 0.55 : (tegn === 'x' ? 1 : 0.85), tegn);
      plass.sistSpilt = t;
      return;
    }

    if (!plass.buffer) return;
    var e = effekt(plass.effekt), r = rytme(plass.rytme);
    if (r.id === 'hel') {
      if (steg !== 0) return;
      /* Et langt opptak skal ikke hakkes av neste runde. Det får så mange
         takter det trenger, avrundet opp til 1, 2 eller 4. */
      var lengde = plass.buffer.duration / (e.rate || 1);
      var takt1 = stegLengde * 16;
      var hver = lengde > takt1 * 2.05 ? 4 : (lengde > takt1 * 1.05 ? 2 : 1);
      if (takt % hver !== 0) return;
      spillStemme(c, plass, t, e, 0, stegLengde);
      return;
    }
    if (r.steg.indexOf(steg) < 0) return;
    spillStemme(c, plass, t, e, r.avstand * stegLengde * 0.96, stegLengde);
  }

  function fyrSteg(c, plasser, steg, takt, t, bpm) {
    var sl = 60 / bpm / 4;
    for (var i = 0; i < plasser.length; i++) {
      var p = plasser[i];
      if (!p.paa || !p.rigg) continue;
      fyrPlass(c, p, steg, takt, t, sl);
    }
  }

  /* ---------- rigg og transport ---------- */

  var ctx = null, rigg = null, plasser = [], bpm = 92;
  var spiller = false, steg = 0, takt = 0, nesteTid = 0, klokke = null;
  var stegKo = [];                 // (steg, tid) som visningen tømmer i takt

  function lydsesjon(type) {
    /* iOS stummer all WebAudio når ringelydbryteren står på stille, med
       mindre sesjonen sier at dette er avspilling. Uten dette virker appen
       helt ødelagt på en iPad der bryteren står feil vei. */
    try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) {}
  }

  function lagRigg(c) {
    var m = c.createGain();
    m.gain.value = 0.9;
    var lim = c.createDynamicsCompressor();
    /* Rask angrepstid og høyt forhold, altså en begrenser og ikke en
       kompressor. Med 3 ms angrep slapp transientene fra flere trommer på
       samme steg gjennom før den rakk å ta tak, og toppen traff 1,0 — som er
       hørbar klipping i eksportfila. */
    lim.threshold.value = -7; lim.knee.value = 4; lim.ratio.value = 20;
    lim.attack.value = 0.001; lim.release.value = 0.18;
    var an = c.createAnalyser();
    an.fftSize = 512; an.smoothingTimeConstant = 0.72;
    m.connect(lim); lim.connect(an); an.connect(c.destination);
    return { master: m, lim: lim, analyse: an };
  }

  function start() {
    if (!ctx) {
      lydsesjon('playback');
      ctx = new AC({ latencyHint: 'interactive' });
      rigg = lagRigg(ctx);
      /* Safari krever at noe faktisk spilles av inne i et trykk før
         konteksten regnes som låst opp. Ett stille sample holder. */
      var b = ctx.createBuffer(1, 1, ctx.sampleRate);
      var s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    }
    if (ctx.state !== 'running') ctx.resume();
    return ctx;
  }

  function sikreKjeder() {
    for (var i = 0; i < plasser.length; i++) {
      if (!plasser[i].rigg) plasser[i].rigg = byggKjede(ctx, plasser[i], rigg.master, bpm);
    }
  }

  function planlegg() {
    while (nesteTid < ctx.currentTime + FRAMSYN) {
      fyrSteg(ctx, plasser, steg, takt, nesteTid, bpm);
      stegKo.push({ steg: steg, tid: nesteTid });
      nesteTid += 60 / bpm / 4;
      steg++;
      if (steg >= STEG) { steg = 0; takt++; }
    }
  }

  function spill() {
    start();
    sikreKjeder();
    spiller = true; steg = 0; takt = 0;
    nesteTid = ctx.currentTime + 0.08;
    stegKo.length = 0;
    if (klokke) clearInterval(klokke);
    klokke = setInterval(planlegg, TIKK);
    planlegg();
  }

  function stopp() {
    spiller = false;
    if (klokke) { clearInterval(klokke); klokke = null; }
    stegKo.length = 0;
  }

  /* Demping brukes under opptak. Beatet skal ikke lekke inn i mikrofonen —
     barna får takten som lys i stedet, og opptaket blir rent. */
  function demp(av) {
    if (!rigg) return;
    var t = ctx.currentTime;
    rigg.master.gain.cancelScheduledValues(t);
    rigg.master.gain.setTargetAtTime(av ? 0.0001 : 0.9, t, 0.03);
  }

  function settBpm(v) {
    bpm = Math.max(60, Math.min(160, Math.round(v)));
    /* Ekkoet er knyttet til tempoet, så den kjeden må bygges på nytt.
       delayTime kan ikke bare skrus på uten at halen glipper. */
    if (!ctx) return;
    plasser.forEach(function (p) {
      if (p.kind === 'stemme' && effekt(p.effekt).tempoknyttet && p.rigg) {
        rivKjede(p.rigg);
        p.rigg = byggKjede(ctx, p, rigg.master, bpm);
      }
    });
  }

  /* Bytte av grunnbeat trer i kraft ved neste steg som planlegges — ingenting
     må stoppes eller bygges om. Tempoet følger som regel med, siden en
     diskobeat på 92 slag låter søvnig og en trap-beat på 128 låter stresset;
     den som allerede har stilt tempoet selv kan be om å få beholde det. */
  function settGrunnbeat(id, ogsaaTempo) {
    grunnbeat = finnGrunnbeat(id);
    if (ogsaaTempo !== false) settBpm(grunnbeat.bpm);
    return grunnbeat;
  }

  function plassEndret(p) {
    if (!ctx) return;
    if (p.rigg) rivKjede(p.rigg);
    p.rigg = byggKjede(ctx, p, rigg.master, bpm);
  }

  /* Ett enkelt trykk skal gi lyd med én gang, også når transporten står
     stille. Ellers tror barnet at monsteret er ødelagt. */
  function smak(p) {
    start();
    sikreKjeder();
    var t = ctx.currentTime + 0.02, sl = 60 / bpm / 4;
    if (p.kind === 'trommer') {
      var d = p.def;
      var spor = grunnbeat.spor[d.id];
      if (d.teppe) teppe(ctx, t, p.rigg.hode, 1, sl * 8);
      else if (d.tonal) {
        // første tone i sporet, så smaksprøven stemmer med det man faktisk får
        var forste = 'A2';
        for (var i = 0; spor && i < spor.length; i++) if (spor[i]) { forste = spor[i]; break; }
        d.slag(ctx, t, p.rigg.hode, 1, N[forste], sl * 2);
      } else d.slag(ctx, t, p.rigg.hode, 1, 'x');
    } else if (p.buffer) {
      spillStemme(ctx, p, t, effekt(p.effekt), 0, sl);
    }
    p.sistSpilt = t;
  }

  /* Forhåndslytting på opptaksskjermen: samme lyd, samme effektkjede, men
     utenfor brettet. */
  var proveRigg = null, proveFor = null;
  function prov(buffer, effektId) {
    start();
    if (!proveRigg || proveFor !== effektId) {
      rivKjede(proveRigg);
      proveRigg = byggKjede(ctx, { kind: 'stemme', effekt: effektId, volum: 1, pan: 0 },
        rigg.master, bpm);
      proveFor = effektId;
    }
    var p = { kind: 'stemme', effekt: effektId, buffer: buffer, rigg: proveRigg };
    spillStemme(ctx, p, ctx.currentTime + 0.02, effekt(effektId), 0, 60 / bpm / 4);
    return proveRigg.analyse;
  }

  /* ---------- eksport ---------- */

  function wav(buffer) {
    var kanaler = Math.min(2, buffer.numberOfChannels), n = buffer.length;
    var data = [];
    for (var ch = 0; ch < kanaler; ch++) data.push(buffer.getChannelData(ch));
    var bytes = 44 + n * kanaler * 2;
    var b = new ArrayBuffer(bytes), v = new DataView(b), o = 0;
    function s(tekst) { for (var i = 0; i < tekst.length; i++) v.setUint8(o++, tekst.charCodeAt(i)); }
    function u32(x) { v.setUint32(o, x, true); o += 4; }
    function u16(x) { v.setUint16(o, x, true); o += 2; }
    s('RIFF'); u32(bytes - 8); s('WAVE'); s('fmt '); u32(16); u16(1); u16(kanaler);
    u32(buffer.sampleRate); u32(buffer.sampleRate * kanaler * 2); u16(kanaler * 2); u16(16);
    s('data'); u32(n * kanaler * 2);
    for (var i = 0; i < n; i++) {
      for (var c2 = 0; c2 < kanaler; c2++) {
        var x = Math.max(-1, Math.min(1, data[c2][i]));
        v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
        o += 2;
      }
    }
    return new Blob([b], { type: 'audio/wav' });
  }

  function eksporter(takter) {
    var sr = ctx ? ctx.sampleRate : 44100;
    var sl = 60 / bpm / 4;
    var total = takter * 16 * sl + 2.5;
    var oc = new OAC(2, Math.ceil(total * sr), sr);
    var orig = lagRigg(oc);
    var kopier = plasser.filter(function (p) {
      return p.paa && (p.kind === 'trommer' || p.buffer);
    }).map(function (p) {
      /* Object.create arver buffer, mønster og effektvalg, men får sin egen
         rigg. Uten det ville eksporten koblet seg til de levende nodene. */
      var k = Object.create(p);
      k.rigg = byggKjede(oc, p, orig.master, bpm);
      return k;
    });
    var t0 = 0.08;
    for (var i = 0; i < takter * 16; i++) {
      fyrSteg(oc, kopier, i % 16, Math.floor(i / 16), t0 + i * sl, bpm);
    }
    var slutt = t0 + takter * 16 * sl;
    orig.master.gain.setValueAtTime(0.9, slutt);
    orig.master.gain.linearRampToValueAtTime(0.0001, slutt + 1.3);
    return oc.startRendering().then(function (buf) { return wav(buf); });
  }

  return {
    BEATS: BEATS, EFFEKTER: EFFEKTER, RYTMER: RYTMER, STEG: STEG,
    GRUNNBEATS: GRUNNBEATS,
    effekt: effekt, rytme: rytme, wav: wav, lydsesjon: lydsesjon,
    start: start, spill: spill, stopp: stopp, demp: demp,
    settBpm: settBpm, settGrunnbeat: settGrunnbeat,
    leggTilGrunnbeat: leggTilGrunnbeat, fjernGrunnbeat: fjernGrunnbeat,
    plassEndret: plassEndret,
    smak: smak, prov: prov,
    eksporter: eksporter, sikreKjeder: sikreKjeder,
    get ctx() { return ctx; },
    get rigg() { return rigg; },
    get spiller() { return spiller; },
    get bpm() { return bpm; },
    get grunnbeat() { return grunnbeat; },
    get stegKo() { return stegKo; },
    get plasser() { return plasser; },
    set plasser(v) { plasser = v; }
  };
})();
