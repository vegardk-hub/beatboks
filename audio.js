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
    smak: smak, prov: prov,
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
