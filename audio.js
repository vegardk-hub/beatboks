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

  function rare(c, t, ut, v, tegn) {
    if (tegn === 'r') kant(c, t, ut, v); else bjelle(c, t, ut, v);
  }

  /* ---------- byggeklosser for de andre verdenene ---------- */

  /* En tone som faller i tonehøyde mens den dør ut. Nesten alle trommer som
     har kropp — kick, djembe, bongo, tromme i en tv-spillmaskin — er dette. */
  function fall(c, t, ut, v, fra, til, fallTid, forfall, type) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(fra, t);
    o.frequency.exponentialRampToValueAtTime(til, t + fallTid);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + forfall);
    o.connect(g); g.connect(ut);
    o.start(t); o.stop(t + forfall + 0.02);
  }

  function stoyStot(c, t, ut, v, type, hz, q, forfall) {
    var s = stoyKilde(c, t, forfall + 0.05), f = c.createBiquadFilter();
    var g = hylster(c, t, v, 0.001, forfall);
    f.type = type; f.frequency.value = hz;
    if (q) f.Q.value = q;
    s.connect(f); f.connect(g); g.connect(ut);
    s.stop(t + forfall + 0.06);
  }

  // én enkel tone med hylster; oscillatoren returneres så tonehøyden kan bøyes
  function tone(c, t, ut, type, hz, topp, angrep, forfall) {
    var o = c.createOscillator(), g = hylster(c, t, topp, angrep, forfall);
    o.type = type; o.frequency.value = hz;
    o.connect(g); g.connect(ut);
    o.start(t); o.stop(t + angrep + forfall + 0.02);
    return o;
  }

  /* Hylster for toner som skal HOLDES — bass, melodi, akkorder. Tonen står
     like sterk til den skal slippes, og .slutt sier når kilden kan stoppes. */
  function holdt(c, t, topp, angrep, lengde, slipp) {
    var g = c.createGain(), hold = t + Math.max(angrep + 0.005, lengde);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(topp, t + angrep);
    g.gain.setValueAtTime(topp, hold);
    g.gain.exponentialRampToValueAtTime(0.0001, hold + slipp);
    g.slutt = hold + slipp + 0.02;
    return g;
  }

  var kurveLager = {};
  function mykVreng(styrke) {
    return kurveLager[styrke] || (kurveLager[styrke] = vrengKurve(styrke));
  }

  /* Pulsbølgen med smal puls er hele lyden til gamle tv-spill. WebAudio har
     bare firkant (50 %), så den smale bygges av overtoner — én gang per
     kontekst. */
  function puls(c, andel) {
    var k = '_puls' + andel;
    if (c[k]) return c[k];
    var n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (var i = 1; i < n; i++) re[i] = 2 / (i * Math.PI) * Math.sin(i * Math.PI * andel);
    c[k] = c.createPeriodicWave(re, im);
    return c[k];
  }

  /* Tv-spillstøy: tilfeldig pluss eller minus, holdt i noen sampler om
     gangen. Det er den grove, knasende støyen som skiller en 8-bit-tromme
     fra en ekte. */
  var pikselLager = {};
  function pikselKilde(c, t, lengde, fart) {
    var k = String(c.sampleRate);
    if (!pikselLager[k]) {
      var n = Math.floor(c.sampleRate), b = c.createBuffer(1, n, c.sampleRate);
      var d = b.getChannelData(0), hold = Math.max(2, Math.round(c.sampleRate / 11000)), x = 1;
      for (var i = 0; i < n; i++) {
        if (i % hold === 0) x = Math.random() < 0.5 ? -1 : 1;
        d[i] = x;
      }
      pikselLager[k] = b;
    }
    var s = c.createBufferSource();
    s.buffer = pikselLager[k];
    s.loop = true;
    s.playbackRate.value = fart || 1;
    s.start(t, Math.random() * 0.8, lengde);
    return s;
  }

  /* ---------- ROMBASE: robotene ---------- */

  function botdunk(c, t, ut, v) {
    /* Litt vrenging gir kicken overtoner. Uten dem forsvinner en 808-kick
       helt i en nettbretthøyttaler — den består nesten bare av 40 Hz. */
    var vr = c.createWaveShaper(), etter = c.createGain();
    vr.curve = mykVreng(4);
    /* Vrengingen løfter de svake delene mest, så halen ble like høy som
       slaget. Nivået tas ned ETTER vrengingen, der det ikke endrer klangen. */
    etter.gain.value = 0.45;
    vr.connect(etter); etter.connect(ut);
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    g.gain.setValueAtTime(v * 0.9, t);
    g.gain.setValueAtTime(v * 0.9, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    o.connect(g); g.connect(vr);
    o.start(t); o.stop(t + 0.39);
    tone(c, t, ut, 'square', 1250, v * 0.2, 0.001, 0.015);
  }

  function laser(c, t, ut, v) {
    var o = c.createOscillator(), f = c.createBiquadFilter(), g = hylster(c, t, v * 0.3, 0.002, 0.17);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(2800, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.17);
    f.type = 'lowpass'; f.frequency.value = 4500; f.Q.value = 5;
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o.stop(t + 0.2);
    stoyStot(c, t, ut, v * 0.42, 'highpass', 2200, 0, 0.09);   // tyngde på baktakten
  }

  function pipp(c, t, ut, v) {
    // tre firkanttoner som ikke står i forhold til hverandre gir metall
    var f = c.createBiquadFilter(), g = hylster(c, t, v * 0.2, 0.001, v > 0.9 ? 0.05 : 0.028);
    f.type = 'highpass'; f.frequency.value = 5200;
    [3140, 4730, 6190].forEach(function (hz) {
      var o = c.createOscillator();
      o.type = 'square'; o.frequency.value = hz;
      o.connect(f); o.start(t); o.stop(t + 0.07);
    });
    f.connect(g); g.connect(ut);
  }

  function robobass(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), f = c.createBiquadFilter();
    var g = holdt(c, t, v * 0.22, 0.005, lengde * 0.8, 0.05);
    o.type = 'square'; o.frequency.value = hz;
    // filteret som lukker seg fort er «wow»-et i robotbassen
    f.type = 'lowpass'; f.Q.value = 11;
    f.frequency.setValueAtTime(Math.min(hz * 22, 3800), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(hz * 2, 120), t + 0.14);
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o.stop(g.slutt);
  }

  function dataBlipp(c, t, ut, v, hz) {
    var f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 3200;
    f.connect(ut);
    tone(c, t, f, 'square', hz, v * 0.13, 0.002, 0.06);
  }

  function radar(c, t, ut, v, hz) {
    // pinget og to ekko som svarer fra langt borte
    [0, 0.3, 0.6].forEach(function (fra, i) {
      tone(c, t + fra, ut, 'sine', hz, v * 0.2 * Math.pow(0.4, i), 0.003, 0.7);
    });
  }

  /* ---------- JUNGEL: trommer av skinn og tre ---------- */

  function tromme(c, t, ut, v) {
    fall(c, t, ut, v * 0.95, 125, 68, 0.07, 0.38);
    stoyStot(c, t, ut, v * 0.3, 'bandpass', 900, 1.1, 0.045);   // håndflaten mot skinnet
  }

  function bongo(c, t, ut, v, tegn) {
    // h = den lyse bongoen, l = den dype
    var hz = tegn === 'l' ? 290 : 410;
    fall(c, t, ut, v * 0.5, hz * 1.3, hz, 0.02, 0.17);
    stoyStot(c, t, ut, v * 0.14, 'bandpass', 3200, 1.5, 0.02);
  }

  function rasle(c, t, ut, v) {
    var s = stoyKilde(c, t, 0.1), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = 6500; f.Q.value = 0.9;
    // myk start: frøene i en rasle treffer ikke veggen samtidig
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.34, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 0.1);
  }

  function klave(c, t, ut, v) {
    tone(c, t, ut, 'sine', 2480, v * 0.34, 0.0008, 0.055);
    tone(c, t, ut, 'triangle', 1240, v * 0.12, 0.0008, 0.03);
  }

  function marimba(c, t, ut, v, hz) {
    // grunntonen synger, overtonen fire ganger over er slaget av køllen
    tone(c, t, ut, 'sine', hz, v * 0.28, 0.003, 0.55);
    tone(c, t, ut, 'sine', hz * 4, v * 0.09, 0.001, 0.07);
    tone(c, t, ut, 'sine', hz * 9.9, v * 0.025, 0.001, 0.025);
  }

  function gorilla(c, t, ut, v, hz, lengde) {
    var f = c.createBiquadFilter();
    var g = holdt(c, t, v * 0.45, 0.004, Math.min(lengde, 0.35) * 0.5, 0.18);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.25);
    var o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain();
    o.type = 'triangle'; o.frequency.value = hz;
    // oktaven over er det nettbrettet faktisk klarer å spille
    o2.type = 'sine'; o2.frequency.value = hz * 2; g2.gain.value = 0.4;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o2.start(t); o.stop(g.slutt); o2.stop(g.slutt);
  }

  function papegoye(c, t, ut, v, tegn) {
    if (tegn === 'o') {             // en lang plystring nedover
      var o = tone(c, t, ut, 'sine', 2700, 0.13, 0.02, 0.32);
      o.frequency.setValueAtTime(2700, t);
      o.frequency.exponentialRampToValueAtTime(1600, t + 0.3);
      return;
    }
    [0, 0.085].forEach(function (fra) {           // kvitt-kvitt
      var o2 = tone(c, t + fra, ut, 'sine', 1900, v * 0.14, 0.004, 0.06);
      o2.frequency.setValueAtTime(1900, t + fra);
      o2.frequency.exponentialRampToValueAtTime(3400, t + fra + 0.05);
    });
  }

  /* ---------- HAVDYP: alt låter som det er under vann ---------- */

  function anker(c, t, ut, v) {
    fall(c, t, ut, v * 0.95, 105, 46, 0.12, 0.6);
    fall(c, t, ut, v * 0.25, 210, 92, 0.12, 0.2);      // oktaven over, for nettbrettet
    stoyStot(c, t, ut, v * 0.2, 'lowpass', 500, 0, 0.05);
  }

  function krabbe(c, t, ut, v) {
    // to klypeklikk tett etter hverandre, og en liten klang fra skallet
    [0, 0.024].forEach(function (fra, i) {
      stoyStot(c, t + fra, ut, v * (i ? 0.32 : 0.46), 'highpass', 2400, 0, 0.022);
      tone(c, t + fra, ut, 'square', 1150 - i * 150, v * 0.1, 0.0005, 0.014);
    });
    stoyStot(c, t + 0.03, ut, v * 0.16, 'bandpass', 1700, 6, 0.12);
  }

  function bobler(c, t, ut, v) {
    /* En boble er en tone som stiger fort — det er luftlommen som krymper
       mens den går oppover. Antall og tonehøyde er tilfeldig hver gang, for
       ingen bobler er like. */
    var n = 3 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var tt = t + i * 0.034 + Math.random() * 0.01, hz = 450 + Math.random() * 650;
      var o = tone(c, tt, ut, 'sine', hz, v * 0.2, 0.002, 0.045);
      o.frequency.setValueAtTime(hz, tt);
      o.frequency.exponentialRampToValueAtTime(hz * 2.3, tt + 0.04);
    }
  }

  function hval(c, t, ut, v, hz, lengde) {
    // glir opp til tonen og svever der: det er hvalsang og ikke en fløyte
    var o = c.createOscillator(), lfo = c.createOscillator(), dybde = c.createGain();
    var f = c.createBiquadFilter(), g = holdt(c, t, v * 0.19, 0.3, lengde * 0.85, 0.45);
    o.type = 'triangle';
    o.frequency.setValueAtTime(hz * 0.78, t);
    o.frequency.exponentialRampToValueAtTime(hz, t + 0.4);
    lfo.frequency.value = 4.2; dybde.gain.value = hz * 0.014;
    lfo.connect(dybde); dybde.connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 1400;
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(g.slutt); lfo.stop(g.slutt);
  }

  function blekk(c, t, ut, v, hz, lengde) {
    var vr = c.createWaveShaper(), etter = c.createGain();
    var g = holdt(c, t, v * 0.55, 0.01, lengde * 0.85, 0.12);
    vr.curve = mykVreng(3);
    etter.gain.value = 0.24;          // vrengingen gir mye nivå; det tas ned etterpå
    var o = c.createOscillator();
    o.type = 'sine'; o.frequency.value = hz;
    o.connect(g); g.connect(vr); vr.connect(etter); etter.connect(ut);
    o.start(t); o.stop(g.slutt);
  }

  function skjell(c, t, ut, v, hz) {
    /* FM: en tone som vrir på en annen. Moduleringen dør ut raskere enn
       tonen, så anslaget er glass og halen er ren — som et skjell som klinger. */
    var o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain();
    var g = hylster(c, t, v * 0.16, 0.003, 1.3);
    o.type = 'sine'; o.frequency.value = hz;
    m.type = 'sine'; m.frequency.value = hz * 3.5;
    mg.gain.setValueAtTime(hz * 1.4, t);
    mg.gain.exponentialRampToValueAtTime(hz * 0.02, t + 0.5);
    m.connect(mg); mg.connect(o.frequency);
    o.connect(g); g.connect(ut);
    o.start(t); m.start(t); o.stop(t + 1.35); m.stop(t + 1.35);
  }

  /* ---------- PIXEL: et gammelt tv-spill ---------- */

  function blokk(c, t, ut, v) {
    fall(c, t, ut, v * 0.9, 240, 48, 0.07, 0.2, 'triangle');
    var s = pikselKilde(c, t, 0.03, 1), g = hylster(c, t, v * 0.14, 0.001, 0.02);
    s.connect(g); g.connect(ut); s.stop(t + 0.04);
  }

  function pang(c, t, ut, v) {
    var s = pikselKilde(c, t, 0.2, 1), f = c.createBiquadFilter(), g = hylster(c, t, v * 0.26, 0.001, 0.15);
    f.type = 'lowpass'; f.frequency.value = 6000;
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 0.2);
    var o = tone(c, t, ut, 'square', 220, v * 0.14, 0.001, 0.05);
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.05);
  }

  function piks(c, t, ut, v) {
    var s = pikselKilde(c, t, 0.06, 2), f = c.createBiquadFilter(), g = hylster(c, t, v * 0.16, 0.001, 0.028);
    f.type = 'highpass'; f.frequency.value = 7000;
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 0.06);
  }

  function bitbass(c, t, ut, v, hz, lengde) {
    /* Trekantbølgen er bassen i gamle spillkonsoller. Den alene er for dyp
       for et nettbrett, så en dempet firkant legger til det som gjør at den
       høres. */
    var g = holdt(c, t, v * 0.26, 0.002, lengde * 0.85, 0.02);
    var o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g2 = c.createGain();
    o.type = 'triangle'; o.frequency.value = hz;
    o2.type = 'square'; o2.frequency.value = hz;
    f.type = 'lowpass'; f.frequency.value = 900;
    g2.gain.value = 0.22;
    o.connect(g); o2.connect(f); f.connect(g2); g2.connect(g); g.connect(ut);
    o.start(t); o2.start(t); o.stop(g.slutt); o2.stop(g.slutt);
  }

  function pling(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), lfo = c.createOscillator(), dybde = c.createGain();
    var g = holdt(c, t, v * 0.16, 0.004, lengde * 0.85, 0.05);
    o.setPeriodicWave(puls(c, 0.25)); o.frequency.value = hz;
    // vibratoen kommer etter litt, akkurat som i spillmusikken
    lfo.frequency.value = 6;
    dybde.gain.setValueAtTime(0, t);
    dybde.gain.linearRampToValueAtTime(hz * 0.02, t + 0.25);
    lfo.connect(dybde); dybde.connect(o.frequency);
    o.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(g.slutt); lfo.stop(g.slutt);
  }

  function mynt(c, t, ut, v) {
    // to toner, den andre en kvart opp — lyden alle barn kjenner igjen
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(987.77, t);
    o.frequency.setValueAtTime(1318.51, t + 0.07);
    g.gain.setValueAtTime(v * 0.16, t);
    g.gain.setValueAtTime(v * 0.16, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g); g.connect(ut); o.start(t); o.stop(t + 0.45);
  }

  function hopp(c, t, ut, v) {
    var o = c.createOscillator(), g = hylster(c, t, v * 0.17, 0.003, 0.18);
    o.setPeriodicWave(puls(c, 0.25));
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.15);
    o.connect(g); g.connect(ut); o.start(t); o.stop(t + 0.2);
  }

  /* ---------- SPØKELSE: det knirker i det gamle huset ---------- */

  function stamp(c, t, ut, v) {
    fall(c, t, ut, v * 0.95, 130, 42, 0.14, 0.55);
    stoyStot(c, t, ut, v * 0.42, 'lowpass', 320, 0, 0.12);     // foten mot tregulvet
    stoyStot(c, t, ut, v * 0.12, 'bandpass', 1800, 1, 0.03);
  }

  function knirk(c, t, ut, v) {
    /* Et knirk er en rekke små smell som kommer ujevnt og stadig tettere.
       Derfor hopper tonehøyden tilfeldig mens den kryper oppover — en jevn
       tone ville hørtes ut som en fiolin, ikke en dør. */
    var o = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
    var g = c.createGain(), lengde = 0.34, hz = 55;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(hz, t);
    for (var tt = 0.012; tt < lengde; tt += 0.011 + Math.random() * 0.012) {
      hz = Math.max(45, Math.min(150, hz * (0.94 + Math.random() * 0.2)));
      o.frequency.setValueAtTime(hz, t + tt);
    }
    f1.type = 'bandpass'; f1.frequency.value = 1100; f1.Q.value = 4;
    f2.type = 'bandpass'; f2.frequency.value = 2500; f2.Q.value = 5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.9, t + 0.015);
    g.gain.setValueAtTime(v * 0.9, t + lengde * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(ut);
    o.start(t); o.stop(t + lengde + 0.02);
    stoyStot(c, t, ut, v * 0.28, 'bandpass', 1500, 0.8, 0.07);     // selve slaget i døra
  }

  function klirr(c, t, ut, v) {
    [0, 0.022].forEach(function (fra, i) {
      var tt = t + fra, s = stoyKilde(c, tt, 0.08), g = hylster(c, tt, v * (i ? 0.75 : 1), 0.001, 0.05);
      [4300, 6800].forEach(function (hz) {
        var f = c.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = hz * (1 + Math.random() * 0.06); f.Q.value = 9;
        s.connect(f); f.connect(g);
      });
      g.connect(ut); s.stop(tt + 0.08);
    });
  }

  function orgel(c, t, ut, v, hz, lengde) {
    var akkord = Array.isArray(hz) ? hz : [hz];
    var g = holdt(c, t, v * 0.075, 0.12, lengde * 0.92, 0.35);
    var f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2400;
    f.connect(g); g.connect(ut);
    // orgelpipene: grunntonen og tre overtoner, svakere og svakere
    akkord.forEach(function (grunn) {
      [[1, 1], [2, 0.5], [3, 0.3], [4, 0.2]].forEach(function (d) {
        var o = c.createOscillator(), og = c.createGain();
        o.type = 'sine'; o.frequency.value = grunn * d[0]; og.gain.value = d[1];
        o.connect(og); og.connect(f); o.start(t); o.stop(g.slutt);
      });
    });
  }

  function huuu(c, t, ut, v, hz, lengde) {
    // en theremin: glir inn i tonen og skjelver
    var o = c.createOscillator(), lfo = c.createOscillator(), dybde = c.createGain();
    var g = holdt(c, t, v * 0.2, 0.09, lengde * 0.9, 0.25);
    o.type = 'sine';
    o.frequency.setValueAtTime(hz * 0.93, t);
    o.frequency.exponentialRampToValueAtTime(hz, t + 0.12);
    lfo.frequency.value = 6.2; dybde.gain.value = hz * 0.013;
    lfo.connect(dybde); dybde.connect(o.frequency);
    o.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(g.slutt); lfo.stop(g.slutt);
  }

  function klokke(c, t, ut, v, hz) {
    /* Overtonene i en kirkeklokke står IKKE i hele tall til hverandre. Det er
       derfor den låter som metall og ikke som et piano. */
    [[0.5, 0.5, 3.2], [1, 1, 2.6], [1.19, 0.6, 1.8], [1.56, 0.45, 1.4],
      [2, 0.5, 1.2], [2.66, 0.3, 0.8], [3.01, 0.25, 0.6]].forEach(function (d) {
      tone(c, t, ut, 'sine', hz * d[0], v * 0.12 * d[1], 0.002, d[2]);
    });
  }

  function flaggermus(c, t, ut, v) {
    [0, 0.05, 0.1].forEach(function (fra) {
      var o = tone(c, t + fra, ut, 'sine', 3300, v * 0.15, 0.002, 0.03);
      o.frequency.setValueAtTime(3300, t + fra);
      o.frequency.exponentialRampToValueAtTime(5200, t + fra + 0.03);
    });
  }

  /* ---------- DRAGEHULE: store trommer i en hule full av ild ---------- */

  function taiko(c, t, ut, v) {
    fall(c, t, ut, v * 0.95, 95, 52, 0.1, 0.7);
    stoyStot(c, t, ut, v * 0.35, 'lowpass', 700, 0, 0.25);     // skinnet som dirrer
    stoyStot(c, t, ut, v * 0.15, 'bandpass', 2200, 1, 0.02);   // køllen
  }

  function skjold(c, t, ut, v) {
    // et sverd mot et skjold: metallklang med en støyhale
    stoyStot(c, t, ut, v * 0.5, 'bandpass', 1900, 2.5, 0.18);
    [340, 523, 767].forEach(function (hz) { tone(c, t, ut, 'square', hz, v * 0.05, 0.001, 0.12); });
    stoyStot(c, t, ut, v * 0.3, 'highpass', 3000, 0, 0.06);
  }

  function glor(c, t, ut, v) {
    // gnister fra bålet: noen bittesmå klikk på tilfeldige steder
    for (var i = 0; i < 4; i++) {
      var tt = t + Math.random() * 0.07;
      stoyStot(c, tt, ut, v * (0.3 + Math.random() * 0.35), 'highpass', 4000 + Math.random() * 3000, 0, 0.006);
    }
  }

  function vingeslag(c, t, ut, v) {
    [0, 0.14].forEach(function (fra) {
      var s = stoyKilde(c, t + fra, 0.14), f = c.createBiquadFilter(), g = hylster(c, t + fra, v * 1.5, 0.03, 0.09);
      f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(250, t + fra);
      f.frequency.exponentialRampToValueAtTime(900, t + fra + 0.1);
      s.connect(f); f.connect(g); g.connect(ut); s.stop(t + fra + 0.14);
    });
  }

  function ildpust(c, t, ut, v) {
    // et sus som åpner seg: filteret går opp mens flammen kommer, og ned igjen
    var s = stoyKilde(c, t, 1.1), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3500, t + 0.5);
    f.frequency.exponentialRampToValueAtTime(600, t + 1.0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.8, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 1.1);
  }

  function horn(c, t, ut, v, hz, lengde) {
    // messing: sagtann der filteret åpner seg i anslaget, som når en blåser tar i
    var o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter();
    var g = holdt(c, t, v * 0.14, 0.06, lengde * 0.9, 0.2);
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.value = hz; o2.frequency.value = hz * 1.004;
    f.type = 'lowpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(hz * 1.5, t);
    f.frequency.linearRampToValueAtTime(hz * 5, t + 0.12);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o2.start(t); o.stop(g.slutt); o2.stop(g.slutt);
  }

  function brumm(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter();
    var g = holdt(c, t, v * 0.16, 0.2, lengde * 0.9, 0.3);
    o.type = 'sawtooth'; o.frequency.value = hz;
    o2.type = 'sawtooth'; o2.frequency.value = hz * 2.003;
    f.type = 'lowpass'; f.frequency.value = 420;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o2.start(t); o.stop(g.slutt); o2.stop(g.slutt);
  }

  /* ---------- FABRIKK: robotene jobber i takt ---------- */

  function hammer(c, t, ut, v) {
    fall(c, t, ut, v * 0.95, 130, 48, 0.09, 0.35);
    tone(c, t, ut, 'triangle', 2350, v * 0.18, 0.001, 0.12);    // «tink» fra ambolten
    tone(c, t, ut, 'sine', 3480, v * 0.08, 0.001, 0.08);
  }

  function damp(c, t, ut, v) {
    // trykkluft: et kort psst som faller fort, med et dunk under
    var s = stoyKilde(c, t, 0.2), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = 3500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.55, t + 0.004);
    g.gain.exponentialRampToValueAtTime(v * 0.12, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 0.2);
    fall(c, t, ut, v * 0.35, 190, 120, 0.04, 0.1);
  }

  function tannhjul(c, t, ut, v) {
    tone(c, t, ut, 'square', v > 0.9 ? 3100 : 2600, v * 0.16, 0.0005, 0.012);
    stoyStot(c, t, ut, v * 0.35, 'highpass', 6000, 0, 0.015);
  }

  function wahbass(c, t, ut, v, hz, lengde) {
    // funkbass: filteret feier opp og ned igjen — «wah»
    var o = c.createOscillator(), f = c.createBiquadFilter();
    var g = holdt(c, t, v * 1.1, 0.005, lengde * 0.8, 0.06);
    o.type = 'sawtooth'; o.frequency.value = hz;
    f.type = 'bandpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(hz * 2, t);
    f.frequency.exponentialRampToValueAtTime(hz * 10, t + 0.08);
    f.frequency.exponentialRampToValueAtTime(hz * 3, t + 0.22);
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o.stop(g.slutt);
  }

  function ambolt(c, t, ut, v, hz) {
    tone(c, t, ut, 'sine', hz, v * 0.18, 0.001, 0.6);
    tone(c, t, ut, 'sine', hz * 2.76, v * 0.08, 0.001, 0.25);
    tone(c, t, ut, 'sine', hz * 5.4, v * 0.04, 0.001, 0.1);
  }

  function pratebot(c, t, ut, v, hz, lengde) {
    /* En robot som snakker: firkanttonen går gjennom to «munnformer» (filtre
       på vokalfrekvenser) som bytter midt i tonen — o blir til i, «bo-ip». */
    var o = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
    var g = holdt(c, t, v * 0.5, 0.01, lengde * 0.85, 0.05);
    o.type = 'square'; o.frequency.value = hz;
    f1.type = 'bandpass'; f1.Q.value = 7; f2.type = 'bandpass'; f2.Q.value = 9;
    f1.frequency.setValueAtTime(500, t); f2.frequency.setValueAtTime(900, t);
    f1.frequency.setValueAtTime(300, t + lengde * 0.45); f2.frequency.setValueAtTime(2300, t + lengde * 0.45);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(ut);
    o.start(t); o.stop(g.slutt);
  }

  function floyte(c, t, ut, v, hz, lengde) {
    // dampfløyta: to toner som ikke helt stemmer, og luft oppå
    var g = holdt(c, t, v * 0.09, 0.06, lengde * 0.9, 0.3);
    [1, 1.19].forEach(function (k) {
      var o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(hz * k * 0.9, t);
      o.frequency.exponentialRampToValueAtTime(hz * k, t + 0.12);
      o.connect(g); o.start(t); o.stop(g.slutt);
    });
    g.connect(ut);
    stoyStot(c, t, ut, v * 0.06, 'bandpass', hz * 2, 3, lengde * 0.8);
  }

  /* ---------- GODTELAND: alt spretter ---------- */

  function sprett(c, t, ut, v) {
    fall(c, t, ut, v * 0.9, 180, 52, 0.08, 0.3);
    var o = tone(c, t, ut, 'sine', 900, v * 0.06, 0.002, 0.12);    // «boing» oppå
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.12);
  }

  function knips(c, t, ut, v) {
    stoyStot(c, t, ut, v * 1.0, 'bandpass', 2300, 2.2, 0.035);
    stoyStot(c, t + 0.004, ut, v * 0.3, 'highpass', 5000, 0, 0.02);
  }

  var DRYS = [1396.9, 1568, 1760, 2093, 2349.3];      // F-dur pentaton, høyt oppe
  function drys(c, t, ut, v) {
    // strøssel: en tilfeldig liten tone fra skalaen hver gang, så det glitrer
    var hz = DRYS[Math.floor(Math.random() * DRYS.length)];
    tone(c, t, ut, 'sine', hz, v * 0.22, 0.001, 0.09);
    tone(c, t + 0.03, ut, 'sine', hz * 1.5, v * 0.1, 0.001, 0.06);
  }

  function spilledase(c, t, ut, v, hz) {
    tone(c, t, ut, 'sine', hz, v * 0.18, 0.001, 0.7);
    tone(c, t, ut, 'sine', hz * 3, v * 0.05, 0.001, 0.2);
    tone(c, t, ut, 'sine', hz * 5.4, v * 0.02, 0.001, 0.08);
  }

  function tyggis(c, t, ut, v, hz, lengde) {
    // tyggegummibass: hver tone spretter ned på plass
    var o = c.createOscillator(), f = c.createBiquadFilter();
    var g = holdt(c, t, v * 0.22, 0.004, lengde * 0.8, 0.05);
    o.type = 'square';
    o.frequency.setValueAtTime(hz * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(hz, t + 0.05);
    f.type = 'lowpass'; f.frequency.value = 1200;
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o.stop(g.slutt);
  }

  function pipedyr(c, t, ut, v) {
    [0, 0.16].forEach(function (fra) {
      var o = tone(c, t + fra, ut, 'sine', 900, v * 0.24, 0.005, 0.11);
      o.frequency.setValueAtTime(900, t + fra);
      o.frequency.linearRampToValueAtTime(1600, t + fra + 0.05);
      o.frequency.linearRampToValueAtTime(1000, t + fra + 0.11);
    });
  }

  function popp(c, t, ut, v) {
    var o = tone(c, t, ut, 'sine', 900, v * 0.3, 0.001, 0.05);
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.04);
  }

  /* ---------- DINO: det rister i bakken ---------- */

  function tramp(c, t, ut, v) {
    fall(c, t, ut, v, 80, 32, 0.15, 0.8);
    stoyStot(c, t, ut, v * 0.5, 'lowpass', 180, 0, 0.3);
    stoyStot(c, t, ut, v * 0.15, 'bandpass', 900, 1, 0.04);    // så den høres på nettbrett
  }

  function stein(c, t, ut, v) {
    [0, 0.012].forEach(function (fra, i) {
      stoyStot(c, t + fra, ut, v * (i ? 1.2 : 1.8), 'bandpass', 1300 + i * 900, 3, 0.03);
    });
    tone(c, t, ut, 'triangle', 610, v * 0.25, 0.0005, 0.03);
  }

  function froRasle(c, t, ut, v) {
    var s = stoyKilde(c, t, 0.12), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = 4500; f.Q.value = 1.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.55, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 0.12);
  }

  function knokkel(c, t, ut, v, hz) {
    // xylofon av bein: hul trekant, kort, med et tørt klikk
    tone(c, t, ut, 'triangle', hz, v * 0.25, 0.001, 0.2);
    tone(c, t, ut, 'sine', hz * 3.9, v * 0.06, 0.001, 0.03);
    stoyStot(c, t, ut, v * 0.08, 'bandpass', Math.min(hz * 6, 9000), 2, 0.01);
  }

  function urhorn(c, t, ut, v, hz, lengde) {
    // didgeridoo-aktig: munnformen vugger fram og tilbake mens tonen står
    var o = c.createOscillator(), f = c.createBiquadFilter(), lfo = c.createOscillator(), dybde = c.createGain();
    var g = holdt(c, t, v * 0.9, 0.1, lengde * 0.9, 0.2);
    o.type = 'sawtooth'; o.frequency.value = hz;
    f.type = 'bandpass'; f.Q.value = 4; f.frequency.value = 650;
    lfo.frequency.value = 3.5; dybde.gain.value = 250;
    lfo.connect(dybde); dybde.connect(f.frequency);
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(g.slutt); lfo.stop(g.slutt);
  }

  function vulkan(c, t, ut, v) {
    var s = stoyKilde(c, t, 1.8), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 1;
    f.frequency.setValueAtTime(140, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 1.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 2, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 1.8);
    for (var i = 0; i < 3; i++) {       // steiner som spretter
      stoyStot(c, t + 0.3 + Math.random() * 0.9, ut, v * 0.25, 'bandpass', 700 + Math.random() * 600, 3, 0.03);
    }
  }

  function trex(c, t, ut, v) {
    /* Brølet: en dyp sagtann som skjelver, gjennom et filter som åpner seg —
       og støy oppå for at det skal skrape i halsen. */
    var o = c.createOscillator(), f = c.createBiquadFilter(), lfo = c.createOscillator(), dybde = c.createGain();
    var g = holdt(c, t, v * 0.55, 0.08, 0.45, 0.35);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(75, t + 0.8);
    lfo.frequency.value = 28; dybde.gain.value = 14;
    lfo.connect(dybde); dybde.connect(o.frequency);
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.linearRampToValueAtTime(900, t + 0.3);
    f.frequency.linearRampToValueAtTime(350, t + 0.8);
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(g.slutt); lfo.stop(g.slutt);
    stoyStot(c, t, ut, v * 0.18, 'bandpass', 1400, 1, 0.7);
  }

  /* ---------- VINTERLAND: stille, med bjeller ---------- */

  function snoball(c, t, ut, v) {
    fall(c, t, ut, v * 0.85, 110, 48, 0.1, 0.38);
    stoyStot(c, t, ut, v * 0.25, 'lowpass', 900, 0, 0.06);
  }

  function knas(c, t, ut, v) {
    // snø som knaser: mange små korn etter hverandre, ikke ett smell
    for (var i = 0; i < 5; i++) {
      var tt = t + i * 0.018 + Math.random() * 0.008;
      stoyStot(c, tt, ut, v * (0.55 + Math.random() * 0.35), 'bandpass', 2500 + Math.random() * 2500, 1.5, 0.02);
    }
  }

  function bjeller(c, t, ut, v) {
    for (var i = 0; i < 3; i++) {
      tone(c, t + Math.random() * 0.03, ut, 'sine', 5200 + Math.random() * 1600, v * 0.08, 0.001, 0.12);
    }
    stoyStot(c, t, ut, v * 0.3, 'highpass', 8000, 0, 0.1);
  }

  function isklokke(c, t, ut, v, hz) {
    tone(c, t, ut, 'sine', hz, v * 0.17, 0.001, 1.0);
    tone(c, t, ut, 'sine', hz * 2.76, v * 0.07, 0.001, 0.3);
  }

  function nordlys(c, t, ut, v, hz, lengde) {
    var akkord = Array.isArray(hz) ? hz : [hz];
    var g = holdt(c, t, v * 0.06, 0.5, lengde * 0.9, 0.8), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1800;
    f.connect(g); g.connect(ut);
    akkord.forEach(function (grunn) {
      [1, 1.006].forEach(function (k) {
        var o = c.createOscillator();
        o.type = 'triangle'; o.frequency.value = grunn * k;
        o.connect(f); o.start(t); o.stop(g.slutt);
      });
    });
  }

  function isbjorn(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain(), f = c.createBiquadFilter();
    var g = holdt(c, t, v * 0.24, 0.01, lengde * 0.9, 0.1);
    o.type = 'sine'; o.frequency.value = hz;
    o2.type = 'triangle'; o2.frequency.value = hz * 2; g2.gain.value = 0.3;
    f.type = 'lowpass'; f.frequency.value = 500;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o2.start(t); o.stop(g.slutt); o2.stop(g.slutt);
  }

  function vind(c, t, ut, v) {
    var s = stoyKilde(c, t, 1.6), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.Q.value = 8;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.7);
    f.frequency.exponentialRampToValueAtTime(500, t + 1.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 1.4, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 1.6);
  }

  /* ---------- PIRAT: sjømannssang på dekk ---------- */

  function tonne(c, t, ut, v) {
    fall(c, t, ut, v * 0.9, 140, 62, 0.06, 0.3);
    stoyStot(c, t, ut, v * 0.3, 'bandpass', 600, 1.5, 0.06);
  }

  function kiste(c, t, ut, v) {
    stoyStot(c, t, ut, v * 0.6, 'bandpass', 900, 1.4, 0.07);
    fall(c, t, ut, v * 0.3, 230, 160, 0.03, 0.08, 'triangle');
    stoyStot(c, t, ut, v * 0.25, 'highpass', 2500, 0, 0.05);
  }

  function gull(c, t, ut, v) {
    // mynter som klirrer mot hverandre
    for (var i = 0; i < 3; i++) {
      tone(c, t + i * 0.016 + Math.random() * 0.01, ut, 'sine', 3800 + Math.random() * 2800, v * 0.18, 0.0005, 0.06);
    }
  }

  function tuba(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), f = c.createBiquadFilter();
    var g = holdt(c, t, v * 0.4, 0.02, lengde * 0.75, 0.06);
    o.type = 'sawtooth'; o.frequency.value = hz;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.linearRampToValueAtTime(700, t + 0.05);
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o.stop(g.slutt);
  }

  function trekkspill(c, t, ut, v, hz, lengde) {
    // to tunger per tone som ikke stemmer helt, og belgen som puster (tremolo)
    var akkord = Array.isArray(hz) ? hz : [hz];
    var g = holdt(c, t, v * 0.07, 0.02, lengde * 0.8, 0.06), f = c.createBiquadFilter();
    var trem = c.createGain(), lfo = c.createOscillator(), dybde = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 2200;
    trem.gain.value = 0.8; lfo.frequency.value = 6; dybde.gain.value = 0.2;
    lfo.connect(dybde); dybde.connect(trem.gain);
    f.connect(trem); trem.connect(g); g.connect(ut);
    akkord.forEach(function (grunn) {
      var o = c.createOscillator(), o2 = c.createOscillator();
      o.type = 'square'; o.frequency.value = grunn;
      o2.type = 'sawtooth'; o2.frequency.value = grunn * 1.003;
      o.connect(f); o2.connect(f);
      o.start(t); o2.start(t); o.stop(g.slutt); o2.stop(g.slutt);
    });
    lfo.start(t); lfo.stop(g.slutt);
  }

  function kanon(c, t, ut, v) {
    fall(c, t, ut, v, 70, 30, 0.3, 1.2);
    var s = stoyKilde(c, t, 1), f = c.createBiquadFilter(), g = hylster(c, t, v * 0.7, 0.002, 0.9);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(150, t + 0.8);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 1);
  }

  function maake(c, t, ut, v) {
    [0, 0.22].forEach(function (fra) {
      var o = c.createOscillator(), f = c.createBiquadFilter(), g = hylster(c, t + fra, v * 0.8, 0.01, 0.17);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(900, t + fra);
      o.frequency.linearRampToValueAtTime(1300, t + fra + 0.05);
      o.frequency.linearRampToValueAtTime(800, t + fra + 0.18);
      f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 3;
      o.connect(f); f.connect(g); g.connect(ut);
      o.start(t + fra); o.stop(t + fra + 0.2);
    });
  }


  /* ---------- SUPERHELT: action i C-moll ---------- */

  function pow(c, t, ut, v) {
    var vr = c.createWaveShaper(), etter = c.createGain();
    vr.curve = mykVreng(3);
    etter.gain.value = 0.5;
    vr.connect(etter); etter.connect(ut);
    fall(c, t, vr, v * 0.9, 170, 48, 0.07, 0.32);
    stoyStot(c, t, ut, v * 0.3, 'bandpass', 2500, 1, 0.02);
  }

  function bam(c, t, ut, v) {
    stoyStot(c, t, ut, v * 0.75, 'bandpass', 1800, 0.8, 0.2);
    fall(c, t, ut, v * 0.45, 230, 160, 0.05, 0.12, 'triangle');
    stoyStot(c, t + 0.03, ut, v * 0.2, 'highpass', 4000, 0, 0.25);
  }

  function swish(c, t, ut, v) {
    var s = stoyKilde(c, t, 0.08), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = 6500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 0.08);
  }

  function kappe(c, t, ut, v) {
    // kappa som blafrer forbi: et sus som feier oppover
    var s = stoyKilde(c, t, 0.3), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2500, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.9, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    s.connect(f); f.connect(g); g.connect(ut); s.stop(t + 0.3);
  }

  function fanfare(c, t, ut, v, hz, lengde) {
    // messingstøt: akkorden åpner seg brått og lukker seg igjen
    var akkord = Array.isArray(hz) ? hz : [hz];
    var g = holdt(c, t, v * 0.09, 0.01, lengde * 0.8, 0.1), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.03);
    f.frequency.exponentialRampToValueAtTime(1100, t + 0.25);
    f.connect(g); g.connect(ut);
    akkord.forEach(function (n) {
      [1, 1.006].forEach(function (k) {
        var o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = n * k;
        o.connect(f); o.start(t); o.stop(g.slutt);
      });
    });
  }

  function superbass(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), f = c.createBiquadFilter(), vr = c.createWaveShaper(), etter = c.createGain();
    var g = holdt(c, t, v * 0.5, 0.004, lengde * 0.8, 0.05);
    o.type = 'sawtooth'; o.frequency.value = hz;
    f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.15);
    vr.curve = mykVreng(3); etter.gain.value = 0.35;
    o.connect(f); f.connect(g); g.connect(vr); vr.connect(etter); etter.connect(ut);
    o.start(t); o.stop(g.slutt);
  }

  function zap(c, t, ut, v) {
    var f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 5000; f.connect(ut);
    var o = tone(c, t, f, 'square', 3000, v * 0.2, 0.002, 0.18);
    o.frequency.setValueAtTime(3000, t);
    o.frequency.exponentialRampToValueAtTime(250, t + 0.18);
  }

  /* ---------- BORG: middelalder i D dorisk ---------- */

  function pauke(c, t, ut, v) {
    fall(c, t, ut, v * 0.75, 82, 73, 0.2, 0.9);
    tone(c, t, ut, 'sine', 110, v * 0.12, 0.005, 0.5);     // pauken klinger en kvint over
    stoyStot(c, t, ut, v * 0.25, 'lowpass', 500, 0, 0.15);
    stoyStot(c, t, ut, v * 0.12, 'bandpass', 1400, 1, 0.03);
  }

  function tamburin(c, t, ut, v) {
    for (var i = 0; i < 4; i++) stoyStot(c, t + i * 0.012, ut, v * 0.4, 'highpass', 7000, 0, 0.05);
    fall(c, t, ut, v * 0.3, 300, 220, 0.03, 0.07);
  }

  function hest(c, t, ut, v) {
    // kokosnøttskall mot bordet: den gamle måten å lage hovslag på
    tone(c, t, ut, 'triangle', v > 0.9 ? 780 : 620, v * 0.4, 0.001, 0.05);
    stoyStot(c, t, ut, v * 0.2, 'bandpass', 1500, 4, 0.02);
  }

  function lutt(c, t, ut, v, hz) {
    // en klimpret streng: lys i anslaget, mørkere mens den dør ut
    var f = c.createBiquadFilter(), g = hylster(c, t, v * 0.14, 0.002, 0.6);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3500, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    f.connect(g); g.connect(ut);
    [['sawtooth', 1], ['triangle', 2]].forEach(function (d) {
      var o = c.createOscillator();
      o.type = d[0]; o.frequency.value = hz * d[1];
      o.connect(f); o.start(t); o.stop(t + 0.65);
    });
  }

  function sekkepipe(c, t, ut, v, hz, lengde) {
    // borduntonene: nasal sagtann gjennom et smalt filter, som stemmer i en sekk
    var akkord = Array.isArray(hz) ? hz : [hz];
    var g = holdt(c, t, v * 0.12, 0.1, lengde * 0.95, 0.2), f = c.createBiquadFilter(), lp = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 1.5;
    lp.type = 'lowpass'; lp.frequency.value = 3000;
    f.connect(lp); lp.connect(g); g.connect(ut);
    akkord.forEach(function (n) {
      var o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = n;
      o.connect(f); o.start(t); o.stop(g.slutt);
    });
  }

  function trompet(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), f = c.createBiquadFilter(), lfo = c.createOscillator(), dybde = c.createGain();
    var g = holdt(c, t, v * 0.24, 0.03, lengde * 0.85, 0.1);
    o.type = 'sawtooth'; o.frequency.value = hz;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(hz * 2, t);
    f.frequency.linearRampToValueAtTime(hz * 7, t + 0.06);
    lfo.frequency.value = 5.5; dybde.gain.value = hz * 0.01;
    lfo.connect(dybde); dybde.connect(o.frequency);
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(g.slutt); lfo.stop(g.slutt);
  }

  /* ---------- GALAKSE: trance i B-moll pentaton ---------- */

  function supernova(c, t, ut, v) {
    fall(c, t, ut, v * 0.95, 140, 44, 0.06, 0.4);
    tone(c, t, ut, 'square', 1600, v * 0.12, 0.001, 0.01);
  }

  function komet(c, t, ut, v) {
    // skarptromme med hale: ekkoene blir lysere og svakere, som en komet
    [0, 0.09, 0.18, 0.27].forEach(function (fra, i) {
      stoyStot(c, t + fra, ut, v * 0.6 * Math.pow(0.45, i), 'bandpass', 1600 + i * 400, 0.9, 0.15);
    });
    fall(c, t, ut, v * 0.3, 220, 170, 0.04, 0.1);
  }

  function stjerne(c, t, ut, v) {
    stoyStot(c, t, ut, v * 0.35, 'highpass', 7500, 0, 0.12);
  }

  function planet(c, t, ut, v, hz) {
    var f = c.createBiquadFilter(), g = hylster(c, t, v * 0.11, 0.002, 0.18);
    f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(4000, t);
    f.frequency.exponentialRampToValueAtTime(hz * 2, t + 0.12);
    f.connect(g); g.connect(ut);
    [1, 1.007].forEach(function (k) {
      var o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz * k;
      o.connect(f); o.start(t); o.stop(t + 0.22);
    });
  }

  function solvind(c, t, ut, v, hz, lengde) {
    var akkord = Array.isArray(hz) ? hz : [hz];
    var g = holdt(c, t, v * 0.035, 0.3, lengde * 0.9, 0.5), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1500;
    f.connect(g); g.connect(ut);
    akkord.forEach(function (n) {
      [0.994, 1, 1.006].forEach(function (k) {
        var o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = n * k;
        o.connect(f); o.start(t); o.stop(g.slutt);
      });
    });
  }

  function sorthull(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter();
    var g = holdt(c, t, v * 0.32, 0.005, lengde * 0.7, 0.04);
    o.type = 'sawtooth'; o.frequency.value = hz;
    o2.type = 'sine'; o2.frequency.value = hz;
    f.type = 'lowpass'; f.frequency.value = 320;
    o.connect(f); o2.connect(g); f.connect(g); g.connect(ut);
    o.start(t); o2.start(t); o.stop(g.slutt); o2.stop(g.slutt);
  }

  function meteor(c, t, ut, v) {
    var o = tone(c, t, ut, 'sine', 2500, v * 0.15, 0.01, 0.5);
    o.frequency.setValueAtTime(2500, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.5);
    stoyStot(c, t + 0.45, ut, v * 0.7, 'lowpass', 800, 0, 0.5);
  }

  /* ---------- FRUKTFEST: kjøkkenet er et trommesett ---------- */

  function gryte(c, t, ut, v) {
    fall(c, t, ut, v * 0.9, 150, 62, 0.07, 0.3);
    tone(c, t, ut, 'sine', 423, v * 0.1, 0.001, 0.25);        // grytekanten synger
    tone(c, t, ut, 'sine', 687, v * 0.06, 0.001, 0.18);
  }

  function panne(c, t, ut, v) {
    stoyStot(c, t, ut, v * 0.45, 'bandpass', 2500, 1.2, 0.08);
    [540, 1170, 1830, 2690].forEach(function (hz, i) {
      tone(c, t, ut, 'sine', hz, v * 0.09 / (i * 0.5 + 1), 0.001, 0.35 - i * 0.05);
    });
  }

  function visp(c, t, ut, v) {
    [0, 0.03].forEach(function (fra) { stoyStot(c, t + fra, ut, v * 0.5, 'bandpass', 5500, 1.5, 0.03); });
  }

  function flaske(c, t, ut, v, hz, lengde) {
    // å blåse over en flaske: ren tone og luft
    var o = c.createOscillator(), g = holdt(c, t, v * 0.15, 0.05, lengde * 0.8, 0.08);
    o.type = 'sine'; o.frequency.value = hz;
    o.connect(g); g.connect(ut);
    o.start(t); o.stop(g.slutt);
    stoyStot(c, t, ut, v * 0.08, 'bandpass', hz * 2, 8, Math.max(0.05, lengde * 0.6));
  }

  function glass(c, t, ut, v, hz) {
    tone(c, t, ut, 'sine', hz, v * 0.14, 0.003, 1.4);
    tone(c, t, ut, 'sine', hz * 2.32, v * 0.04, 0.003, 0.5);
  }

  function kork(c, t, ut, v) {
    var o = tone(c, t, ut, 'sine', 1300, v * 0.35, 0.001, 0.04);
    o.frequency.setValueAtTime(1300, t);
    o.frequency.exponentialRampToValueAtTime(350, t + 0.035);
    stoyStot(c, t, ut, v * 0.25, 'highpass', 3000, 0, 0.01);
  }

  function mikser(c, t, ut, v, hz, lengde) {
    // en mikser som går: firkant som dirrer fort
    var o = c.createOscillator(), f = c.createBiquadFilter(), lfo = c.createOscillator(), dybde = c.createGain();
    var g = holdt(c, t, v * 0.18, 0.006, lengde * 0.8, 0.05);
    o.type = 'square'; o.frequency.value = hz;
    lfo.frequency.value = 18; dybde.gain.value = hz * 0.03;
    lfo.connect(dybde); dybde.connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 800;
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(g.slutt); lfo.stop(g.slutt);
  }

  /* ---------- HAGEN: småkryp i B-dur pentaton ---------- */

  function stubbe(c, t, ut, v) {
    fall(c, t, ut, v * 0.9, 105, 50, 0.08, 0.35);
    tone(c, t, ut, 'triangle', 420, v * 0.12, 0.001, 0.04);
  }

  function spett(c, t, ut, v) {
    // hakkespetten: fem raske hakk som blir svakere
    for (var i = 0; i < 5; i++) {
      var tt = t + i * 0.028;
      tone(c, tt, ut, 'triangle', 1350, v * 0.3 * (1 - i * 0.12), 0.0005, 0.02);
      stoyStot(c, tt, ut, v * 0.25 * (1 - i * 0.12), 'bandpass', 2500, 3, 0.015);
    }
  }

  function siriss(c, t, ut, v) {
    for (var i = 0; i < 4; i++) tone(c, t + i * 0.022, ut, 'sine', 4600, v * 0.25, 0.002, 0.012);
  }

  function kalimba(c, t, ut, v, hz) {
    tone(c, t, ut, 'sine', hz, v * 0.22, 0.002, 0.9);
    tone(c, t, ut, 'sine', hz * 5.4, v * 0.05, 0.001, 0.08);
    tone(c, t, ut, 'sine', hz * 2, v * 0.04, 0.001, 0.3);
  }

  function humle(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), f = c.createBiquadFilter(), lfo = c.createOscillator(), dybde = c.createGain();
    var g = holdt(c, t, v * 0.35, 0.03, lengde * 0.85, 0.08);
    o.type = 'sawtooth'; o.frequency.value = hz;
    lfo.frequency.value = 7; dybde.gain.value = hz * 0.02;
    lfo.connect(dybde); dybde.connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 3;
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(g.slutt); lfo.stop(g.slutt);
  }

  function drape(c, t, ut, v) {
    var o = tone(c, t, ut, 'sine', 1100, v * 0.3, 0.001, 0.05);
    o.frequency.setValueAtTime(1100, t);
    o.frequency.exponentialRampToValueAtTime(2600, t + 0.03);
  }

  function frosk(c, t, ut, v) {
    // «kvekk»: en dyp sagtann som hakkes opp i små støt
    [0, 0.2].forEach(function (fra) {
      var o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), t0 = t + fra;
      o.type = 'sawtooth'; o.frequency.value = 170;
      f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 3;
      g.gain.setValueAtTime(0, t0);
      for (var k = 0; k < 5; k++) {
        g.gain.setValueAtTime(v * 0.9, t0 + k * 0.03);
        g.gain.setTargetAtTime(0.0001, t0 + k * 0.03 + 0.004, 0.006);
      }
      o.connect(f); f.connect(g); g.connect(ut);
      o.start(t0); o.stop(t0 + 0.17);
    });
  }

  /* ---------- EVENTYR: magi i Ess-dur pentaton ---------- */

  function hovslag(c, t, ut, v) {
    fall(c, t, ut, v * 0.85, 120, 55, 0.07, 0.3);
    tone(c, t, ut, 'sine', 2489, v * 0.05, 0.001, 0.25);    // en liten bjelle på seletøyet
  }

  var TRYLL = [622.25, 783.99, 932.33, 1046.5, 1244.5];
  function tryll(c, t, ut, v) {
    stoyStot(c, t, ut, v * 0.35, 'highpass', 5000, 0, 0.08);
    TRYLL.slice(1).forEach(function (hz, i) { tone(c, t + i * 0.025, ut, 'sine', hz * 2, v * 0.05, 0.001, 0.15); });
    fall(c, t, ut, v * 0.25, 250, 180, 0.03, 0.08);
  }

  function glitter(c, t, ut, v) {
    for (var i = 0; i < 2; i++) {
      tone(c, t + Math.random() * 0.04, ut, 'sine', TRYLL[Math.floor(Math.random() * TRYLL.length)] * 4, v * 0.13, 0.001, 0.2);
    }
  }

  function harpe(c, t, ut, v, hz) {
    tone(c, t, ut, 'triangle', hz, v * 0.2, 0.002, 1.1);
    tone(c, t, ut, 'sine', hz * 2, v * 0.06, 0.002, 0.5);
  }

  function alvekor(c, t, ut, v, hz, lengde) {
    // «aaah»: sagtenner gjennom to filtre på vokalfrekvensene til en a
    var akkord = Array.isArray(hz) ? hz : [hz];
    var g = holdt(c, t, v * 0.09, 0.4, lengde * 0.9, 0.5), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 750; f1.Q.value = 3;
    f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 4;
    f1.connect(g); f2.connect(g); g.connect(ut);
    akkord.forEach(function (n) {
      [1, 1.005].forEach(function (k) {
        var o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = n * k;
        o.connect(f1); o.connect(f2); o.start(t); o.stop(g.slutt);
      });
    });
  }

  function panfloyte(c, t, ut, v, hz, lengde) {
    var o = c.createOscillator(), lfo = c.createOscillator(), dybde = c.createGain();
    var g = holdt(c, t, v * 0.15, 0.06, lengde * 0.85, 0.15);
    o.type = 'sine'; o.frequency.value = hz;
    lfo.frequency.value = 5; dybde.gain.value = hz * 0.006;
    lfo.connect(dybde); dybde.connect(o.frequency);
    o.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(g.slutt); lfo.stop(g.slutt);
    stoyStot(c, t, ut, v * 0.1, 'bandpass', hz, 10, 0.12);       // pusten i anslaget
  }

  function regnbue(c, t, ut, v) {
    // en glissando opp gjennom hele skalaen
    [311.13, 349.23, 392, 466.16, 523.25, 622.25, 698.46, 783.99, 932.33, 1046.5, 1244.5].forEach(function (hz, i) {
      tone(c, t + i * 0.045, ut, 'sine', hz, v * 0.08, 0.002, 0.5);
    });
  }

  /* ---------- tonene ---------- */

  /* Tonene skrives som notenavn (A1, C#4, Bb3), og akkorder med pluss mellom
     (E3+G3+B3). Hver verden har sin egen toneart — men innenfor én verden er
     alt valgt slik at alle monstrene kan stå på samtidig uten å skjære. */
  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function hz(navn) {
    var m = /^([A-G])(#|b)?(\d)$/.exec(navn);
    if (!m) throw new Error('Ukjent tone: ' + navn);
    var midi = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0));
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function toner(tekst) {
    return tekst.trim().split(/\s+/).map(function (x) {
      if (x === '.') return null;
      var akkord = x.split('+').map(hz);
      return akkord.length > 1 ? akkord : akkord[0];
    });
  }

  /* ---------- beatene ---------- */

  /* Seks beats, og hver av dem er en hel verden: egne monstre, egne lyder,
     egen toneart og eget tempo. Å bytte beat skal føles som å gå inn i et
     annet rom — ikke som «samme trommer, litt annerledes».

     Et spor er 16 tegn for én takt, eller 32 for to (mellomrom leses bort).
     x = hardt slag, o = mykt, . = stille; andre bokstaver tolker lyden selv
     (bongo: h/l for lys og dyp). Tonale spor er notenavn med mellomrom.
     start: står på første gang barnet kommer inn i verdenen. Tre er nok — ni
     monstre som spiller samtidig er en vegg av lyd, ikke en invitasjon.

     lengde er hvor mange steg en tone holder: et tall, eller 'legato' for
     «til neste tone kommer» (med maksSteg som tak). */
  var GRUNNBEATS = [
    {
      id: 'boombap', navn: 'BOOM BAP', emoji: '🥊', bpm: 92, hue: 330, tema: null,
      himmel: { sky1: 320, sky2: 190, horisont: 300, gitter: 190, vegg: 285 },
      lyder: [
        { id: 'dunder', navn: 'DUNDER', hue: 348, slag: kick, start: true, spor: 'x.....x...x.....' },
        { id: 'klapp', navn: 'KLAPP', hue: 32, slag: klapp, start: true, spor: '....x.......x..o' },
        { id: 'tikk', navn: 'TIKK', hue: 188, slag: hatt, start: true, spor: 'x.o.x.o.x.oox.o.' },
        { id: 'skarp', navn: 'SMELL', hue: 12, slag: skarp, spor: '....x..o....x...' },
        { id: 'riste', navn: 'RISTE', hue: 74, slag: riste, spor: '.o.x.o.x.o.x.oxx' },
        { id: 'rare', navn: 'RARE', hue: 292, slag: rare, spor: '..x....r...x.r..' },
        { id: 'bass', navn: 'BASS', hue: 262, slag: bass, tonal: true,
          spor: 'A1 . . . . . C2 . . . A1 . . . E2 .' },
        { id: 'blipp', navn: 'BLIPP', hue: 158, slag: blipp, tonal: true,
          spor: 'A4 . . C5 . . E5 . D5 . . C5 . . A4 .' },
        { id: 'kosmisk', navn: 'KOSMISK', hue: 212, teppe: true }
      ]
    },
    {
      /* Elektro i E-moll pentaton. Alt er firkant, sagtann og metall, og
         bassen har filteret som lukker seg — det er det som gjør den robotaktig. */
      id: 'rombase', navn: 'ROMBASE', emoji: '🚀', bpm: 112, hue: 190, tema: 'rom',
      himmel: { sky1: 195, sky2: 255, horisont: 185, gitter: 170, vegg: 220 },
      lyder: [
        { id: 'botdunk', navn: 'BOTDUNK', hue: 200, slag: botdunk, start: true,
          spor: 'x......x..x..... x......x..x...x.' },
        { id: 'laser', navn: 'LASER', hue: 318, slag: laser, start: true, spor: '....x.......x...' },
        { id: 'pipp', navn: 'PIPP', hue: 168, slag: pipp, start: true, spor: 'x.xox.xox.xox.xo' },
        { id: 'robobass', navn: 'ROBOBASS', hue: 252, slag: robobass, tonal: true, lengde: 1,
          spor: 'E2 . E2 E3 . E2 . D3 . E2 . G2 . A2 B2 .   E2 . E2 E3 . E2 . D3 . E2 . B2 . A2 G2 D2' },
        { id: 'data', navn: 'DATA', hue: 135, slag: dataBlipp, tonal: true,
          spor: 'E5 B4 G4 B4 E5 B4 G4 B4 D5 A4 G4 A4 D5 A4 G4 A4   ' +
                'E5 B4 G4 B4 E5 B4 G4 B4 G5 D5 B4 D5 A5 E5 B4 E5' },
        { id: 'radar', navn: 'RADAR', hue: 48, slag: radar, tonal: true,
          spor: 'E6 . . . . . . . . . . . . . . .   . . . . . . . . B5 . . . . . . .' }
      ]
    },
    {
      /* Håndtrommer i C-dur pentaton — den glade tonearten. Klaven spiller
         son-klaven, rytmen som holder sammen nesten all latinamerikansk musikk. */
      id: 'jungel', navn: 'JUNGEL', emoji: '🌴', bpm: 100, hue: 95, tema: 'jungel',
      himmel: { sky1: 105, sky2: 38, horisont: 70, gitter: 130, vegg: 95 },
      lyder: [
        { id: 'tromme', navn: 'TROMME', hue: 28, slag: tromme, start: true, spor: 'x.....x.x.....x.' },
        // bongoene ligger i hullene etter trommen, så de ikke summerer seg
        { id: 'bongo', navn: 'BONGO', hue: 44, slag: bongo, start: true, spor: '..hlh..l..hlh..l' },
        { id: 'rasle', navn: 'RASLE', hue: 84, slag: rasle, start: true, spor: 'oxoxoxoxoxoxoxox' },
        { id: 'klave', navn: 'KLAVE', hue: 16, slag: klave, spor: 'x..x..x...x.x...' },
        { id: 'marimba', navn: 'MARIMBA', hue: 165, slag: marimba, tonal: true,
          spor: 'C5 . E5 G5 . E5 D5 . C5 . A4 . G4 . A4 .   C5 . E5 G5 . A5 G5 . E5 . D5 E5 C5 . . .' },
        { id: 'gorilla', navn: 'GORILLA', hue: 272, slag: gorilla, tonal: true,
          spor: 'C2 . . C2 . . G2 . A2 . . A2 . . G2 .   C2 . . C2 . . G2 . E2 . . E2 . . G2 .' },
        { id: 'papegoye', navn: 'PAPEGØYE', hue: 128, slag: papegoye,
          spor: '..........x..... ....o.......x...' }
      ]
    },
    {
      /* Sakte og dypt i D-moll pentaton. Hvalen og blekket holder tonene
         lenge, så det er rom mellom slagene — som å høre ting under vann. */
      id: 'havdyp', navn: 'HAVDYP', emoji: '🐙', bpm: 80, hue: 215, tema: 'hav',
      himmel: { sky1: 200, sky2: 235, horisont: 195, gitter: 185, vegg: 210 },
      lyder: [
        { id: 'anker', navn: 'ANKER', hue: 212, slag: anker, start: true,
          spor: 'x.........x..... x.........x...x.' },
        { id: 'krabbe', navn: 'KRABBE', hue: 8, slag: krabbe, start: true, spor: '....x.......x...' },
        { id: 'bobler', navn: 'BOBLER', hue: 182, slag: bobler, start: true, spor: '..x.....o.x...o.' },
        { id: 'hval', navn: 'HVAL', hue: 232, slag: hval, tonal: true, lengde: 'legato',
          spor: 'D4 . . . . . . . A3 . . . . . . .   F4 . . . . . G4 . . . C4 . . . . .' },
        { id: 'blekk', navn: 'BLEKK', hue: 285, slag: blekk, tonal: true, lengde: 'legato', maksSteg: 6,
          spor: 'D2 . . . . . D2 . . . . . F2 . C2 .   D2 . . . . . D2 . . . . . A1 . C2 .' },
        { id: 'skjell', navn: 'SKJELL', hue: 318, slag: skjell, tonal: true,
          spor: '. . A5 . . . D6 . . . C6 . . . . .   . . A5 . . . F5 . . . G5 . . . . .' }
      ]
    },
    {
      /* Et gammelt tv-spill i G-dur pentaton, fort. Trekantbass, pulsbølge
         og grov støy — de tre lydene en spillkonsoll fra 80-tallet hadde. */
      id: 'pixel', navn: 'PIXEL', emoji: '👾', bpm: 140, hue: 48, tema: 'pixel',
      himmel: { sky1: 125, sky2: 300, horisont: 300, gitter: 125, vegg: 300 },
      lyder: [
        { id: 'blokk', navn: 'BLOKK', hue: 4, slag: blokk, start: true, spor: 'x.....x.x.....x.' },
        { id: 'pang', navn: 'PANG', hue: 28, slag: pang, start: true, spor: '....x.......x...' },
        { id: 'piks', navn: 'PIKS', hue: 178, slag: piks, start: true, spor: 'x.x.x.x.x.x.x.x.' },
        { id: 'bitbass', navn: 'BITBASS', hue: 262, slag: bitbass, tonal: true, lengde: 1.5,
          spor: 'G2 . G3 . G2 . G3 . E2 . E3 . E2 . E3 .   A2 . A3 . A2 . A3 . D2 . D3 . D2 . D3 .' },
        { id: 'pling', navn: 'PLING', hue: 118, slag: pling, tonal: true, lengde: 'legato', maksSteg: 4,
          spor: 'G4 . B4 . D5 . E5 D5 . B4 . D5 . . . .   E5 . D5 . B4 . A4 B4 . G4 . A4 . . . .' },
        { id: 'mynt', navn: 'MYNT', hue: 52, slag: mynt, spor: '........x....... ..........x...x.' },
        { id: 'hopp', navn: 'HOPP', hue: 330, slag: hopp, spor: '.......x........ ...x............' }
      ]
    },
    {
      /* E harmonisk moll: den ene hevede tonen (D#) er det som gjør det
         skummelt i stedet for bare trist. Skummelt på barnevis — det knirker
         og klirrer, men orgelet løser seg alltid opp igjen. */
      id: 'spokelse', navn: 'SPØKELSE', emoji: '👻', bpm: 88, hue: 275, tema: 'gross',
      himmel: { sky1: 275, sky2: 95, horisont: 280, gitter: 100, vegg: 270 },
      lyder: [
        { id: 'stamp', navn: 'STAMP', hue: 268, slag: stamp, start: true, spor: 'x.....x...x.....' },
        { id: 'knirk', navn: 'KNIRK', hue: 30, slag: knirk, start: true, spor: '....x.......x...' },
        { id: 'klirr', navn: 'KLIRR', hue: 196, slag: klirr, start: true, spor: 'x..x..x.x..x..x.' },
        { id: 'orgel', navn: 'ORGEL', hue: 300, slag: orgel, tonal: true, lengde: 'legato',
          spor: 'E3+G3+B3 . . . . . . . A2+C3+E3 . . . . . . .   ' +
                'C3+E3+G3 . . . . . . . B2+D#3+F#3 . . . . . . .' },
        { id: 'huuu', navn: 'HUUU', hue: 150, slag: huuu, tonal: true, lengde: 'legato', maksSteg: 8,
          spor: 'B4 . . . . . C5 . B4 . . . . . . .   G4 . . . . . F#4 . . . D#4 . E4 . . .' },
        { id: 'klokke', navn: 'KLOKKE', hue: 50, slag: klokke, tonal: true,
          spor: 'E4 . . . . . . . . . . . . . . .   . . . . . . . . . . . . . . . .' },
        { id: 'flaggermus', navn: 'FLAGGERMUS', hue: 338, slag: flaggermus,
          spor: '..........x..... ...x.........x..' }
      ]
    },

    /* ---------- andre rad ----------
       Seks til, og de fleste har sin egen tegnestil — ikke bare egne
       monstre, men en helt annen måte å tegne dem på. */
    {
      /* Tunge taikotrommer og et horn i D-moll pentaton. Episk, men ikke
         skummelt: dragene er små og runde. */
      id: 'drage', navn: 'DRAGER', emoji: '🐉', bpm: 84, hue: 8, tema: 'drage',
      himmel: { sky1: 10, sky2: 35, horisont: 20, gitter: 5, vegg: 30 },
      lyder: [
        { id: 'taiko', navn: 'TAIKO', hue: 8, slag: taiko, start: true, spor: 'x.....x...x.x...' },
        { id: 'skjold', navn: 'SKJOLD', hue: 200, slag: skjold, start: true, spor: '....x.......x...' },
        { id: 'glor', navn: 'GLØR', hue: 38, slag: glor, start: true, spor: 'o.x.o.x.o.x.o.xo' },
        { id: 'vingeslag', navn: 'VINGER', hue: 150, slag: vingeslag,
          spor: '........x....... ................' },
        { id: 'ildpust', navn: 'ILDPUST', hue: 20, slag: ildpust,
          spor: '................ ........x.......' },
        { id: 'horn', navn: 'HORN', hue: 50, slag: horn, tonal: true, lengde: 'legato', maksSteg: 8,
          spor: 'D4 . . . A4 . . . F4 . G4 . A4 . . .   D5 . . . C5 . A4 . G4 . . . A4 . . .' },
        { id: 'brumm', navn: 'BRUMM', hue: 280, slag: brumm, tonal: true, lengde: 'legato',
          spor: 'D2 . . . . . . . . . . . . . . .   C2 . . . . . . . A1 . . . . . . .' }
      ]
    },
    {
      /* Funk i G-moll pentaton: hammeren er kicken, trykkluft er
         skarptrommen, og tannhjulene tikker som hi-hat. */
      id: 'fabrikk', navn: 'FABRIKK', emoji: '🤖', bpm: 104, hue: 150, tema: 'metall',
      himmel: { sky1: 160, sky2: 40, horisont: 150, gitter: 45, vegg: 160 },
      lyder: [
        { id: 'hammer', navn: 'HAMMER', hue: 200, slag: hammer, start: true, spor: 'x.....x..x.x....' },
        { id: 'damp', navn: 'DAMP', hue: 170, slag: damp, start: true, spor: '....x.......x...' },
        { id: 'tannhjul', navn: 'TANNHJUL', hue: 45, slag: tannhjul, start: true, spor: 'xoxoxoxoxoxoxoxo' },
        { id: 'wahbass', navn: 'WAHBASS', hue: 280, slag: wahbass, tonal: true, lengde: 1.5,
          spor: 'G2 . . G2 . . Bb2 . C3 . . G2 . F2 G2 .   G2 . . G2 . . Bb2 . D3 . C3 . Bb2 . F2 .' },
        { id: 'ambolt', navn: 'AMBOLT', hue: 10, slag: ambolt, tonal: true,
          spor: '. . . . . . . . . . D5 . . . . .   . . . . . . . . . . F5 . . . G5 .' },
        { id: 'pratebot', navn: 'PRATEBOT', hue: 120, slag: pratebot, tonal: true, lengde: 1.5,
          spor: 'G4 . Bb4 . G4 . . . . . . . . . . .   C5 . Bb4 . G4 . . . . . . . . . . .' },
        { id: 'floyte', navn: 'FLØYTE', hue: 330, slag: floyte, tonal: true, lengde: 'legato', maksSteg: 6,
          spor: '. . . . . . . . . . . . . . . .   . . . . . . . . D5 . . . . . . .' }
      ]
    },
    {
      /* Tyggegummipop i F-dur pentaton, fort og sprettent, med spilledåse
         som melodi og strøssel som glitrer oppå. */
      id: 'godteland', navn: 'GODTELAND', emoji: '🍭', bpm: 124, hue: 305, tema: 'godteri',
      himmel: { sky1: 310, sky2: 190, horisont: 330, gitter: 280, vegg: 300 },
      lyder: [
        { id: 'sprett', navn: 'SPRETT', hue: 330, slag: sprett, start: true, spor: 'x...x...x...x...' },
        { id: 'knips', navn: 'KNIPS', hue: 190, slag: knips, start: true, spor: '....x.......x...' },
        { id: 'drys', navn: 'DRYS', hue: 55, slag: drys, start: true, spor: '..x...x...x...xx' },
        { id: 'spilledase', navn: 'SPILLEDÅSE', hue: 280, slag: spilledase, tonal: true,
          spor: 'F5 A5 C6 A5 G5 . C6 . D6 C6 A5 . G5 . F5 .   F5 A5 C6 A5 D6 . C6 . A5 G5 F5 . G5 . . .' },
        { id: 'tyggis', navn: 'TYGGIS', hue: 345, slag: tyggis, tonal: true, lengde: 1.5,
          spor: 'F2 . F3 . C3 . F3 . D2 . D3 . A2 . D3 .   G2 . G3 . D3 . G3 . C3 . C3 . G2 . C3 .' },
        { id: 'pipedyr', navn: 'PIPEDYR', hue: 100, slag: pipedyr,
          spor: '................ ..........x.....' },
        { id: 'popp', navn: 'POPP', hue: 25, slag: popp, spor: '.......x........ ...x.......x....' }
      ]
    },
    {
      /* Steinalder i E-moll pentaton: bakken rister, steiner slås mot
         hverandre, og en xylofon av bein spiller melodien. */
      id: 'dino', navn: 'DINO', emoji: '🦖', bpm: 96, hue: 30, tema: 'dino',
      himmel: { sky1: 30, sky2: 100, horisont: 25, gitter: 80, vegg: 35 },
      lyder: [
        { id: 'tramp', navn: 'TRAMP', hue: 25, slag: tramp, start: true, spor: 'x.......x.......' },
        { id: 'stein', navn: 'STEIN', hue: 200, slag: stein, start: true, spor: '....x.......x..o' },
        { id: 'frorasle', navn: 'FRØ', hue: 90, slag: froRasle, start: true, spor: 'x.x.x.x.x.x.x.x.' },
        { id: 'knokkel', navn: 'KNOKKEL', hue: 48, slag: knokkel, tonal: true,
          spor: 'E5 . G5 . A5 . . . B5 . A5 . G5 . E5 .   E5 . G5 . A5 . . . D6 . B5 . A5 . . .' },
        { id: 'urhorn', navn: 'URHORN', hue: 12, slag: urhorn, tonal: true, lengde: 'legato',
          spor: 'E2 . . . . . . . . . . . . . . .   D2 . . . . . . . B1 . . . . . . .' },
        { id: 'vulkan', navn: 'VULKAN', hue: 0, slag: vulkan, spor: '................ x...............' },
        { id: 'trex', navn: 'T-REX', hue: 130, slag: trex, spor: '................ ........x.......' }
      ]
    },
    {
      /* Rolig vinternatt i D-dur pentaton: snøballer, knasende snø,
         bjeller, og nordlyset som et teppe av akkorder. */
      id: 'vinter', navn: 'VINTER', emoji: '❄️', bpm: 86, hue: 175, tema: 'origami',
      himmel: { sky1: 180, sky2: 140, horisont: 190, gitter: 200, vegg: 160 },
      lyder: [
        { id: 'snoball', navn: 'SNØBALL', hue: 205, slag: snoball, start: true, spor: 'x......x..x.....' },
        { id: 'knas', navn: 'KNAS', hue: 190, slag: knas, start: true, spor: '....x.......x...' },
        { id: 'bjeller', navn: 'BJELLER', hue: 48, slag: bjeller, start: true, spor: 'x.o.x.o.x.o.x.oo' },
        { id: 'isklokke', navn: 'ISKLOKKE', hue: 170, slag: isklokke, tonal: true,
          spor: 'A5 . F#5 . . . E5 . D5 . . . E5 . F#5 .   A5 . B5 . . . A5 . F#5 . . . E5 . . .' },
        { id: 'nordlys', navn: 'NORDLYS', hue: 140, slag: nordlys, tonal: true, lengde: 'legato',
          spor: 'D3+F#3+A3+E4 . . . . . . . . . . . . . . .   B2+D3+F#3+A3 . . . . . . . A2+D3+E3+A3 . . . . . . .' },
        { id: 'isbjorn', navn: 'ISBJØRN', hue: 220, slag: isbjorn, tonal: true, lengde: 'legato', maksSteg: 6,
          spor: 'D2 . . . . . D2 . . . A1 . . . . .   B1 . . . . . B1 . . . A1 . . . . .' },
        { id: 'vind', navn: 'VIND', hue: 260, slag: vind, spor: '................ ....x...........' }
      ]
    },
    {
      /* Sjømannssang i A-moll: tuba på ett og tre, trekkspill på to og fire
         — «øm-pa». E-dur-akkorden på slutten er det som gjør det til sjørøvere. */
      id: 'pirat', navn: 'PIRAT', emoji: '☠️', bpm: 108, hue: 240, tema: 'pirat',
      himmel: { sky1: 215, sky2: 45, horisont: 200, gitter: 230, vegg: 210 },
      lyder: [
        { id: 'tonne', navn: 'TØNNE', hue: 28, slag: tonne, start: true, spor: 'x.......x.......' },
        { id: 'kiste', navn: 'KISTE', hue: 12, slag: kiste, start: true, spor: '....x.......x...' },
        { id: 'gull', navn: 'GULL', hue: 48, slag: gull, start: true, spor: 'x..x..x.x..x..x.' },
        { id: 'tuba', navn: 'TUBA', hue: 270, slag: tuba, tonal: true, lengde: 2,
          spor: 'A2 . . . . . . . E2 . . . . . . .   D2 . . . . . . . E2 . . . . . . .' },
        { id: 'trekkspill', navn: 'TREKKSPILL', hue: 340, slag: trekkspill, tonal: true, lengde: 1.5,
          spor: '. . . . A3+C4+E4 . . . . . . . A3+C4+E4 . . .   . . . . D4+F4+A4 . . . . . . . E4+G#4+B4 . . .' },
        { id: 'kanon', navn: 'KANON', hue: 220, slag: kanon, spor: '................ ..............x.' },
        { id: 'maake', navn: 'MÅKE', hue: 190, slag: maake, spor: '..........x..... ................' }
      ]
    },

    /* ---------- tredje rad ---------- */
    {
      /* Actionmusikk i C-moll: slagene har navn fra tegneseriene, og
         messingen spiller Cm – B – Ass, akkordene fra alle heltefilmer. */
      id: 'superhelt', navn: 'SUPERHELT', emoji: '🦸', bpm: 120, hue: 0, tema: 'tegneserie',
      himmel: { sky1: 0, sky2: 50, horisont: 210, gitter: 0, vegg: 50 },
      lyder: [
        { id: 'pow', navn: 'POW', hue: 0, slag: pow, start: true, spor: 'x..x..x...x..x..' },
        { id: 'bam', navn: 'BAM', hue: 50, slag: bam, start: true, spor: '....x.......x...' },
        { id: 'swish', navn: 'SWISH', hue: 200, slag: swish, start: true, spor: 'x.o.x.o.x.o.x.oo' },
        { id: 'kappe', navn: 'KAPPE', hue: 280, slag: kappe, spor: '................ ..........x..x..' },
        { id: 'fanfare', navn: 'FANFARE', hue: 40, slag: fanfare, tonal: true, lengde: 1.5,
          spor: 'C4+Eb4+G4 . . . . . . C4+Eb4+G4 . . . . . . . .   ' +
                'Bb3+D4+F4 . . . . . . Bb3+D4+F4 . . . Ab3+C4+Eb4 . . . .' },
        { id: 'superbass', navn: 'SUPERBASS', hue: 230, slag: superbass, tonal: true, lengde: 1,
          spor: 'C2 . C2 C3 . C2 . Bb1 . C2 . C2 Eb2 . F2 .   Bb1 . Bb1 Bb2 . Bb1 . F2 . Ab1 . Ab1 Ab2 . G1 .' },
        { id: 'zap', navn: 'ZAP', hue: 130, slag: zap, spor: '..........x..... ......x.........' }
      ]
    },
    {
      /* Middelalder i D dorisk: pauker, tamburin og hovslag, en lutt som
         spiller melodien og en sekkepipe som holder bordunen. */
      id: 'borg', navn: 'BORG', emoji: '🏰', bpm: 100, hue: 45, tema: 'glassmaleri',
      himmel: { sky1: 45, sky2: 260, horisont: 40, gitter: 270, vegg: 45 },
      lyder: [
        { id: 'pauke', navn: 'PAUKE', hue: 20, slag: pauke, start: true, spor: 'x.......x...x... x.......x.x.x...' },
        { id: 'tamburin', navn: 'TAMBURIN', hue: 50, slag: tamburin, start: true, spor: '....x.......x..o' },
        { id: 'hest', navn: 'HEST', hue: 30, slag: hest, start: true, spor: 'xo..xo..xo..xo..' },
        { id: 'lutt', navn: 'LUTT', hue: 150, slag: lutt, tonal: true,
          spor: 'D4 F4 A4 F4 G4 . E4 . D4 F4 A4 C5 B4 . A4 .   G4 A4 B4 . A4 . G4 . F4 E4 D4 . E4 . D4 .' },
        { id: 'sekkepipe', navn: 'SEKKEPIPE', hue: 330, slag: sekkepipe, tonal: true, lengde: 'legato',
          spor: 'D3+A3 . . . . . . . . . . . . . . .   D3+A3 . . . . . . . . . . . . . . .' },
        { id: 'trompet', navn: 'TROMPET', hue: 210, slag: trompet, tonal: true, lengde: 1.5,
          spor: '. . . . . . . . . . . . . . . .   . . . . . . . . A4 . A4 . D5 . . .' }
      ]
    },
    {
      /* Trance i B-moll pentaton, fire slag i gulvet og åpen hi-hat mellom
         — musikken som går når en raketts motor tennes. */
      id: 'galakse', navn: 'GALAKSE', emoji: '🪐', bpm: 126, hue: 260, tema: 'stjernebilde',
      himmel: { sky1: 270, sky2: 200, horisont: 280, gitter: 240, vegg: 290 },
      lyder: [
        { id: 'supernova', navn: 'SUPERNOVA', hue: 280, slag: supernova, start: true, spor: 'x...x...x...x...' },
        { id: 'komet', navn: 'KOMET', hue: 190, slag: komet, start: true, spor: '....x.......x...' },
        { id: 'stjerne', navn: 'STJERNE', hue: 55, slag: stjerne, start: true, spor: '..x...x...x...x.' },
        { id: 'planet', navn: 'PLANET', hue: 150, slag: planet, tonal: true,
          spor: 'B4 D5 F#5 D5 B4 D5 F#5 A5 B4 D5 F#5 D5 E5 F#5 A5 F#5   ' +
                'A4 D5 E5 D5 A4 D5 E5 F#5 A4 D5 E5 D5 B4 D5 E5 D5' },
        { id: 'solvind', navn: 'SOLVIND', hue: 320, slag: solvind, tonal: true, lengde: 'legato',
          spor: 'B3+D4+F#4 . . . . . . . . . . . . . . .   A3+D4+E4 . . . . . . . E3+A3+D4 . . . . . . .' },
        { id: 'sorthull', navn: 'SORT HULL', hue: 250, slag: sorthull, tonal: true, lengde: 1,
          spor: '. . B1 . . . B1 . . . B1 . . . B1 .   . . A1 . . . A1 . . . D2 . . . E2 .' },
        { id: 'meteor', navn: 'METEOR', hue: 20, slag: meteor, spor: '................ x...............' }
      ]
    },
    {
      /* Kjøkkenet i A-dur pentaton: gryter og panner er trommene, en visp
         er riste-egget, og melodien blåses over en flaske. */
      id: 'frukt', navn: 'FRUKTFEST', emoji: '🍉', bpm: 112, hue: 130, tema: 'frukt',
      himmel: { sky1: 110, sky2: 350, horisont: 30, gitter: 120, vegg: 60 },
      lyder: [
        { id: 'gryte', navn: 'GRYTE', hue: 200, slag: gryte, start: true, spor: 'x.....x.x.....x.' },
        { id: 'panne', navn: 'PANNE', hue: 30, slag: panne, start: true, spor: '....x.......x...' },
        { id: 'visp', navn: 'VISP', hue: 60, slag: visp, start: true, spor: 'xoxoxoxoxoxoxoxo' },
        { id: 'flaske', navn: 'FLASKE', hue: 140, slag: flaske, tonal: true, lengde: 'legato', maksSteg: 4,
          spor: 'A4 . C#5 . E5 . . . F#5 . E5 . C#5 . . .   B4 . C#5 . E5 . . . A4 . . . . . . .' },
        { id: 'glass', navn: 'GLASS', hue: 190, slag: glass, tonal: true,
          spor: '. . . . . . . . . . . . . . E6 .   . . . . . . . . . . . . . . A6 .' },
        { id: 'kork', navn: 'KORK', hue: 25, slag: kork, spor: '..........x..... ..........x...x.' },
        { id: 'mikser', navn: 'MIKSER', hue: 300, slag: mikser, tonal: true, lengde: 1.5,
          spor: 'A1 . . A1 . . E2 . F#2 . . F#2 . . E2 .   D2 . . D2 . . A1 . E2 . . E2 . . C#2 .' }
      ]
    },
    {
      /* Sommer i hagen, B-dur pentaton: en stubbe er kicken, hakkespetten
         skarptrommen, sirissene hi-haten, og humla brummer bassen. */
      id: 'hage', navn: 'HAGEN', emoji: '🐞', bpm: 92, hue: 80, tema: 'akvarell',
      himmel: { sky1: 95, sky2: 55, horisont: 110, gitter: 130, vegg: 85 },
      lyder: [
        { id: 'stubbe', navn: 'STUBBE', hue: 30, slag: stubbe, start: true, spor: 'x.....x...x.....' },
        { id: 'spett', navn: 'SPETT', hue: 0, slag: spett, start: true, spor: '....x.......x...' },
        { id: 'siriss', navn: 'SIRISS', hue: 100, slag: siriss, start: true, spor: '..x...x...x...x.' },
        { id: 'kalimba', navn: 'KALIMBA', hue: 180, slag: kalimba, tonal: true,
          spor: 'Bb4 D5 F5 . G5 . F5 D5 C5 . D5 . Bb4 . . .   Bb4 D5 F5 . G5 . Bb5 . G5 . F5 . D5 . . .' },
        { id: 'humle', navn: 'HUMLE', hue: 48, slag: humle, tonal: true, lengde: 'legato', maksSteg: 4,
          spor: 'Bb1 . . . . . Bb1 . F2 . . . G2 . . .   G1 . . . . . G1 . D2 . . . F2 . . .' },
        { id: 'drape', navn: 'DRÅPE', hue: 205, slag: drape, spor: '.x.....x.x...x.. ...x...x.....x..' },
        { id: 'frosk', navn: 'FROSK', hue: 130, slag: frosk, spor: '................ ..............x.' }
      ]
    },
    {
      /* Eventyr i Ess-dur pentaton: harpe, alvekor og panfløyte, og en
         regnbue som glir opp gjennom hele skalaen. */
      id: 'eventyr', navn: 'EVENTYR', emoji: '🦄', bpm: 96, hue: 320, tema: 'regnbue',
      himmel: { sky1: 320, sky2: 180, horisont: 290, gitter: 200, vegg: 330 },
      lyder: [
        { id: 'hovslag', navn: 'HOVSLAG', hue: 290, slag: hovslag, start: true, spor: 'x.......x..x....' },
        { id: 'tryll', navn: 'TRYLL', hue: 50, slag: tryll, start: true, spor: '....x.......x...' },
        { id: 'glitter', navn: 'GLITTER', hue: 190, slag: glitter, start: true, spor: '..x...x...x...x.' },
        { id: 'harpe', navn: 'HARPE', hue: 40, slag: harpe, tonal: true,
          spor: 'Eb4 G4 Bb4 Eb5 G5 Eb5 Bb4 G4 C4 Eb4 G4 C5 Eb5 C5 G4 Eb4   ' +
                'Bb3 F4 Bb4 D5 F5 D5 Bb4 F4 C4 F4 Bb4 C5 F5 C5 Bb4 F4' },
        { id: 'alvekor', navn: 'ALVEKOR', hue: 260, slag: alvekor, tonal: true, lengde: 'legato',
          spor: 'Eb4+G4+Bb4 . . . . . . . C4+Eb4+G4 . . . . . . .   Bb3+D4+F4 . . . . . . . Bb3+Eb4+G4 . . . . . . .' },
        { id: 'panfloyte', navn: 'PANFLØYTE', hue: 160, slag: panfloyte, tonal: true, lengde: 'legato', maksSteg: 8,
          spor: 'G5 . . . F5 . Eb5 . . . . . Bb4 . . .   C5 . . . Eb5 . F5 . . . . . G5 . . .' },
        { id: 'regnbue', navn: 'REGNBUE', hue: 340, slag: regnbue, spor: '..............x. ................' }
      ]
    }
  ];

  /* Sporene skrives for å være lesbare, og gjøres om én gang her. Feil i et
     spor — feil lengde, en tone som ikke finnes, to monstre med samme id —
     sies fra om med en gang i stedet for å bli en stille rute midt i en låt. */
  (function klargjorGrunnbeats() {
    var sett = {};
    GRUNNBEATS.forEach(function (g) {
      g.lyder.forEach(function (l) {
        if (sett[l.id]) console.error('To monstre heter ' + l.id);
        sett[l.id] = true;
        l.tema = g.tema;
        if (l.teppe) return;
        l.spor = l.tonal ? toner(l.spor) : l.spor.replace(/\s+/g, '');
        if (!l.spor.length || l.spor.length % STEG) {
          console.error(l.id + ': sporet har ' + l.spor.length + ' steg, ikke 16 eller 32');
        }
      });
    });
  })();

  var grunnbeat = GRUNNBEATS[0];

  /* Ukjente id-er — fra eldre versjoner som hadde disko, trap og barnas egen
     beat — faller tilbake på den første. Da åpner gamle sanger seg fortsatt,
     med de samme monstrene de ble laget med. */
  function finnGrunnbeat(id) {
    for (var i = 0; i < GRUNNBEATS.length; i++) if (GRUNNBEATS[i].id === id) return GRUNNBEATS[i];
    return GRUNNBEATS[0];
  }

  // hvor i et spor på én eller to takter vi er
  function sporSted(spor, steg, takt) {
    var runder = Math.max(1, Math.floor(spor.length / STEG));
    return (takt % runder) * STEG + steg;
  }

  function noteLengde(d, spor, i) {
    if (d.lengde !== 'legato') return d.lengde || 2;
    var n = 1;
    while (n < spor.length && !spor[(i + n) % spor.length]) n++;
    return Math.min(n, d.maksSteg || 16);
  }

  /* ---------- drumpadet ----------

     Tjue korte lyder barna kan slå inn når de vil, oppå sangen som går.
     Øverste rad er trommer og DJ-lyder, nederste rad er det som får en
     seksåring til å le: promp, rap, dyr, tuting og sirene.

     Lydene har litt tilfeldighet i seg. Tjue prompelyder på rad som låter
     helt likt blir kjedelig fort; tjue som alle er litt forskjellige, blir
     det ikke. */

  function kubjelle(c, t, ut) {
    var f = c.createBiquadFilter(), g = hylster(c, t, 0.4, 0.002, 0.3);
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
    [562, 845].forEach(function (hz) {
      var o = c.createOscillator();
      o.type = 'square'; o.frequency.value = hz;
      o.connect(f); o.start(t); o.stop(t + 0.34);
    });
    f.connect(g); g.connect(ut);
  }

  function cymbal(c, t, ut) {
    stoyStot(c, t, ut, 0.35, 'highpass', 5000, 0, 1.4);
    stoyStot(c, t, ut, 0.25, 'bandpass', 8000, 1, 0.9);
    var f = c.createBiquadFilter(), g = hylster(c, t, 0.05, 0.001, 1.0);
    f.type = 'highpass'; f.frequency.value = 6000;
    [3150, 4270, 5690, 7420].forEach(function (hz) {
      var o = c.createOscillator();
      o.type = 'square'; o.frequency.value = hz;
      o.connect(f); o.start(t); o.stop(t + 1.05);
    });
    f.connect(g); g.connect(ut);
  }

  function tom(c, t, ut) {
    fall(c, t, ut, 0.8, 210, 120, 0.12, 0.4);
    stoyStot(c, t, ut, 0.15, 'bandpass', 1200, 1, 0.03);
  }

  function skratsj(c, t, ut) {
    // «vikke-vikke»: platen dras fram og tilbake, to ganger
    var s = stoyKilde(c, t, 0.4), f = c.createBiquadFilter(), g = c.createGain();
    var o = c.createOscillator(), og = c.createGain();
    f.type = 'bandpass'; f.Q.value = 4;
    o.type = 'sawtooth';
    g.gain.value = 0; og.gain.value = 0;
    [0, 0.18].forEach(function (fra) {
      var a = t + fra;
      f.frequency.setValueAtTime(700, a);
      f.frequency.exponentialRampToValueAtTime(3200, a + 0.07);
      f.frequency.exponentialRampToValueAtTime(600, a + 0.15);
      o.frequency.setValueAtTime(180, a);
      o.frequency.exponentialRampToValueAtTime(650, a + 0.07);
      o.frequency.exponentialRampToValueAtTime(140, a + 0.15);
      [g, og].forEach(function (gg, i) {
        gg.gain.setValueAtTime(0.0001, a);
        gg.gain.linearRampToValueAtTime(i ? 0.2 : 1.6, a + 0.02);
        gg.gain.linearRampToValueAtTime(0.0001, a + 0.15);
      });
    });
    s.connect(f); f.connect(g); g.connect(ut);
    o.connect(og); og.connect(ut);
    o.start(t); o.stop(t + 0.4); s.stop(t + 0.4);
  }

  function lufthorn(c, t, ut) {
    // DJ-hornet: ba-ba-baaaa
    var f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2600; f.connect(ut);
    [[0, 0.1], [0.14, 0.1], [0.28, 0.55]].forEach(function (d) {
      var a = t + d[0], g = holdt(c, a, 0.12, 0.01, d[1], 0.06);
      [350, 352.5, 441, 525].forEach(function (hz) {
        var o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = hz;
        o.connect(g); o.start(a); o.stop(g.slutt);
      });
      g.connect(f);
    });
  }

  function promp(c, t, ut) {
    /* En promp er en dyp, ujevn tone som hakkes opp i små støt. Både
       lengden, tonen og hvor fort den «hakker» trekkes på nytt hver gang. */
    var lengde = 0.35 + Math.random() * 0.45, hz = 70 + Math.random() * 45;
    var o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    var am = c.createOscillator(), amDybde = c.createGain(), bunn = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(hz, t);
    for (var tt = 0.03; tt < lengde; tt += 0.03 + Math.random() * 0.03) {
      o.frequency.setValueAtTime(hz * (0.8 + Math.random() * 0.45), t + tt);
    }
    f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 3;
    am.type = 'square'; am.frequency.value = 22 + Math.random() * 18;
    amDybde.gain.value = 0.5; bunn.gain.value = 0.5;
    am.connect(amDybde); amDybde.connect(bunn.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.03);
    g.gain.setValueAtTime(0.6, t + lengde * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
    o.connect(f); f.connect(bunn); bunn.connect(g); g.connect(ut);
    o.start(t); am.start(t); o.stop(t + lengde + 0.02); am.stop(t + lengde + 0.02);
    stoyStot(c, t, ut, 0.12, 'lowpass', 400, 0, lengde * 0.8);
  }

  function rap(c, t, ut) {
    var lengde = 0.45 + Math.random() * 0.2;
    var o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    var am = c.createOscillator(), dybde = c.createGain(), bunn = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(78, t + lengde);
    f.type = 'bandpass'; f.frequency.value = 480; f.Q.value = 2;
    am.frequency.value = 31; dybde.gain.value = 0.45; bunn.gain.value = 0.55;
    am.connect(dybde); dybde.connect(bunn.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(2.2, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
    o.connect(f); f.connect(bunn); bunn.connect(g); g.connect(ut);
    o.start(t); am.start(t); o.stop(t + lengde + 0.02); am.stop(t + lengde + 0.02);
  }

  /* Dyrelyder: en sagtann (stemmebåndene) gjennom et filter (munnen) som
     beveger seg. Det er munnformen som gjør «møø» til en ku og «mjau» til
     en katt — tonen alene gjør det ikke. */
  function stemme(c, t, ut, v, lengde, tone0, tone1, munn0, munn1, q) {
    var o = c.createOscillator(), f = c.createBiquadFilter(), g = holdt(c, t, v, 0.05, lengde * 0.75, lengde * 0.25);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(tone0, t);
    o.frequency.exponentialRampToValueAtTime(tone1, t + lengde);
    f.type = 'bandpass'; f.Q.value = q || 2;
    f.frequency.setValueAtTime(munn0, t);
    f.frequency.exponentialRampToValueAtTime(munn1, t + lengde * 0.6);
    o.connect(f); f.connect(g); g.connect(ut);
    o.start(t); o.stop(g.slutt);
    return o;
  }

  function moo(c, t, ut) {
    var o = stemme(c, t, ut, 1.1, 0.95, 135, 105, 280, 750, 2.5);
    var lfo = c.createOscillator(), d = c.createGain();
    lfo.frequency.value = 5; d.gain.value = 3;
    lfo.connect(d); d.connect(o.frequency); lfo.start(t); lfo.stop(t + 1.2);
  }

  function voff(c, t, ut) {
    [0, 0.2].forEach(function (fra) {
      stemme(c, t + fra, ut, 1.2, 0.13, 420, 240, 1300, 700, 2);
      stoyStot(c, t + fra, ut, 0.25, 'bandpass', 1500, 1, 0.08);
    });
  }

  function mjau(c, t, ut) {
    var o = stemme(c, t, ut, 0.8, 0.6, 520, 480, 800, 1800, 3);
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(820, t + 0.22);
    o.frequency.linearRampToValueAtTime(470, t + 0.6);
  }

  function kvakk(c, t, ut) {
    [0, 0.2].forEach(function (fra) {
      var o = c.createOscillator(), f = c.createBiquadFilter(), g = hylster(c, t + fra, 2, 0.005, 0.13);
      o.type = 'square';
      o.frequency.setValueAtTime(330, t + fra);
      o.frequency.exponentialRampToValueAtTime(250, t + fra + 0.13);
      f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 5;
      o.connect(f); f.connect(g); g.connect(ut);
      o.start(t + fra); o.stop(t + fra + 0.16);
    });
  }

  function boing(c, t, ut) {
    var o = c.createOscillator(), g = hylster(c, t, 0.5, 0.005, 0.6), lfo = c.createOscillator(), d = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.08);
    lfo.frequency.value = 13;
    d.gain.setValueAtTime(90, t);
    d.gain.exponentialRampToValueAtTime(4, t + 0.6);
    lfo.connect(d); d.connect(o.frequency);
    o.connect(g); g.connect(ut);
    o.start(t); lfo.start(t); o.stop(t + 0.62); lfo.stop(t + 0.62);
  }

  function tut(c, t, ut) {
    var f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2000; f.connect(ut);
    [0, 0.26].forEach(function (fra) {
      var g = holdt(c, t + fra, 0.13, 0.01, 0.18, 0.03);
      [400, 505].forEach(function (hz) {
        var o = c.createOscillator();
        o.type = 'square'; o.frequency.value = hz;
        o.connect(g); o.start(t + fra); o.stop(g.slutt);
      });
      g.connect(f);
    });
  }

  function sirene(c, t, ut) {
    var o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain(), g = holdt(c, t, 0.16, 0.05, 1.2, 0.15);
    o.type = 'sine'; o2.type = 'square'; g2.gain.value = 0.15;
    [o, o2].forEach(function (x) {
      x.frequency.setValueAtTime(600, t);
      x.frequency.linearRampToValueAtTime(1150, t + 0.3);
      x.frequency.linearRampToValueAtTime(600, t + 0.6);
      x.frequency.linearRampToValueAtTime(1150, t + 0.9);
      x.frequency.linearRampToValueAtTime(600, t + 1.25);
    });
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(ut);
    o.start(t); o2.start(t); o.stop(g.slutt); o2.stop(g.slutt);
  }

  function kyss(c, t, ut) {
    // «mmm-ÆH»: leppene som skilles
    stemme(c, t, ut, 0.4, 0.12, 220, 200, 300, 350, 2);
    stoyStot(c, t + 0.12, ut, 1.3, 'bandpass', 2600, 2, 0.03);
    var o = tone(c, t + 0.12, ut, 'sine', 1400, 0.5, 0.001, 0.05);
    o.frequency.setValueAtTime(1400, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.16);
  }

  var PADS = [
    { id: 'p-bom', navn: 'BOM', emoji: '💥', hue: 348, lyd: function (c, t, ut) { kick(c, t, ut, 1); } },
    { id: 'p-klapp', navn: 'KLAPP', emoji: '👏', hue: 32, lyd: function (c, t, ut) { klapp(c, t, ut, 2); } },
    { id: 'p-smell', navn: 'SMELL', emoji: '🥁', hue: 12, lyd: function (c, t, ut) { skarp(c, t, ut, 0.9); } },
    { id: 'p-tss', navn: 'TSS', emoji: '🎩', hue: 188, lyd: function (c, t, ut) { stoyStot(c, t, ut, 0.4, 'highpass', 7000, 0, 0.25); } },
    { id: 'p-kubjelle', navn: 'KUBJELLE', emoji: '🔔', hue: 50, lyd: kubjelle },
    { id: 'p-cymbal', navn: 'CYMBAL', emoji: '📀', hue: 60, lyd: cymbal },
    { id: 'p-tom', navn: 'TOM', emoji: '🪘', hue: 20, lyd: tom },
    { id: 'p-skratsj', navn: 'SKRATSJ', emoji: '💿', hue: 280, lyd: skratsj },
    { id: 'p-laser', navn: 'LASER', emoji: '⚡', hue: 318, lyd: function (c, t, ut) { laser(c, t, ut, 1); } },
    { id: 'p-horn', navn: 'HORN', emoji: '📯', hue: 200, lyd: lufthorn },
    { id: 'p-promp', navn: 'PROMP', emoji: '💨', hue: 90, lyd: promp },
    { id: 'p-rap', navn: 'RAP', emoji: '🤢', hue: 110, lyd: rap },
    { id: 'p-moo', navn: 'MØØ', emoji: '🐮', hue: 30, lyd: moo },
    { id: 'p-voff', navn: 'VOFF', emoji: '🐶', hue: 40, lyd: voff },
    { id: 'p-mjau', navn: 'MJAU', emoji: '🐱', hue: 45, lyd: mjau },
    { id: 'p-kvakk', navn: 'KVAKK', emoji: '🦆', hue: 55, lyd: kvakk },
    { id: 'p-boing', navn: 'BOING', emoji: '🦘', hue: 160, lyd: boing },
    { id: 'p-tut', navn: 'TUT', emoji: '🚗', hue: 0, lyd: tut },
    { id: 'p-sirene', navn: 'SIRENE', emoji: '🚨', hue: 220, lyd: sirene },
    { id: 'p-kyss', navn: 'KYSS', emoji: '😘', hue: 330, lyd: kyss }
  ];

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
    return { hode: hode, gain: g, analyse: an, kjede: kjede, effekt: plass.effekt };
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
      var spor = d.spor;
      if (!spor) return;
      var i = sporSted(spor, steg, takt);
      if (d.tonal) {
        var note = spor[i];
        if (!note) return;
        d.slag(c, t, plass.rigg.hode, 1, note, stegLengde * noteLengde(d, spor, i));
        plass.sistSpilt = t;
        return;
      }
      var tegn = spor.charAt(i);
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

  /* Signalkjedene følger av/på-tilstanden: trommene har alltid sin (de er
     få), mens en stemme bare har kjede så lenge den står på.

     Det er det som gjør 200 stemmer mulig. En kjede koster selv i stillhet —
     HULE regner konvolusjon på hver eneste lydblokk, ROBOT og ROMVESEN har
     oscillatorer som aldri stopper. To hundre av dem ville kvalt prosessoren
     på et nettbrett, selv om bare tre av dem spilte. */
  function sikreKjeder() {
    for (var i = 0; i < plasser.length; i++) {
      var p = plasser[i];
      var skal = p.kind === 'trommer' || p.paa;
      if (skal && !p.rigg) p.rigg = byggKjede(ctx, p, rigg.master, bpm);
      else if (!skal && p.rigg) { rivKjede(p.rigg); p.rigg = null; }
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

  /* Beaten bestemmer hvilke monstre som finnes; brettet bygges om av den som
     kaller. Tempoet følger som regel med, siden undervannsbeaten på 140 slag
     ville blitt stresset og tv-spillet på 80 søvnig; en lagret sang ber om å
     få beholde sitt eget. */
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
    /* Bare denne plassens egen kjede, ikke alle. En avslått stemme som prøves
       i stell-arket skal høres uten å bli skrudd på — og den globale
       oppryddingen ville revet kjeden rett før lyden skulle gjennom den. */
    if (!p.rigg) p.rigg = byggKjede(ctx, p, rigg.master, bpm);
    var t = ctx.currentTime + 0.02, sl = 60 / bpm / 4;
    if (p.kind === 'trommer') {
      var d = p.def, spor = d.spor;
      if (d.teppe) teppe(ctx, t, p.rigg.hode, 1, sl * 8);
      else if (d.tonal) {
        // første tone i sporet, så smaksprøven stemmer med det man faktisk får
        for (var i = 0; i < spor.length; i++) {
          if (spor[i]) { d.slag(ctx, t, p.rigg.hode, 1, spor[i], sl * Math.min(8, noteLengde(d, spor, i))); break; }
        }
      } else {
        // første slaget i sporet: bongoen skal smake som bongo, ikke som en tom rute
        d.slag(ctx, t, p.rigg.hode, 1, spor.replace(/\./g, '').charAt(0) || 'x');
      }
    } else if (p.buffer) {
      spillStemme(ctx, p, t, effekt(p.effekt), 0, sl);
    }
    p.sistSpilt = t;
  }

  /* Drumpadet går rett ut i miksen gjennom én felles kjede. Lyden starter så
     fort det går etter trykket, ikke på neste slag: et barn som trykker skal
     høre at DE gjorde det, i det øyeblikket de gjorde det. */
  var padRigg = null;
  function pad(id) {
    start();
    if (!padRigg) {
      padRigg = ctx.createGain();
      padRigg.gain.value = 0.9;
      padRigg.connect(rigg.master);
    }
    for (var i = 0; i < PADS.length; i++) {
      if (PADS[i].id === id) { PADS[i].lyd(ctx, ctx.currentTime + 0.005, padRigg); return true; }
    }
    return false;
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

  /* Når brettet bygges på nytt, beholder en plass som finnes fra før den
     signalkjeden den hadde. Resten rives. Uten dette ble kjedene liggende
     igjen koblet til miksen hver gang en lyd kom til — med oscillatorene i
     ROBOT og ROMVESEN gående for alltid — og et beatbytte ville latt den
     gamle verdenens trommer bli hengende. */
  function nyePlasser(nye) {
    var gamle = {};
    plasser.forEach(function (p) { if (p.rigg) gamle[p.id] = p; });
    nye.forEach(function (p) {
      var g = gamle[p.id];
      if (!g || p.rigg || g.kind !== p.kind || g.rigg.effekt !== p.effekt) return;
      p.rigg = g.rigg;
      p.sistSpilt = g.sistSpilt;
      delete gamle[p.id];
    });
    Object.keys(gamle).forEach(function (id) {
      rivKjede(gamle[id].rigg);
      gamle[id].rigg = null;
    });
    plasser = nye;
  }

  return {
    EFFEKTER: EFFEKTER, RYTMER: RYTMER, STEG: STEG,
    GRUNNBEATS: GRUNNBEATS, finnGrunnbeat: finnGrunnbeat,
    effekt: effekt, rytme: rytme, wav: wav, lydsesjon: lydsesjon,
    start: start, spill: spill, stopp: stopp, demp: demp,
    settBpm: settBpm, settGrunnbeat: settGrunnbeat,
    plassEndret: plassEndret,
    smak: smak, prov: prov, pad: pad, PADS: PADS,
    eksporter: eksporter, sikreKjeder: sikreKjeder,
    get ctx() { return ctx; },
    get rigg() { return rigg; },
    get spiller() { return spiller; },
    get bpm() { return bpm; },
    get grunnbeat() { return grunnbeat; },
    get stegKo() { return stegKo; },
    get plasser() { return plasser; },
    set plasser(v) { nyePlasser(v); }
  };
})();
