/* Opptak og lagring.

   Opptaksriggen er hentet fra stemmeklone-verkstedet og tilpasset beatboxing.
   Den viktigste detaljen er at telefonens egen "hjelp" skrus av:
   støyfjerning spiser nettopp de tsss- og pff-lydene som ER beatboxing,
   og automatisk volumkontroll pumper og flater ut slagene. Begge deler ville
   gjort barnas beste lyder til grøt. */
var Opptak = (function () {
  'use strict';

  var MAKS_SEK = 6;          // lang nok til en frase, kort nok til at de tør prøve igjen

  var stream = null, kilde = null, node = null, stille = null;
  var biter = [], tarOpp = false, aktiv = false;
  var analyse = null, lydKommer = false;

  var WORKLET = [
    'class Fanger extends AudioWorkletProcessor {',
    '  process(inputs) {',
    '    const inn = inputs[0];',
    '    if (inn && inn[0]) this.port.postMessage(new Float32Array(inn[0]));',
    '    return true;',
    '  }',
    '}',
    'registerProcessor("fanger", Fanger);'
  ].join('\n');

  function taImot(data) {
    /* En strøm som er koblet opp, men ikke levende, leverer bare eksakte
       nuller. Da blir opptaket digital stillhet uten at noe feiler synlig. */
    if (!lydKommer) {
      for (var k = 0; k < data.length; k++) {
        if (data[k] !== 0) { lydKommer = true; break; }
      }
    }
    if (tarOpp) biter.push(data);
  }

  function aapne() {
    var c = Motor.start();
    if (aktiv) return Promise.resolve();
    Motor.lydsesjon('play-and-record');
    return navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    }).then(function (s) {
      stream = s;
      kilde = c.createMediaStreamSource(s);
      analyse = c.createAnalyser();
      analyse.fftSize = 1024;
      analyse.smoothingTimeConstant = 0.35;
      kilde.connect(analyse);
      if (c.audioWorklet) {
        var url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
        return c.audioWorklet.addModule(url).then(function () {
          node = new AudioWorkletNode(c, 'fanger');
          node.port.onmessage = function (e) { taImot(e.data); };
        }).catch(function () { lagReserve(c); });
      }
      lagReserve(c);
    }).then(function () {
      kilde.connect(node);
      /* Noden må ha et sluk for å bli pumpet, men skal ikke gi lyd ut.
         Uten dempingen ville mikrofonen gå rett i høyttaleren og hyle. */
      stille = Motor.ctx.createGain();
      stille.gain.value = 0;
      node.connect(stille);
      stille.connect(Motor.ctx.destination);
      aktiv = true;
    });
  }

  /* Eldre Safari mangler AudioWorklet. ScriptProcessor er avviklet, men den
     virker, og alternativet er ingen app i det hele tatt. */
  function lagReserve(c) {
    node = c.createScriptProcessor(2048, 1, 1);
    node.onaudioprocess = function (e) {
      taImot(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
  }

  function slipp() {
    /* Mikrofonen må slippes med en gang opptaket er ferdig. iOS holder hele
       lydsesjonen i "ta opp"-modus så lenge sporet lever, og da faller
       avspillingsvolumet merkbart. */
    try { if (node) node.disconnect(); } catch (e) {}
    try { if (kilde) kilde.disconnect(); } catch (e) {}
    try { if (stille) stille.disconnect(); } catch (e) {}
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null; kilde = null; node = null; stille = null;
    aktiv = false; lydKommer = false;
    Motor.lydsesjon('playback');
  }

  function begynn() {
    biter = [];
    tarOpp = true;
  }

  function flett() {
    var n = 0, i;
    for (i = 0; i < biter.length; i++) n += biter[i].length;
    var ut = new Float32Array(n), o = 0;
    for (i = 0; i < biter.length; i++) { ut.set(biter[i], o); o += biter[i].length; }
    return ut;
  }

  /* ---------- etterarbeid ---------- */

  /* Nettbrettmikrofoner samler opp romling fra bordet og fingrene, og de
     leverer ofte en likespenning på toppen.

     Filteret kjøres tre ganger. Ett enkelt ledd faller bare 6 dB per oktav og
     demper 20 Hz med snaue 10 dB — altfor lite til at trimmingen under klarer
     å skille bordromling fra en lyd. Tre ledd gir omtrent 21 dB.

     Knekkpunktet ligger på 45 Hz og ikke høyere med vilje: grunntonen i en
     beatbox-kick ligger rundt 70-100 Hz, og tre ledd på 65 Hz tok nesten
     10 dB av nettopp den. Da forsvant tyngden i den beste lyden de lager. */
  function fjernRomling(d, sr) {
    var rc = 1 / (2 * Math.PI * 45), a = rc / (rc + 1 / sr);
    for (var ledd = 0; ledd < 3; ledd++) {
      var forrige = 0, forrigeUt = 0;
      for (var i = 0; i < d.length; i++) {
        var x = d[i];
        forrigeUt = a * (forrigeUt + x - forrige);
        forrige = x;
        d[i] = forrigeUt;
      }
    }
    return d;
  }

  /* Trimming er det som avgjør om loopen lander på slaget. Et opptak med et
     halvt sekund nøling foran kommer alltid for sent, uansett hvor godt
     barnet traff. */
  function trim(d, sr) {
    var ramme = 256, n = Math.floor(d.length / ramme);
    if (n < 4) return null;
    var rms = new Float32Array(n), topp = 0, i, j;
    for (i = 0; i < n; i++) {
      var sum = 0;
      for (j = 0; j < ramme; j++) {
        var x = d[i * ramme + j];
        sum += x * x;
        if (Math.abs(x) > topp) topp = Math.abs(x);
      }
      rms[i] = Math.sqrt(sum / ramme);
    }

    /* Terskelen måles mot to ting: den kraftigste delen av opptaket, og
       rommets eget gulv. En fast grense duger ikke — den ville kuttet vekk en
       hvisking i et stille rom og sluppet gjennom viften i et bråkete. Gulvet
       anslås som 20. persentil, altså det som er stille mesteparten av tiden. */
    var sortert = Array.prototype.slice.call(rms).sort(function (a, b) { return a - b; });
    var gulv = sortert[Math.floor(n * 0.2)];
    var maksRms = sortert[n - 1];
    if (maksRms < 0.006 || maksRms < gulv * 2.5) return null;   // ingen hørte noe
    var terskel = Math.max(maksRms * 0.12, gulv * 3, 0.0025);

    var forste = -1, siste = -1;
    for (i = 0; i < n; i++) if (rms[i] > terskel) { if (forste < 0) forste = i; siste = i; }
    if (forste < 0) return null;
    var start = Math.max(0, forste * ramme - Math.floor(sr * 0.02));
    var slutt = Math.min(d.length, (siste + 1) * ramme + Math.floor(sr * 0.08));
    return { data: d.subarray(start, slutt), topp: topp };
  }

  function normaliser(d, topp) {
    /* Et barn som hvisker skal høres like godt som et som roper. Forsterkningen
       har tak, ellers blir et nesten tomt opptak til ren susing. */
    var faktor = Math.min(0.92 / Math.max(topp, 0.0001), 14);
    for (var i = 0; i < d.length; i++) d[i] *= faktor;
    return d;
  }

  function toning(d, sr) {
    var inn = Math.min(Math.floor(sr * 0.008), d.length >> 1);
    var ut = Math.min(Math.floor(sr * 0.03), d.length >> 1);
    for (var i = 0; i < inn; i++) d[i] *= i / inn;
    for (var k = 0; k < ut; k++) d[d.length - 1 - k] *= k / ut;
    return d;
  }

  /* Hele veien fra rå mikrofondata til en loopbar lyd, samlet på ett sted:
     rydd bort romling, klipp vekk stillheten rundt, løft volumet og legg på
     myke ender. Rekkefølgen er ikke tilfeldig — trimmingen må skje etter
     filteret, ellers teller romlingen som lyd og stillheten blir aldri funnet. */
  function etterarbeid(raa, sr) {
    if (!raa || !raa.length) return null;
    fjernRomling(raa, sr);
    var t = trim(raa, sr);
    if (!t) return null;
    var d = new Float32Array(t.data);        // egen kopi, subarray deler minne
    normaliser(d, t.topp);
    toning(d, sr);
    return d;
  }

  function avslutt() {
    tarOpp = false;
    var c = Motor.ctx;
    var d = etterarbeid(flett(), c.sampleRate);
    biter = [];
    if (!d) return null;
    var buf = c.createBuffer(1, d.length, c.sampleRate);
    if (buf.copyToChannel) buf.copyToChannel(d, 0); else buf.getChannelData(0).set(d);
    return buf;
  }

  function niva() {
    if (!analyse) return 0;
    var d = new Uint8Array(analyse.fftSize);
    analyse.getByteTimeDomainData(d);
    var sum = 0;
    for (var i = 0; i < d.length; i++) {
      var x = (d[i] - 128) / 128;
      sum += x * x;
    }
    return Math.sqrt(sum / d.length);
  }

  return {
    MAKS_SEK: MAKS_SEK,
    aapne: aapne, slipp: slipp, begynn: begynn, avslutt: avslutt,
    etterarbeid: etterarbeid, niva: niva,
    get analyse() { return analyse; },
    get lydKommer() { return lydKommer; },
    get aktiv() { return aktiv; }
  };
})();


