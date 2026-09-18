/* Å høre etter hva slags lyd barnet laget.

   Brukes til å gi hver lyd et navn som passer (navn.js). Tre steg:
     1. Del lyden i tre frekvensbånd og finn hvor det smeller (anslagene).
     2. Kjenn igjen hva slags smell det var, ut fra hvordan energien fordeler
        seg mellom båndene.
     3. Mål tonehøyde og hvor lenge lyden holder seg oppe, så et nynn skilles
        fra et sus og en pipestemme fra en brummebass. */
var Analyse = (function () {
  'use strict';

  var HOPP = 256;            // sampler mellom hver måling, ca. 5 ms ved 48 kHz

  /* ---------- filtre ---------- */

  function lavpass(sr, fc) {
    var a = 1 - Math.exp(-2 * Math.PI * fc / sr), y = 0;
    return function (x) { y += a * (x - y); return y; };
  }

  function hoypass(sr, fc) {
    var rc = 1 / (2 * Math.PI * fc), a = rc / (rc + 1 / sr), y = 0, forrige = 0;
    return function (x) { y = a * (y + x - forrige); forrige = x; return y; };
  }

  /* Tre bånd som svarer til hvordan en beatbox faktisk er bygd:
     dype trykk (kick), kropp og knekk (skarptromme, stemme), og luft (hi-hat,
     tss). Alt som skal gjenkjennes videre leses ut av forholdet mellom dem. */
  function baand(d, sr) {
    var rammer = Math.floor(d.length / HOPP);
    var lav = new Float32Array(rammer), mid = new Float32Array(rammer), hoy = new Float32Array(rammer);
    var lp1 = lavpass(sr, 170), lp2 = lavpass(sr, 170);
    var mhp1 = hoypass(sr, 260), mhp2 = hoypass(sr, 260);
    var mlp1 = lavpass(sr, 2300), mlp2 = lavpass(sr, 2300);
    var hhp1 = hoypass(sr, 5200), hhp2 = hoypass(sr, 5200);

    for (var r = 0; r < rammer; r++) {
      var sL = 0, sM = 0, sH = 0;
      var start = r * HOPP;
      for (var i = 0; i < HOPP; i++) {
        var x = d[start + i];
        var l = lp2(lp1(x));
        var m = mlp2(mlp1(mhp2(mhp1(x))));
        var h = hhp2(hhp1(x));
        sL += l * l; sM += m * m; sH += h * h;
      }
      lav[r] = Math.sqrt(sL / HOPP);
      mid[r] = Math.sqrt(sM / HOPP);
      hoy[r] = Math.sqrt(sH / HOPP);
    }
    return { lav: lav, mid: mid, hoy: hoy, rammer: rammer, rammeTid: HOPP / sr };
  }

  /* ---------- anslag ---------- */

  /* Vi ser etter ØKNING i energi, ikke etter høy energi. Et hi-hat som slås
     midt i etterklangen fra en kick har lav absolutt energi, men en tydelig
     økning i det lyse båndet — og det er det slaget barnet mente å lage. */
  function anslag(b, stegLengde) {
    var n = b.rammer, flyt = new Float32Array(n), i, k;

    /* Energien måles mot det HØYESTE av de tre foregående rammene, ikke mot
       den forrige alene. Grunnen er kicken: den sveiper nedover i tonehøyde,
       så grunntonen vandrer inn i det dype båndet et stykke ETTER anslaget og
       lager en ny energiøkning. Mot bare forrige ramme ble ett kickslag til
       tre. Et ekte nytt slag stiger brått og overlever sammenlikningen; et
       langsomt svell gjør det ikke. */
    function stig(spor, i) {
      var bak = Math.max(spor[i - 1], spor[i - 2], spor[i - 3]);
      return Math.max(0, spor[i] - bak);
    }
    for (i = 3; i < n; i++) {
      flyt[i] = stig(b.lav, i) + stig(b.mid, i) + stig(b.hoy, i);
    }

    /* Terskelen følger med på hvor bråkete det er akkurat der. En fast grense
       ville tatt med alt i et kraftig parti og ingenting i et forsiktig et. */
    var vindu = 24, treff = [];
    var sisteRamme = -99, sisteStyrke = 0;
    /* Sperretiden henger sammen med tempoet: to slag nærmere hverandre enn en
       drøy halv sekstendedel er i praksis ett slag, uansett hva filteret sier. */
    var minAvstand = Math.max(3, Math.round(Math.max(0.045, stegLengde * 0.55) / b.rammeTid));
    /* Styrkesperren under må være KORTERE enn ett steg. Ellers rammer den det
       vanligste mønsteret i all beatboxing — et kraftig «bdum» fulgt av et
       spinkelt «ts» på neste sekstendedel — og halve hi-haten forsvinner. */
    var naboAvstand = Math.round(stegLengde * 0.75 / b.rammeTid);

    for (i = 3; i < n - 1; i++) {
      var fra = Math.max(0, i - vindu), til = Math.min(n, i + vindu);
      var sum = 0;
      for (k = fra; k < til; k++) sum += flyt[k];
      var terskel = (sum / (til - fra)) * 1.5 + 0.004;
      if (flyt[i] < terskel) continue;
      if (flyt[i] < flyt[i - 1] || flyt[i] < flyt[i + 1]) continue;   // må være en topp
      if (i - sisteRamme < minAvstand) continue;
      /* Like etter et kraftig slag holder etterklangen på å dø ut, og små
         ujevnheter i den ser ut som nye anslag. Et ekte slag så tett innpå må
         være av samme størrelsesorden som det forrige. */
      if (i - sisteRamme < naboAvstand && flyt[i] < sisteStyrke * 0.5) continue;
      sisteRamme = i;
      sisteStyrke = flyt[i];
      treff.push({ ramme: i, tid: i * b.rammeTid, styrke: flyt[i] });
    }
    return treff;
  }

  /* ---------- hva slags slag var det? ---------- */

  /* Det som teller er hvor mye hvert bånd ØKER i anslaget, ikke hvor mye
     energi som ligger der. Forskjellen er avgjørende: en hi-hat som slås 200 ms
     etter en kick står fortsatt i kickens bass-hale, og målt absolutt ser den
     ut som en skarptromme. Målt som økning er den det den er — bare luft. */
  function kjennIgjen(b, t) {
    var n = b.rammer;
    var lengde = Math.max(2, Math.round(0.045 / b.rammeTid));
    var fore = Math.max(0, t.ramme - 2);
    var gL = b.lav[fore], gM = b.mid[fore], gH = b.hoy[fore];
    var eL = 0, eM = 0, eH = 0, toppH = 0, i;
    for (i = t.ramme; i < Math.min(n, t.ramme + lengde); i++) {
      eL += Math.max(0, b.lav[i] - gL);
      eM += Math.max(0, b.mid[i] - gM);
      var h = Math.max(0, b.hoy[i] - gH);
      eH += h;
      if (h > toppH) toppH = h;
    }
    var sum = eL + eM + eH;
    if (sum <= 0) return null;
    var pL = eL / sum, pM = eM / sum, pH = eH / sum;

    /* Hvor lenge holder det lyse båndet seg oppe? Det er forskjellen på et
       kort «ts» (hi-hat) og et langt «tsss» (rytmeegg). */
    var holder = 0;
    for (i = t.ramme; i < Math.min(n, t.ramme + Math.round(0.25 / b.rammeTid)); i++) {
      if (Math.max(0, b.hoy[i] - gH) < toppH * 0.25) break;
      holder++;
    }
    var holderSek = holder * b.rammeTid;

    t.deler = { lav: pL, mid: pM, hoy: pH, holder: holderSek };
    return kategori(pL, pM, pH, holderSek);
  }

  /* Selve avgjørelsen, skilt ut så den kan brukes både på ett anslag og på en
     hel lyd som ikke har noe tydelig anslag i det hele tatt. */
  function kategori(pL, pM, pH, holderSek) {
    if (pL > 0.42) return 'dunder';                      // dypt trykk
    /* Lyst og kort er en hi-hat, lyst og langtrukkent er et rytmeegg. Skillet
       går ved hvor lenge lufta holder seg oppe — «ts» mot «tsssss». */
    if (pH > 0.46 && pL < 0.22) return holderSek > 0.06 ? 'riste' : 'tikk';
    if (pH > 0.2 && pM > 0.22) return 'skarp';           // bredbåndet knekk
    if (pM > 0.45) return 'rare';
    return 'skarp';
  }

  /* ---------- én enkelt lyd ---------- */

  /* Tonehøyde ved autokorrelasjon i det kraftigste partiet av lyden. Det skiller
     et nynnet «mmmm» (tydelig tone) fra et «shhh» (bare luft), og en pipestemme
     fra en brummebass. Vinduet må være lengre enn den lengste perioden vi leter
     etter, ellers ser vi aldri en hel svingning av de dype tonene. */
  function tonehoyde(d, sr) {
    var vindu = Math.min(2048, d.length);
    var minLag = Math.floor(sr / 1000), maxLag = Math.floor(sr / 70);
    if (vindu <= maxLag + 16) return { tonal: false, hz: 0, styrke: 0 };
    var start = 0, best = -1, i, k;
    for (i = 0; i + vindu <= d.length; i += 512) {
      var e = 0;
      for (k = 0; k < vindu; k += 4) e += d[i + k] * d[i + k];
      if (e > best) { best = e; start = i; }
    }
    var r0 = 0;
    for (k = 0; k < vindu; k++) r0 += d[start + k] * d[start + k];
    if (r0 <= 0) return { tonal: false, hz: 0, styrke: 0 };
    var r = new Float32Array(maxLag + 2), maks = 0, lag;
    for (lag = minLag; lag <= maxLag + 1; lag++) {
      var sum = 0;
      for (k = 0; k + lag < vindu; k++) sum += d[start + k] * d[start + k + lag];
      r[lag] = sum / r0;
      if (lag <= maxLag && r[lag] > maks) maks = r[lag];
    }
    /* Den FØRSTE toppen som er nesten like høy som den høyeste, ikke den
       høyeste. En tone gir topper ved hvert eneste multiplum av perioden, og
       den høyeste kan godt ligge langt ute: en pipestemme på 620 Hz ble målt
       til 78 Hz, åtte perioder ut, og fikk et brummenavn. Uten korreksjon for
       antall ledd synker toppene utover av seg selv, og da vinner den første. */
    var besteLag = 0;
    for (lag = minLag + 1; lag <= maxLag; lag++) {
      if (r[lag] >= maks * 0.9 && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
        besteLag = lag;
        break;
      }
    }
    var styrke = besteLag ? r[besteLag] : 0;
    return { tonal: styrke > 0.45, hz: besteLag ? sr / besteLag : 0, styrke: styrke };
  }

  /* Hva slags lyd er dette? Brukes til å gi lyden et navn som passer. Svaret
     er ikke én kategori men et lite bilde: hvor den ligger i frekvens, hvor
     lenge den varer, om den har tone, og hvilke slag den består av. */
  function beskriv(buffer) {
    var d = buffer.getChannelData(0), sr = buffer.sampleRate;
    var b = baand(d, sr);
    if (b.rammer < 4) return null;

    var treff = anslag(b, 0.12), i;
    for (i = treff.length - 1; i >= 0; i--) {
      var k = kjennIgjen(b, treff[i]);
      if (!k) treff.splice(i, 1); else treff[i].kategori = k;
    }

    var sL = 0, sM = 0, sH = 0, topp = 0, energi = new Float32Array(b.rammer);
    for (i = 0; i < b.rammer; i++) {
      sL += b.lav[i]; sM += b.mid[i]; sH += b.hoy[i];
      energi[i] = b.lav[i] + b.mid[i] + b.hoy[i];
      if (energi[i] > topp) topp = energi[i];
    }
    var sum = sL + sM + sH || 1;
    /* Hvor lenge lyden holder seg oppe, ikke hvor lang fila er. En kort «bum»
       med lang etterklang og et langt «mmmmm» kan ha samme lengde på fila. */
    var oppe = 0;
    for (i = 0; i < b.rammer; i++) if (energi[i] > topp * 0.25) oppe++;

    var t = tonehoyde(d, sr);
    var andel = { lav: sL / sum, mid: sM / sum, hoy: sH / sum };
    return {
      varighet: d.length / sr,
      holder: oppe * b.rammeTid,
      andel: andel,
      tonal: t.tonal, hz: t.hz,
      treff: treff,
      // hele lyden sett under ett, for når den ikke har noe tydelig anslag
      helhet: kategori(andel.lav, andel.mid, andel.hoy, oppe * b.rammeTid)
    };
  }

  return { beskriv: beskriv };
})();
