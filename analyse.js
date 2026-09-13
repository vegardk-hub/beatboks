/* Å høre etter hva barnet gjorde, og skrive det ned som en beat.

   Oppgaven er ikke å gjengi opptaket. Den er å finne MENINGEN i det: hvor
   slagene ligger i takten, og hva slags trommer de forsøkte å lage. Resultatet
   skal være en ryddig løkke som går rundt og rundt og låter bra — ikke et
   fotografi av ti sekunder med prøving og feiling.

   Tre steg:
     1. Del lyden i tre frekvensbånd og finn hvor det smeller (anslagene).
     2. Kjenn igjen hva slags smell det var, ut fra hvordan energien fordeler
        seg mellom båndene.
     3. Legg anslagene på taktrutenettet, og la de fire taktene stemme over
        hva som faktisk hører hjemme i løkka.

   Tempoet gjettes IKKE. Barna beatboxer mens steglysene løper, så appen vet
   allerede hvor raskt det går — den trenger bare å finne ut hvor i takten de
   begynte. Det er både mer treffsikkert enn tempogjetting og lettere å forstå:
   følger du lysene, blir beaten din. */
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

    if (pL > 0.42) return 'dunder';                      // dypt trykk
    /* Lyst og kort er en hi-hat, lyst og langtrukkent er et rytmeegg. Skillet
       går ved hvor lenge lufta holder seg oppe — «ts» mot «tsssss». */
    if (pH > 0.46 && pL < 0.22) return holderSek > 0.06 ? 'riste' : 'tikk';
    if (pH > 0.2 && pM > 0.22) return 'skarp';           // bredbåndet knekk
    if (pM > 0.45) return 'rare';
    return 'skarp';
  }

  /* ---------- legg slagene på rutenettet ---------- */

  /* Fasen finnes ved å prøve alle startpunkter innenfor ett steg og velge det
     som får flest og kraftigst slag til å lande nær en rutelinje. Da slipper
     vi å vite noe om forsinkelsen i mikrofonen eller nøyaktig når opptaket
     begynte — og barnet slipper å treffe første slag perfekt. */
  function finnFase(treff, stegLengde) {
    var beste = 0, bestePoeng = -1;
    for (var k = 0; k < 32; k++) {
      var fase = k / 32 * stegLengde, poeng = 0;
      for (var i = 0; i < treff.length; i++) {
        var pos = (treff[i].tid - fase) / stegLengde;
        var avvik = Math.abs(pos - Math.round(pos));      // 0 = midt på, 0.5 = mellom
        poeng += treff[i].styrke * (1 - avvik * 2);
      }
      if (poeng > bestePoeng) { bestePoeng = poeng; beste = fase; }
    }
    return beste;
  }

  var RYTMEINSTRUMENTER = ['dunder', 'skarp', 'tikk', 'riste', 'rare'];

  function tomtKart() {
    var k = {};
    RYTMEINSTRUMENTER.forEach(function (id) {
      k[id] = [];
      for (var i = 0; i < 16; i++) k[id].push({ takter: {}, styrke: 0 });
    });
    return k;
  }

  /* ---------- sporene som følger av de andre ----------

     Klapp, bass og blipp bestemmes ikke av hva barnet sa, men av hva de fem
     rytmesporene ble. Derfor regnes de ut for seg — og på nytt hver gang barnet
     endrer en rute i kartet, slik at bassen henger med når de flytter kicken. */

  function utled(spor) {
    var i;

    /* Klappet legger seg oppå de kraftigste skarptrommeslagene. Da har barnet
       et lag til å skru på som tykner nettopp der de selv la trykket. */
    spor.klapp = spor.skarp.replace(/o/g, '.');

    /* Bass følger kicken, så bunnen henger sammen. */
    var bassToner = ['A1', 'A1', 'C2', 'E2'], bass = [], nr = 0;
    for (i = 0; i < 16; i++) {
      bass.push(spor.dunder.charAt(i) !== '.' ? bassToner[nr++ % bassToner.length] : null);
    }

    /* Blipp legger seg i hullene — der ingenting skjer — så melodien fyller ut
       i stedet for å slåss med slagene. */
    var opptatt = [];
    for (i = 0; i < 16; i++) {
      opptatt.push(RYTMEINSTRUMENTER.some(function (id) { return spor[id].charAt(i) !== '.'; }));
    }
    var blippToner = ['A4', 'C5', 'E5', 'D5'], blipp = [], satt = 0;
    for (i = 0; i < 16; i++) blipp.push(null);
    // først de tunge halvslagene, så de lette
    for (i = 0; i < 16 && satt < 4; i += 2) {
      if (!opptatt[i]) blipp[i] = blippToner[satt++];
    }
    for (i = 1; i < 16 && satt < 4; i += 2) {
      if (!opptatt[i]) blipp[i] = blippToner[satt++];
    }
    // er hver eneste rute i bruk, legger den seg oppå — da er beaten uansett tett
    if (satt === 0) { blipp[2] = 'A4'; blipp[10] = 'C5'; }

    spor.bass = bass;
    spor.blipp = blipp;
    return spor;
  }

  /* ---------- hele jobben ---------- */

  function tilBeat(buffer, bpm) {
    var d = buffer.getChannelData(0), sr = buffer.sampleRate;
    var stegLengde = 60 / bpm / 4;
    var b = baand(d, sr);
    var treff = anslag(b, stegLengde);
    if (treff.length < 4) return null;         // for lite å bygge noe av

    var i, t;
    for (i = treff.length - 1; i >= 0; i--) {
      var kat = kjennIgjen(b, treff[i]);
      if (!kat) treff.splice(i, 1); else treff[i].kategori = kat;
    }
    if (treff.length < 4) return null;

    var fase = finnFase(treff, stegLengde);
    for (i = 0; i < treff.length; i++) {
      treff[i].steg = Math.round((treff[i].tid - fase) / stegLengde);
    }

    /* Roter takten slik at det stedet de fleste dype slagene ligger blir
       ett-slaget. Barn begynner sjelden nøyaktig på toppen av takten, og en
       løkke som starter midt i sitt eget mønster låter feil. */
    var kickVekt = new Array(16);
    for (i = 0; i < 16; i++) kickVekt[i] = 0;
    for (i = 0; i < treff.length; i++) {
      if (treff[i].kategori === 'dunder') {
        kickVekt[((treff[i].steg % 16) + 16) % 16] += treff[i].styrke;
      }
    }
    var tyngst = 0, best = -1;
    for (i = 0; i < 16; i++) if (kickVekt[i] > best) { best = kickVekt[i]; tyngst = i; }

    /* Rotasjonen griper bare inn når den trengs. Barna beatboxer mens lysene
       løper, så steg 0 ER ett-slaget — med mindre de tydelig begynte et helt
       annet sted. Uten forbeholdet flyttet den takten hver gang kickene lå
       jevnt fordelt, og en riktig funnet rytme kom ut vridd. */
    var rot = 0;
    if (best > 0 && kickVekt[0] < best * 0.6) rot = tyngst;

    /* Takt- og stegnummer regnes ut FØR rotasjonen, og rotasjonen brukes bare
       til å flytte merkelappen «her begynner takten» helt til slutt. Roterte vi
       de globale stegene, ville den første deltakten falt utenfor og den siste
       blitt halv — og da fikk avstemningen under feil grunnlag å telle på. */
    var kart = tomtKart(), takter = {};
    for (i = 0; i < treff.length; i++) {
      t = treff[i];
      var g = t.steg;
      if (g < 0) continue;
      var takt = Math.floor(g / 16), steg = g % 16;
      takter[takt] = true;
      var rute = kart[t.kategori][steg];
      rute.takter[takt] = true;
      rute.styrke = Math.max(rute.styrke, t.styrke);
    }
    var antallTakter = Object.keys(takter).length;
    if (!antallTakter) return null;

    /* Avstemning: et slag som kommer igjen i flere takter hører til i løkka,
       et som bare skjedde én gang var sannsynligvis en glipp. Det som kommer
       igjen hver gang blir hardt, det som kommer av og til blir mykt. */
    var spor = {};
    RYTMEINSTRUMENTER.forEach(function (id) {
      var tegn = [];
      for (var s = 0; s < 16; s++) {
        var rute = kart[id][s];
        var n = Object.keys(rute.takter).length;
        if (antallTakter <= 1) {
          tegn.push(n ? (rute.styrke > 0.05 ? 'x' : 'o') : '.');
        } else if (n >= Math.max(2, Math.ceil(antallTakter * 0.6))) {
          tegn.push('x');
        } else if (n >= 2 || (antallTakter === 2 && n >= 1)) {
          tegn.push('o');
        } else {
          tegn.push('.');
        }
      }
      // her flyttes ett-slaget dit de fleste dype slagene lå
      var s = tegn.join('');
      spor[id] = s.slice(rot) + s.slice(0, rot);
    });

    // «rare» bruker egne tegn for sine to lyder
    spor.rare = spor.rare.replace(/x/g, 'k').replace(/o/g, 'r');

    utled(spor);

    var antall = {};
    RYTMEINSTRUMENTER.forEach(function (id) {
      antall[id] = (spor[id].match(/[^.]/g) || []).length;
    });

    return {
      spor: spor,
      antall: antall,
      slagFunnet: treff.length,
      takter: antallTakter,
      // mellomregningen blir med ut, så det går an å se HVA appen hørte
      fase: fase,
      rotasjon: rot,
      treff: treff
    };
  }

  return { tilBeat: tilBeat, utled: utled, RYTMEINSTRUMENTER: RYTMEINSTRUMENTER };
})();
