/* Appen gir lydene navn selv, ut fra hvordan de faktisk låter.

   Navnene er lydmalende — BUMM, TSS, KLASK, PIIIP — fordi det er slik barn
   selv snakker om lyder, og fordi et navn som låter som lyden gjør det mulig å
   finne den igjen blant mange. «LYD 147» sier ingenting; «KLASK» sier alt.

   Rekkefølgen i avgjørelsen:
     1. Består lyden av flere tydelige slag, blir navnet slagene etter hverandre:
        BUM-TSS, PA-TS-PA. Det er det mest treffende et navn kan være.
     2. Er det én lang lyd, bestemmer tone og klang: et nynn er noe annet enn
        luft, og en pipestemme noe annet enn en brummebass.
     3. Ellers er det ett kort slag, og da avgjør hva slags slag det var.

   Samme lyd gir alltid samme forslag, men to ulike opptak av samme type lyd
   får ulike ord fra listene — ellers ville hundre dype slag hett BUMM alle
   sammen. Er alle ordene i en liste brukt opp, får det siste et tall bak. */
var Navn = (function () {
  'use strict';

  var MAKS = 10;          // det er det et kort har plass til

  /* Ord for én hel lyd. De er gruppert etter hva lyden er, og hver gruppe har
     nok varianter til at en gutt med tretti dype slag får mange ulike navn før
     tallene begynner. */
  var ORD = {
    dunder: ['BUMM', 'DUNK', 'BONK', 'BOOM', 'DUMP', 'BONG', 'DUNDER', 'BUMP', 'DONK', 'BRAK'],
    skarp: ['PAFF', 'KLASK', 'PANG', 'SMASK', 'KRASJ', 'PÆNG', 'KLAPP', 'SMELL', 'BANG', 'PIFF'],
    tikk: ['TSS', 'TSJ', 'TIKK', 'KLIKK', 'TSK', 'TIKKE', 'TJIK', 'SKK', 'KLIK', 'TSIK'],
    riste: ['TSSSS', 'SJJJ', 'FSSST', 'SHHH', 'TSJJJ', 'SSSST', 'RISTE', 'SJSJ'],
    rare: ['POPP', 'KLOKK', 'BLOPP', 'PLOPP', 'TOKK', 'KLUNK', 'BLUBB', 'PLUPP', 'KLONK', 'POK'],
    hoyTone: ['PIIIP', 'HIIII', 'PLING', 'VIIIU', 'TIIIT', 'PIIUU', 'IIIH', 'PLIIING'],
    dypTone: ['MØØØ', 'HUMMM', 'BRUUM', 'OOOH', 'UUUH', 'MMMM', 'BØØØ', 'HOOO'],
    lysLuft: ['SHHHH', 'FSSSS', 'PSSST', 'VÆSJ', 'KSSJ', 'HVISJ', 'SVISJ', 'FFFF'],
    dypLuft: ['BRRRR', 'RUMMEL', 'GRRRR', 'DRØØN', 'BRUMM', 'RRRR', 'BRØØØ'],
    midLuft: ['VÆÆÆ', 'AAAH', 'NÆÆÆ', 'BÆÆÆ', 'HÆÆÆ', 'ÆÆÆÆ', 'OAAA']
  };

  /* Stavelser for lyder som er en liten rytme. De er kortere enn ordene over,
     så tre av dem får plass på et kort. */
  var STAVELSE = {
    dunder: ['BUM', 'DUN', 'BOM', 'DUM'],
    skarp: ['PA', 'KA', 'PAF', 'TA'],
    tikk: ['TS', 'TSS', 'TI', 'TSK'],
    riste: ['TSSS', 'SJ', 'SSS'],
    rare: ['POP', 'TOK', 'KLO', 'PLO']
  };

  function hash(buffer) {
    var d = buffer.getChannelData(0), h = 2166136261;
    var steg = Math.max(1, Math.floor(d.length / 97));
    for (var i = 0; i < d.length; i += steg) {
      h ^= Math.floor((d[i] + 1) * 4096);
      h = Math.imul(h, 16777619);
    }
    h ^= d.length;
    return h >>> 0;
  }

  // listen rotert slik at hver lyd begynner et eget sted i den
  function rotert(liste, fro) {
    var start = fro % liste.length;
    return liste.slice(start).concat(liste.slice(0, start));
  }

  /* Slag som kommer tettere enn 150 ms er i praksis ett slag — «bdum» har et b
     og et dum, men ingen barn ville kalt den BUM-BUM. Svake slag teller heller
     ikke; de er etterklang og pust, ikke noe barnet laget med vilje. */
  function tydeligeSlag(b) {
    if (!b.treff.length) return [];
    var sterkest = 0;
    b.treff.forEach(function (t) { if (t.styrke > sterkest) sterkest = t.styrke; });
    var ut = [];
    b.treff.forEach(function (t) {
      if (t.styrke < sterkest * 0.3) return;
      if (ut.length && t.tid - ut[ut.length - 1].tid < 0.15) return;
      ut.push(t);
    });
    return ut;
  }

  function rytmeNavn(slag, fro) {
    var kandidater = [];
    for (var v = 0; v < 4; v++) {
      for (var antall = Math.min(3, slag.length); antall >= 1; antall--) {
        var deler = slag.slice(0, antall).map(function (t, i) {
          var liste = STAVELSE[t.kategori] || STAVELSE.skarp;
          // samme variant for samme slagtype i ett navn, så det blir BUM-TS-BUM
          return liste[(fro + v) % liste.length];
        });
        var navn = deler.join('-');
        if (navn.length <= MAKS) { kandidater.push(navn); break; }
      }
    }
    return kandidater;
  }

  /* Alle forslagene i prioritert rekkefølge. Det første ledige blir brukt. */
  function forslag(b, fro) {
    /* Lang lyd sjekkes FØR rytme. Et langt «shhh» eller «mmmm» svinger hele
       tiden litt, og hver svingning ser ut som et nytt slag — uten denne
       rekkefølgen ble et sus til TSK-SSS og et nynn til BUM-POP. En lyd som
       holder seg oppe hele veien er én lyd, uansett hvor mange topper den har. */
    if (b.holder > 0.35) {
      if (b.tonal) return rotert(b.hz > 300 ? ORD.hoyTone : ORD.dypTone, fro);
      if (b.andel.hoy > 0.45) return rotert(ORD.lysLuft, fro);
      if (b.andel.lav > 0.4) return rotert(ORD.dypLuft, fro);
      return rotert(ORD.midLuft, fro);
    }

    var slag = tydeligeSlag(b);
    if (slag.length >= 2) {
      return rytmeNavn(slag, fro).concat(rotert(ORD[slag[0].kategori] || ORD.skarp, fro));
    }

    var kat = slag.length ? slag[0].kategori : b.helhet;
    return rotert(ORD[kat] || ORD.skarp, fro);
  }

  function ledig(kandidater, opptatte) {
    var brukt = {};
    (opptatte || []).forEach(function (n) { brukt[String(n).toUpperCase()] = true; });
    for (var i = 0; i < kandidater.length; i++) {
      var k = kandidater[i].slice(0, MAKS);
      if (!brukt[k]) return k;
    }
    /* Alle ordene er tatt. Da får det første et tall bak, og ordet kuttes om
       nødvendig så navnet fortsatt får plass på kortet. */
    var grunn = kandidater[0] || 'LYD';
    for (var n = 2; n < 10000; n++) {
      var hale = ' ' + n;
      var navn = grunn.slice(0, MAKS - hale.length) + hale;
      if (!brukt[navn]) return navn;
    }
    return grunn.slice(0, MAKS);
  }

  /* Hovedinngangen: et opptak inn, et ledig navn ut. */
  function lag(buffer, opptatte) {
    var b = null;
    try { b = Analyse.beskriv(buffer); } catch (e) { b = null; }
    if (!b) return ledig(['LYD'], opptatte);
    return ledig(forslag(b, hash(buffer)), opptatte);
  }

  return { lag: lag, forslag: forslag, MAKS: MAKS };
})();