/* Lageret. Lydene ligger som ferdige WAV-blober i IndexedDB, mens selve
   brettet (hvem som står hvor, hvilken effekt, tempo) ligger i localStorage.
   Delingen er med vilje: brettet er noen få hundre tegn og skal leses
   synkront ved oppstart, lydene er megabyte og skal ikke være i veien. */
var Lager = (function () {
  'use strict';

  var NAVN = 'beatboks', BUTIKK = 'lyder', db = null;

  function aapne() {
    if (db) return Promise.resolve(db);
    return new Promise(function (ok, nei) {
      var f = indexedDB.open(NAVN, 1);
      f.onupgradeneeded = function () {
        if (!f.result.objectStoreNames.contains(BUTIKK)) {
          f.result.createObjectStore(BUTIKK, { keyPath: 'id' });
        }
      };
      f.onsuccess = function () { db = f.result; ok(db); };
      f.onerror = function () { nei(f.error); };
    });
  }

  function handle(modus, jobb) {
    return aapne().then(function (d) {
      return new Promise(function (ok, nei) {
        var t = d.transaction(BUTIKK, modus), b = t.objectStore(BUTIKK);
        var svar = jobb(b);
        t.oncomplete = function () { ok(svar && svar.result !== undefined ? svar.result : svar); };
        t.onerror = function () { nei(t.error); };
      });
    });
  }

  function lagre(id, blob) {
    return handle('readwrite', function (b) { return b.put({ id: id, blob: blob }); });
  }

  function hent(id) {
    return handle('readonly', function (b) { return b.get(id); }).then(function (r) {
      return r ? r.blob : null;
    });
  }

  function slett(id) {
    return handle('readwrite', function (b) { return b.delete(id); });
  }

  function alleNokler() {
    return handle('readonly', function (b) { return b.getAllKeys(); });
  }

  /* Blob inn, spillbar buffer ut. decodeAudioData på iOS liker ikke
     løftebaserte kall i eldre versjoner, så tilbakekall-varianten brukes
     som reserve. */
  function tilBuffer(blob) {
    return blob.arrayBuffer().then(function (ab) {
      return new Promise(function (ok, nei) {
        var p = Motor.ctx.decodeAudioData(ab, ok, nei);
        if (p && p.then) p.then(ok, nei);
      });
    });
  }

  return { lagre: lagre, hent: hent, slett: slett, alleNokler: alleNokler, tilBuffer: tilBuffer };
})();
