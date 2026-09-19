/* Monstrene tegnes, de er ikke bilder.

   Hvorfor: hver lyd barna tar opp skal få sin egen skapning, og vi vet ikke på
   forhånd hvor mange det blir. En generator gir uendelig mange varianter uten
   at appen vokser med en eneste kilobyte, og den samme frøverdien gir alltid
   det samme monsteret — så Vetle sin «BDUM» ser likedan ut i morgen.

   Den viktigste lærdommen fra første forsøk: variasjon i pynt hjelper ikke.
   Med bare én kroppsform ble alle monstrene samme hode med ulikt antall øyne.
   Det øyet fester seg ved er SILHUETTEN. Derfor er det nå åtte helt ulike
   kroppsformer, og de bestemmer hvor ansikt, armer og bein havner — ikke
   omvendt. */
var Monstre = (function () {
  'use strict';

  /* ---------- forutsigbar tilfeldighet ---------- */

  /* Math.random duger ikke: monsteret må se likt ut hver gang brettet tegnes
     på nytt, og likt i morgen. */
  function terning(fro) {
    var a = fro >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fro(tekst) {
    var h = 2166136261;
    for (var i = 0; i < tekst.length; i++) {
      h ^= tekst.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function velg(rnd, liste) { return liste[Math.floor(rnd() * liste.length)]; }
  function mellomtall(rnd, a, b) { return a + rnd() * (b - a); }

  /* ---------- tegnehjelpere ---------- */

  function tall(x) { return Math.round(x * 10) / 10; }
  function P(x, y) { return tall(x) + ' ' + tall(y); }

  function paaVei(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

  /* Lukket kurve gjennom punktene, glattet via midtpunktene. Korteste vei til
     noe som ser levende ut i stedet for konstruert. */
  function glattBane(pkt) {
    var n = pkt.length;
    function midt(a, b) { return P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    var d = 'M' + midt(pkt[n - 1], pkt[0]);
    for (var i = 0; i < n; i++) {
      d += 'Q' + P(pkt[i][0], pkt[i][1]) + ' ' + midt(pkt[i], pkt[(i + 1) % n]);
    }
    return d + 'Z';
  }

  /* Mangekant med avrundede hjørner. rund = 0 gir spisse hjørner, 0.5 gir
     helt myke. Brukes til boks, trekant og pigger. */
  function hjorneBane(pkt, rund) {
    var d = '';
    for (var i = 0; i < pkt.length; i++) {
      var f = pkt[i];
      var forr = pkt[(i - 1 + pkt.length) % pkt.length];
      var nest = pkt[(i + 1) % pkt.length];
      var inn = paaVei(f, forr, rund), ut = paaVei(f, nest, rund);
      d += (i === 0 ? 'M' : 'L') + P(inn[0], inn[1]);
      d += 'Q' + P(f[0], f[1]) + ' ' + P(ut[0], ut[1]);
    }
    return d + 'Z';
  }

  function farge(hue, lys, metning) {
    return 'hsl(' + Math.round(hue) + ' ' + (metning == null ? 95 : metning) + '% ' + lys + '%)';
  }

  function bane(d, f, tykk) {
    return '<path d="' + d + '" fill="' + f.fyll + '" stroke="' + f.strek +
      '" stroke-width="' + (tykk || 3) + '" stroke-linejoin="round"/>';
  }

  function strek(d, farge2, tykk) {
    return '<path d="' + d + '" fill="none" stroke="' + farge2 + '" stroke-width="' +
      tykk + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function sirkel(x, y, r, fyll) {
    return '<circle cx="' + tall(x) + '" cy="' + tall(y) + '" r="' + tall(r) + '" fill="' + fyll + '"/>';
  }

  /* ---------- kroppsformene ----------

     Hver form returnerer silhuetten sin OG hvor ansiktet skal sitte. Det er
     hele poenget: en lang orm skal ha ansiktet øverst, en pyramide litt ned
     der det er bredt nok, en blekksprut midt på. Ansiktskoden under trenger
     aldri vite hvilken form den står i. */

  function kroppKlump(rnd, f) {
    var r = mellomtall(rnd, 26, 33);
    var brede = mellomtall(rnd, 0.8, 1.25);
    var hoy = mellomtall(rnd, 0.85, 1.2);
    var n = 7 + Math.floor(rnd() * 6);
    var ujevn = mellomtall(rnd, 0.08, 0.34);
    var cy = 50, pkt = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 - Math.PI / 2;
      var rr = r * (1 - ujevn / 2 + rnd() * ujevn);
      pkt.push([50 + Math.cos(a) * rr * brede, cy + Math.sin(a) * rr * hoy]);
    }
    var hb = r * brede, hh = r * hoy;
    return {
      deler: [bane(glattBane(pkt), f)],
      topp: cy - hh, bunn: cy + hh, halvbred: hb,
      ansikt: { topp: cy - hh, bunn: cy + hh, halvbred: hb * 0.92 },
      beinPlass: true
    };
  }

  function kroppBoks(rnd, f) {
    var hb = mellomtall(rnd, 22, 30);
    var topp = mellomtall(rnd, 22, 28), bunn = mellomtall(rnd, 74, 82);
    var rund = mellomtall(rnd, 0.1, 0.3);
    var d = hjorneBane([[50 - hb, topp], [50 + hb, topp], [50 + hb, bunn], [50 - hb, bunn]], rund);
    var deler = [bane(d, f, 3.2)];
    // skruer i hjørnene gjør at den leser som maskin og ikke som en pute
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (h) {
      deler.push(sirkel(50 + h[0] * (hb - 5.5), h[1] > 0 ? topp + 5.5 : bunn - 5.5, 1.8, f.aksent));
    });
    return {
      deler: deler, topp: topp, bunn: bunn, halvbred: hb,
      ansikt: { topp: topp + 2, bunn: bunn - 2, halvbred: hb * 0.85 },
      beinPlass: true, maskin: true
    };
  }

  function kroppSpokelse(rnd, f) {
    var hb = mellomtall(rnd, 22, 29);
    var topp = mellomtall(rnd, 18, 24), bunn = mellomtall(rnd, 76, 86);
    var bolger = 3 + Math.floor(rnd() * 3);
    var d = 'M' + P(50 - hb, bunn - 7);
    d += 'L' + P(50 - hb, topp + hb);
    d += 'A' + tall(hb) + ' ' + tall(hb) + ' 0 0 1 ' + P(50 + hb, topp + hb);
    d += 'L' + P(50 + hb, bunn - 7);
    var steg = hb * 2 / bolger;
    for (var i = 0; i < bolger; i++) {
      var x0 = 50 + hb - i * steg, x1 = x0 - steg;
      d += 'Q' + P((x0 + x1) / 2, bunn + 5) + ' ' + P(x1, bunn - 7);
    }
    return {
      deler: [bane(d + 'Z', f)],
      topp: topp, bunn: bunn, halvbred: hb,
      ansikt: { topp: topp + 4, bunn: bunn - 14, halvbred: hb * 0.88 },
      beinPlass: false
    };
  }

  function kroppStolpe(rnd, f) {
    // høy og smal, med ansiktet i den øvre halvdelen — en helt annen silhuett
    var hb = mellomtall(rnd, 15, 21);
    var topp = mellomtall(rnd, 12, 18), bunn = mellomtall(rnd, 66, 74);
    var rund = mellomtall(rnd, 0.3, 0.5);
    var d = hjorneBane([[50 - hb, topp], [50 + hb, topp], [50 + hb, bunn], [50 - hb, bunn]], rund);
    return {
      deler: [bane(d, f)],
      topp: topp, bunn: bunn, halvbred: hb,
      ansikt: { topp: topp + 3, bunn: topp + (bunn - topp) * 0.72, halvbred: hb * 0.95 },
      beinPlass: true, smal: true
    };
  }

  function kroppKlase(rnd, f) {
    /* Overlappende bobler. Hver boble tegnes med ugjennomsiktig fyll oppå den
       forrige, så de indre strekene forsvinner delvis og silhuetten smelter
       sammen — uten at vi trenger filtre eller masker. */
    var stor = mellomtall(rnd, 20, 25);
    var cy = mellomtall(rnd, 48, 54);
    var deler = [], i;
    var smaa = 2 + Math.floor(rnd() * 3);
    /* Ytterkantene måles på de faktiske boblene. Et anslag holdt ikke: med et
       for romslig tak havnet stilkøyne og flekker utenfor figuren, i tom luft. */
    var topp = cy - stor, bunn = cy + stor, hb = stor;
    for (i = 0; i < smaa; i++) {
      var a = -0.5 + (i / smaa) * Math.PI * 2 + rnd() * 0.6;
      var av = stor * mellomtall(rnd, 0.75, 1.0);
      var rr = stor * mellomtall(rnd, 0.5, 0.78);
      var bx = 50 + Math.cos(a) * av, by = cy + Math.sin(a) * av * 0.85;
      topp = Math.min(topp, by - rr);
      bunn = Math.max(bunn, by + rr);
      hb = Math.max(hb, Math.abs(bx - 50) + rr);
      deler.push('<circle cx="' + tall(bx) + '" cy="' + tall(by) +
        '" r="' + tall(rr) + '" fill="' + f.fyll + '" stroke="' + f.strek + '" stroke-width="3"/>');
    }
    deler.push('<circle cx="50" cy="' + tall(cy) + '" r="' + tall(stor) +
      '" fill="' + f.fyll + '" stroke="' + f.strek + '" stroke-width="3"/>');
    return {
      deler: deler, topp: topp, bunn: bunn, halvbred: hb,
      ansikt: { topp: cy - stor, bunn: cy + stor, halvbred: stor * 0.85 },
      beinPlass: false
    };
  }

  function kroppTagg(rnd, f) {
    var ytre = mellomtall(rnd, 30, 36), indre = ytre * mellomtall(rnd, 0.6, 0.78);
    var pigger = 7 + Math.floor(rnd() * 5);
    var cy = 51, pkt = [];
    for (var i = 0; i < pigger * 2; i++) {
      var a = i / (pigger * 2) * Math.PI * 2 - Math.PI / 2;
      var rr = i % 2 ? indre : ytre;
      pkt.push([50 + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.95]);
    }
    return {
      deler: [bane(hjorneBane(pkt, 0.12), f, 2.6)],
      topp: cy - ytre, bunn: cy + ytre, halvbred: indre,
      ansikt: { topp: cy - indre * 0.9, bunn: cy + indre * 0.9, halvbred: indre * 0.8 },
      beinPlass: false
    };
  }

  function kroppTrekant(rnd, f) {
    var hb = mellomtall(rnd, 26, 33);
    var topp = mellomtall(rnd, 16, 24), bunn = mellomtall(rnd, 76, 84);
    var pekerNed = rnd() > 0.75;
    var pkt = pekerNed
      ? [[50 - hb, topp], [50 + hb, topp], [50, bunn]]
      : [[50, topp], [50 + hb, bunn], [50 - hb, bunn]];
    return {
      deler: [bane(hjorneBane(pkt, 0.2), f, 3.2)],
      topp: topp, bunn: bunn, halvbred: hb,
      ansikt: pekerNed
        ? { topp: topp + 4, bunn: topp + (bunn - topp) * 0.6, halvbred: hb * 0.7 }
        : { topp: topp + (bunn - topp) * 0.34, bunn: bunn - 3, halvbred: hb * 0.66 },
      beinPlass: true
    };
  }

  function kroppOrm(rnd, f) {
    /* Stablede ledd, minst nederst og størst øverst. Ansiktet sitter på det
       øverste leddet, så den leser som en larve som reiser seg. */
    var ledd = 3 + Math.floor(rnd() * 2);
    var bunn = mellomtall(rnd, 80, 88);
    var deler = [], i;
    var hodeR = mellomtall(rnd, 21, 26);

    /* Stabelen måles opp FØR den tegnes, og krympes hvis den ikke får plass.
       Fire store ledd ble til sammen høyere enn hele tegneflaten, og hodet —
       altså ansiktet — ble klippet bort på toppen. */
    var radier = [], total = 0;
    for (i = 0; i < ledd; i++) {
      radier.push(hodeR * (0.52 + 0.48 * (i / (ledd - 1))));
      total += radier[i] * 1.15;
    }
    var plass = bunn - 16;
    if (total > plass) {
      var skala = plass / total;
      for (i = 0; i < ledd; i++) radier[i] *= skala;
      hodeR *= skala;
    }

    var y = bunn, r;
    var senter = [];
    for (i = 0; i < ledd; i++) {
      r = radier[i];
      var x = 50 + (i % 2 ? 1 : -1) * mellomtall(rnd, 0, 5) * (1 - i / ledd);
      senter.push([x, y - r * 0.75, r]);
      y -= r * 1.15;
    }
    for (i = 0; i < ledd; i++) {
      var s = senter[i];
      deler.push('<ellipse cx="' + tall(s[0]) + '" cy="' + tall(s[1]) + '" rx="' + tall(s[2]) +
        '" ry="' + tall(s[2] * 0.92) + '" fill="' + f.fyll + '" stroke="' + f.strek + '" stroke-width="3"/>');
    }
    var hode = senter[ledd - 1];
    return {
      deler: deler, topp: hode[1] - hode[2], bunn: bunn, halvbred: hodeR,
      ansikt: { topp: hode[1] - hode[2], bunn: hode[1] + hode[2], halvbred: hode[2] * 0.88 },
      beinPlass: false, hodeX: hode[0]
    };
  }

  var FORMER = [kroppKlump, kroppBoks, kroppSpokelse, kroppStolpe,
    kroppKlase, kroppTagg, kroppTrekant, kroppOrm];

  /* Formene under brukes bare av beatene i sine egne verdener. De står
     utenfor FORMER med vilje: legges en form til der, endrer det hvilken
     kropp hvert eksisterende monster trekker, og barnas lyder ville skiftet
     utseende over natten. */

  function kroppKuppel(rnd, f) {
    // søppelbøtteroboten: rett kropp med en glasskuppel som hode
    var hb = mellomtall(rnd, 22, 28);
    var topp = mellomtall(rnd, 16, 22), bunn = mellomtall(rnd, 76, 84);
    var skulder = topp + hb, belte = bunn - 8;
    var d = 'M' + P(50 - hb, bunn) + 'L' + P(50 - hb, skulder) +
      'A' + tall(hb) + ' ' + tall(hb) + ' 0 0 1 ' + P(50 + hb, skulder) +
      'L' + P(50 + hb, bunn) + 'Z';
    var deler = [bane(d, f, 3.2)];
    deler.push(strek('M' + P(50 - hb + 2, belte) + 'L' + P(50 + hb - 2, belte), f.aksent, 3));
    return {
      deler: deler, topp: topp, bunn: bunn, halvbred: hb,
      ansikt: { topp: topp + 5, bunn: belte - 4, halvbred: hb * 0.8 },
      beinPlass: true, maskin: true
    };
  }

  function kroppManet(rnd, f) {
    var hb = mellomtall(rnd, 27, 34);
    var topp = mellomtall(rnd, 12, 18);
    var kant = topp + mellomtall(rnd, 36, 44);        // underkanten av hatten
    var deler = [], i;
    // tentaklene først, så dekker hatten der de er festet
    var antall = 4 + Math.floor(rnd() * 3);
    for (i = 0; i < antall; i++) {
      var x = 50 - hb * 0.72 + hb * 1.44 * (i / (antall - 1));
      var ned = Math.min(95, kant + mellomtall(rnd, 24, 36));
      var svai = mellomtall(rnd, 4, 8) * (i % 2 ? 1 : -1);
      var dd = 'M' + P(x, kant - 4) +
        'C' + P(x + svai, kant + (ned - kant) * 0.35) + ' ' +
        P(x - svai, kant + (ned - kant) * 0.7) + ' ' + P(x + svai * 0.5, ned);
      deler.push(strek(dd, i % 2 ? f.aksent : f.strek, i % 2 ? 2.2 : 3));
    }
    /* Kuppelen er en kubisk kurve med kontrollpunktene rett over hjørnene.
       Kontrollhøyden regnes ut så toppen av kurven havner nøyaktig på topp. */
    var kontroll = (topp - 0.25 * kant) / 0.75;
    var d = 'M' + P(50 - hb, kant) + 'C' + P(50 - hb, kontroll) + ' ' +
      P(50 + hb, kontroll) + ' ' + P(50 + hb, kant);
    var bolger = 5 + Math.floor(rnd() * 3), steg = hb * 2 / bolger;
    for (i = 0; i < bolger; i++) {
      var x0 = 50 + hb - i * steg, x1 = x0 - steg;
      d += 'Q' + P((x0 + x1) / 2, kant + 5) + ' ' + P(x1, kant);
    }
    deler.push(bane(d + 'Z', f));
    return {
      deler: deler, topp: topp, bunn: kant + 4, halvbred: hb,
      // kuppelen er smal øverst, så ansiktet starter et stykke ned
      ansikt: { topp: topp + (kant - topp) * 0.22, bunn: kant - 1, halvbred: hb * 0.72 },
      beinPlass: false, ingenLemmer: true
    };
  }

  function kroppBlekksprut(rnd, f) {
    var r = mellomtall(rnd, 23, 28), ry = r * mellomtall(rnd, 1.0, 1.15);
    var cy = mellomtall(rnd, 38, 44);
    var deler = [], antall = 5 + Math.floor(rnd() * 2);
    for (var i = 0; i < antall; i++) {
      var t = i / (antall - 1) - 0.5, side = t < 0 ? -1 : 1;
      var fx = 50 + t * r * 1.3, fy = cy + ry * 0.55;
      var tx = Math.max(9, Math.min(91, 50 + t * r * 2.9));
      var ty = Math.min(88, cy + ry + mellomtall(rnd, 12, 20));
      var krull = side * mellomtall(rnd, 4, 7);
      var dd = 'M' + P(fx, fy) + 'Q' + P(fx + (tx - fx) * 0.2, ty) + ' ' + P(tx, ty - 3) +
        'Q' + P(Math.max(5, Math.min(95, tx + krull)), ty - 8) + ' ' + P(tx + krull * 0.2, ty - 10);
      // en tykk strek med en tynnere oppå blir en arm med kant, uten fylte baner
      deler.push(strek(dd, f.strek, 8) + strek(dd, f.fyll, 4.2));
    }
    deler.push('<ellipse cx="50" cy="' + tall(cy) + '" rx="' + tall(r) + '" ry="' + tall(ry) +
      '" fill="' + f.fyll + '" stroke="' + f.strek + '" stroke-width="3"/>');
    return {
      deler: deler, topp: cy - ry, bunn: cy + ry, halvbred: r,
      ansikt: { topp: cy - ry, bunn: cy + ry, halvbred: r * 0.85 },
      beinPlass: false, ingenLemmer: true
    };
  }

  /* ---------- øyne ---------- */

  /* Øyet ligger i en egen gruppe med klassen «oye». Appen klemmer den flat
     når monsteret blunker, så alt som skal blunke må ligge inni — og alt som
     ikke skal det (stilker) må ligge utenfor. */
  function oye(x, y, r, stil, f, rnd, blikk) {
    var s = '';
    if (stil === 'glad') {
      // lukket bue: ^^ — gir et vennlig monster uten at vi trenger munnen til det
      s += '<g class="oye">' + strek('M' + P(x - r, y + r * 0.35) + 'Q' + P(x, y - r * 0.85) +
        ' ' + P(x + r, y + r * 0.35), f.strek, 3) + '</g>';
      return s;
    }
    if (stil === 'kryss') {
      s += '<g class="oye">';
      s += strek('M' + P(x - r * 0.7, y - r * 0.7) + 'L' + P(x + r * 0.7, y + r * 0.7), f.strek, 3);
      s += strek('M' + P(x + r * 0.7, y - r * 0.7) + 'L' + P(x - r * 0.7, y + r * 0.7), f.strek, 3);
      s += '</g>';
      return s;
    }
    if (stil === 'skjerm') {
      // firkantede robotøyne, med firkantet pupill
      var pk = r * 0.8, pav = (blikk || 0) * r * 0.35;
      return '<g class="oye"><rect x="' + tall(x - r) + '" y="' + tall(y - r) + '" width="' + tall(r * 2) +
        '" height="' + tall(r * 2) + '" rx="' + tall(r * 0.3) + '" fill="#fff" stroke="' + f.strek +
        '" stroke-width="1.6"/><rect x="' + tall(x + pav - pk / 2) + '" y="' + tall(y - pk / 2 + r * 0.1) +
        '" width="' + tall(pk) + '" height="' + tall(pk) + '" fill="#150b22"/>' +
        '<rect x="' + tall(x + pav - pk / 2 + 1) + '" y="' + tall(y - pk / 2 + r * 0.1 + 1) +
        '" width="' + tall(pk * 0.3) + '" height="' + tall(pk * 0.3) + '" fill="#fff"/></g>';
    }
    if (stil === 'glod') {
      /* Selvlysende øyne med kattepupill. Skummelt nok til å være et
         spøkelse, men med lysglimtet i behold, så det fortsatt er en venn. */
      return '<g class="oye"><circle cx="' + tall(x) + '" cy="' + tall(y) + '" r="' + tall(r * 1.35) +
        '" fill="' + f.aksent + '" opacity="0.28"/>' + sirkel(x, y, r, f.aksent) +
        '<ellipse cx="' + tall(x + (blikk || 0) * r * 0.3) + '" cy="' + tall(y) + '" rx="' + tall(r * 0.2) +
        '" ry="' + tall(r * 0.72) + '" fill="#150b22"/>' +
        sirkel(x - r * 0.4, y - r * 0.42, Math.max(1, r * 0.2), '#fff') + '</g>';
    }
    var pupillR = r * mellomtall(rnd, 0.34, 0.52);
    /* Felles blikkretning når den er oppgitt: da ser øynene samme vei, og
       monsteret virker som det ser på noe. Uten den peker hver pupill sin vei,
       og alle blir skjeløyde — morsomt på ett monster, rart på alle. */
    var av = (blikk == null ? (rnd() - 0.5) * 0.8 : blikk) * r * 0.4;
    s += '<g class="oye">';
    s += sirkel(x, y, r, '#fff');
    if (stil === 'ring') s += '<circle cx="' + tall(x + av) + '" cy="' + tall(y) + '" r="' +
      tall(pupillR * 1.7) + '" fill="none" stroke="' + f.aksent + '" stroke-width="2"/>';
    s += sirkel(x + av, y + r * 0.1, pupillR, '#150b22');
    // lysglimt: den ene detaljen som gjør forskjell på «levende» og «dukke»
    s += sirkel(x + av - pupillR * 0.45, y - pupillR * 0.5, Math.max(1.2, pupillR * 0.36), '#fff');
    if (stil === 'lokk') {
      var fall = r * mellomtall(rnd, 0.3, 0.6);
      s += '<path d="M' + P(x - r - 1, y - r - 1) + 'L' + P(x + r + 1, y - r - 1) +
        'L' + P(x + r + 1, y - r + fall) + 'Q' + P(x, y - r + fall * 0.4) + ' ' +
        P(x - r - 1, y - r + fall * 1.6) + 'Z" fill="' + f.fyll + '" stroke="' + f.strek +
        '" stroke-width="2" stroke-linejoin="round"/>';
    }
    s += '</g>';
    return s;
  }

  /* Ett visir tvers over ansiktet i stedet for øyne, med to lysprikker som
     ser samme vei. Det er det som gjør en boks til en robot. */
  function visir(x, y, hb, f, blikk) {
    var h = Math.max(8, Math.min(13, hb * 0.5)), b = hb * 0.92;
    var px = x + blikk * b * 0.4;
    var s = '<g class="oye"><rect x="' + tall(x - b) + '" y="' + tall(y - h / 2) + '" width="' +
      tall(b * 2) + '" height="' + tall(h) + '" rx="' + tall(h / 2) + '" fill="#0b0a1e" stroke="' +
      f.strek + '" stroke-width="2.4"/>';
    [-1, 1].forEach(function (side) {
      var ex = px + side * b * 0.34;
      s += '<circle cx="' + tall(ex) + '" cy="' + tall(y) + '" r="' + tall(h * 0.5) + '" fill="' +
        f.aksent + '" opacity="0.3"/>' + sirkel(ex, y, h * 0.28, f.aksent) +
        sirkel(ex - h * 0.08, y - h * 0.08, h * 0.1, '#fff');
    });
    return s + '</g>';
  }

  function bryn(x, y, r, helning, f) {
    return strek('M' + P(x - r * 0.95, y - helning) + 'L' + P(x + r * 0.95, y + helning), f.strek, 3.4);
  }

  /* ---------- munner ---------- */

  /* Alt her inne ligger i gruppen «munn», som strekkes loddrett i takt med
     lyden. Derfor må hver munn ha høyde å strekke — en tynn strek ville ikke
     synes at den beveget seg. */
  function munn(cx, y, hb, stil, f, rnd) {
    var s = '<g class="munn">';
    var ry = hb * mellomtall(rnd, 0.38, 0.6);
    if (stil === 'tenner') {
      s += '<ellipse cx="' + tall(cx) + '" cy="' + tall(y) + '" rx="' + tall(hb) + '" ry="' +
        tall(ry) + '" fill="#190c28" stroke="' + f.strek + '" stroke-width="2.6"/>';
      var antall = 3 + Math.floor(rnd() * 3), steg = hb * 2 / antall, d = '';
      d += 'M' + P(cx - hb, y - ry * 0.55);
      for (var i = 0; i < antall; i++) {
        var x0 = cx - hb + i * steg;
        d += 'L' + P(x0 + steg / 2, y + ry * 0.2) + 'L' + P(x0 + steg, y - ry * 0.55);
      }
      d += 'L' + P(cx + hb, y - ry * 1.1) + 'L' + P(cx - hb, y - ry * 1.1) + 'Z';
      s += '<path d="' + d + '" fill="#fff"/>';
    } else if (stil === 'hoggtenner') {
      s += '<path d="M' + P(cx - hb, y - ry * 0.4) + 'Q' + P(cx, y + ry * 1.5) + ' ' +
        P(cx + hb, y - ry * 0.4) + 'Q' + P(cx, y + ry * 0.2) + ' ' + P(cx - hb, y - ry * 0.4) +
        'Z" fill="#190c28" stroke="' + f.strek + '" stroke-width="2.6" stroke-linejoin="round"/>';
      [-0.45, 0.45].forEach(function (t) {
        s += '<path d="M' + P(cx + hb * t - 3, y + ry * 0.05) + 'L' + P(cx + hb * t, y + ry * 0.95) +
          'L' + P(cx + hb * t + 3, y + ry * 0.05) + 'Z" fill="#fff"/>';
      });
    } else if (stil === 'tunge') {
      s += '<ellipse cx="' + tall(cx) + '" cy="' + tall(y) + '" rx="' + tall(hb) + '" ry="' +
        tall(ry) + '" fill="#190c28" stroke="' + f.strek + '" stroke-width="2.6"/>';
      s += '<path d="M' + P(cx - hb * 0.45, y + ry * 0.1) + 'Q' + P(cx, y + ry * 1.5) + ' ' +
        P(cx + hb * 0.45, y + ry * 0.1) + 'Z" fill="#ff6ab0"/>';
    } else if (stil === 'sikksakk') {
      var n2 = 4 + Math.floor(rnd() * 3), br = hb * 2 / n2, d2 = 'M' + P(cx - hb, y);
      for (var k = 0; k < n2; k++) {
        d2 += 'L' + P(cx - hb + br * (k + 0.5), y + (k % 2 ? ry : -ry) * 0.8);
      }
      d2 += 'L' + P(cx + hb, y);
      s += strek(d2, f.strek, 3);
    } else if (stil === 'gitter') {
      // høyttalergitter: robotens munn
      var gh = ry * 1.4, n3 = 4 + Math.floor(rnd() * 3);
      s += '<rect x="' + tall(cx - hb) + '" y="' + tall(y - gh / 2) + '" width="' + tall(hb * 2) +
        '" height="' + tall(gh) + '" rx="3" fill="#190c28" stroke="' + f.strek + '" stroke-width="2.4"/>';
      for (var j = 1; j < n3; j++) {
        var gx = cx - hb + hb * 2 * j / n3;
        s += strek('M' + P(gx, y - gh / 2 + 2) + 'L' + P(gx, y + gh / 2 - 2), f.strek, 1.5);
      }
    } else if (stil === 'liten') {
      s += '<ellipse cx="' + tall(cx) + '" cy="' + tall(y) + '" rx="' + tall(hb * 0.38) +
        '" ry="' + tall(ry * 0.85) + '" fill="#190c28" stroke="' + f.strek + '" stroke-width="2.6"/>';
    } else if (stil === 'nebb') {
      s += '<path d="M' + P(cx - hb, y - ry * 0.5) + 'L' + P(cx + hb, y - ry * 0.5) +
        'L' + P(cx, y + ry * 0.3) + 'Z" fill="' + f.aksent + '" stroke="' + f.strek + '" stroke-width="2"/>';
      s += '<path d="M' + P(cx - hb * 0.8, y + ry * 0.1) + 'L' + P(cx + hb * 0.8, y + ry * 0.1) +
        'L' + P(cx, y + ry * 1.1) + 'Z" fill="' + f.aksent + '" stroke="' + f.strek + '" stroke-width="2"/>';
    } else {
      s += '<ellipse cx="' + tall(cx) + '" cy="' + tall(y) + '" rx="' + tall(hb) + '" ry="' +
        tall(ry) + '" fill="#190c28" stroke="' + f.strek + '" stroke-width="2.6"/>';
    }
    return s + '</g>';
  }

  /* ---------- pynt på hodet ---------- */

  /* Alt som stikker opp av hodet får et tak på hvor høyt det kan nå.
     Tegneflaten klipper alt over y = 0, og uten taket forsvant toppen av
     antenner, horn og kammer på hver sjuende figur. */
  var HIMMEL = 5;

  function hodepynt(rnd, k, f, stil) {
    var s = '', toppY = k.topp, hb = k.halvbred;
    var x = k.hodeX || 50;
    if (stil === 'antenner') {
      [-1, 1].forEach(function (side) {
        var fx = x + side * hb * 0.45, fy = toppY + 3;
        var tx = fx + side * mellomtall(rnd, 2, 8);
        var ty = Math.max(toppY - mellomtall(rnd, 11, 19), HIMMEL + 4);
        s += strek('M' + P(fx, fy) + 'Q' + P(fx + side * 2, ty + 6) + ' ' + P(tx, ty), f.strek, 2.6);
        s += sirkel(tx, ty, 3.4, f.aksent);
      });
    } else if (stil === 'horn') {
      [-1, 1].forEach(function (side) {
        var fx = x + side * hb * 0.5, fy = toppY + 5;
        var ty = Math.max(toppY - mellomtall(rnd, 9, 16), HIMMEL);
        s += '<path d="M' + P(fx - side * 5, fy) + 'Q' + P(fx + side * 3, (ty + toppY) / 2) + ' ' +
          P(fx + side * 7, ty) + 'L' + P(fx + side * 4, fy - 1) +
          'Z" fill="' + f.aksent + '" stroke="' + f.strek + '" stroke-width="2" stroke-linejoin="round"/>';
      });
    } else if (stil === 'orer') {
      [-1, 1].forEach(function (side) {
        s += '<ellipse cx="' + tall(x + side * hb * 0.92) + '" cy="' + tall(toppY + (k.bunn - k.topp) * 0.28) +
          '" rx="' + tall(mellomtall(rnd, 5, 8)) + '" ry="' + tall(mellomtall(rnd, 8, 13)) +
          '" fill="' + f.fyll + '" stroke="' + f.strek + '" stroke-width="2.6"/>';
      });
    } else if (stil === 'enhjorning') {
      s += '<path d="M' + P(x - 5, toppY + 4) +
        'L' + P(x, Math.max(toppY - mellomtall(rnd, 13, 20), HIMMEL)) +
        'L' + P(x + 5, toppY + 4) + 'Z" fill="' + f.aksent + '" stroke="' + f.strek +
        '" stroke-width="2" stroke-linejoin="round"/>';
    } else if (stil === 'hanekam') {
      var n = 3 + Math.floor(rnd() * 3), d = 'M' + P(x - hb * 0.5, toppY + 5);
      for (var i = 0; i < n; i++) {
        var bx = x - hb * 0.5 + (hb / n) * (i + 0.5);
        d += 'L' + P(bx, Math.max(toppY - mellomtall(rnd, 6, 13), HIMMEL)) +
          'L' + P(bx + hb / (n * 2), toppY + 4);
      }
      s += '<path d="' + d + 'Z" fill="' + f.aksent + '" stroke="' + f.strek +
        '" stroke-width="2" stroke-linejoin="round"/>';
    } else if (stil === 'radar') {
      var rty = Math.max(toppY - mellomtall(rnd, 12, 18), HIMMEL + 5);
      s += strek('M' + P(x, toppY + 3) + 'L' + P(x, rty), f.strek, 2.6);
      s += '<path d="M' + P(x - 9, rty - 4) + 'Q' + P(x, rty + 7) + ' ' + P(x + 9, rty - 4) +
        'Z" fill="' + f.aksent + '" stroke="' + f.strek + '" stroke-width="2" stroke-linejoin="round"/>';
      s += sirkel(x, rty - 1, 1.8, '#fff');
    } else if (stil === 'blader') {
      // en vifte av blader bak hodet — grønne uansett hvilken farge dyret har
      var nb = 3 + Math.floor(rnd() * 3);
      for (var b = 0; b < nb; b++) {
        var vinkel = (b / (nb - 1) - 0.5) * 1.9;
        var lengde = mellomtall(rnd, 16, 24);
        var bx = x + Math.sin(vinkel) * hb * 0.3, by = toppY + 6;
        var tx = bx + Math.sin(vinkel) * lengde;
        var ty = Math.max(by - Math.cos(vinkel) * lengde, HIMMEL);
        var nx = -(ty - by), ny = tx - bx, nl = Math.sqrt(nx * nx + ny * ny) || 1;
        var bred = lengde * 0.28, mx = (bx + tx) / 2, my = (by + ty) / 2;
        s += '<path d="M' + P(bx, by) + 'Q' + P(mx + nx / nl * bred, my + ny / nl * bred) + ' ' +
          P(tx, ty) + 'Q' + P(mx - nx / nl * bred, my - ny / nl * bred) + ' ' + P(bx, by) +
          'Z" fill="hsl(115 70% 24%)" stroke="hsl(110 95% 55%)" stroke-width="2" stroke-linejoin="round"/>';
        s += strek('M' + P(bx, by) + 'L' + P(bx + (tx - bx) * 0.8, by + (ty - by) * 0.8), 'hsl(110 95% 60%)', 1.2);
      }
    } else if (stil === 'bobler') {
      // bobler som stiger opp ved siden av hodet
      var side = rnd() > 0.5 ? 1 : -1;
      var bbx = Math.max(8, Math.min(92, x + side * (hb + 4)));
      var bby = toppY + 14;
      for (var j = 0; j < 3; j++) {
        var br = 2.2 + j * 1.3;
        bby -= br * 2 + 2;
        if (bby - br < HIMMEL) break;
        var bxx = Math.max(br + 2, Math.min(98 - br, bbx + side * j * 2));
        s += '<circle cx="' + tall(bxx) + '" cy="' + tall(bby) + '" r="' + tall(br) + '" fill="none" stroke="' +
          f.aksent + '" stroke-width="1.6"/>' + sirkel(bxx - br * 0.35, bby - br * 0.35, 0.8, '#fff');
      }
    } else if (stil === 'heksehatt') {
      var brem = Math.min(hb * 0.95, 24), hattBunn = toppY + 5;
      var spiss = Math.max(hattBunn - mellomtall(rnd, 22, 30), HIMMEL);
      var skjev = (rnd() - 0.5) * 14;
      s += '<path d="M' + P(x - brem * 0.55, hattBunn) +
        'Q' + P(x + skjev * 0.3 - 2, (hattBunn + spiss) / 2) + ' ' + P(x + skjev, spiss) +
        'Q' + P(x + skjev * 0.3 + 4, (hattBunn + spiss) / 2) + ' ' + P(x + brem * 0.55, hattBunn) +
        'Z" fill="#1a0b2e" stroke="' + f.strek + '" stroke-width="2.4" stroke-linejoin="round"/>';
      s += strek('M' + P(x - brem * 0.5, hattBunn - 3) + 'L' + P(x + brem * 0.5, hattBunn - 3), f.aksent, 3);
      s += '<ellipse cx="' + tall(x) + '" cy="' + tall(hattBunn) + '" rx="' + tall(brem) +
        '" ry="3" fill="#1a0b2e" stroke="' + f.strek + '" stroke-width="2.4"/>';
    } else if (stil === 'vinger') {
      // flaggermusvinger, tegnet bak kroppen så festet skjules
      var wy = toppY + (k.bunn - toppY) * 0.35;
      [-1, 1].forEach(function (side2) {
        var fx = x + side2 * hb * 0.6;
        var ytre = Math.max(3, Math.min(97, x + side2 * (hb + mellomtall(rnd, 14, 20))));
        var tuppY = Math.max(HIMMEL + 3, wy - mellomtall(rnd, 12, 18));
        var d2 = 'M' + P(fx, wy - 6) + 'Q' + P((fx + ytre) / 2, tuppY) + ' ' + P(ytre, tuppY);
        var fra = [ytre, tuppY + 3], til = [fx, wy + 10];
        for (var n = 1; n <= 3; n++) {
          var p1 = paaVei(fra, til, n / 3), pm = paaVei(fra, til, (n - 0.5) / 3);
          d2 += 'Q' + P(pm[0], pm[1] - 5) + ' ' + P(p1[0], p1[1]);
        }
        s += '<path d="' + d2 + 'Z" fill="#1a0b2e" stroke="' + f.strek +
          '" stroke-width="2.4" stroke-linejoin="round"/>';
      });
    }
    return s;
  }

  /* ---------- lemmer ---------- */

  /* Armene tegnes BAK kroppen. Da skjuler silhuetten festet automatisk, og
     bare den delen som stikker ut synes. Tegnet foran ble de til en strek
     tvers over ansiktet på alle former som er smalere nederst enn på midten. */
  function armer(rnd, k, f, hender) {
    var s = '', y = k.topp + (k.bunn - k.topp) * mellomtall(rnd, 0.5, 0.7);
    var opp = rnd() > 0.5;
    [-1, 1].forEach(function (side) {
      var fx = 50 + side * k.halvbred * 0.75;
      var lengde = mellomtall(rnd, 11, 19);
      // hånden holdes innenfor tegneflaten, ellers klippes den av på brede kropper
      var tx = Math.max(6, Math.min(94, fx + side * lengde));
      var ty = y + (opp ? -lengde * 0.7 : lengde * 0.45);
      s += strek('M' + P(fx, y) + 'Q' + P(fx + side * lengde * 0.7, y) + ' ' + P(tx, ty), f.strek, 3);
      if (hender === 'klo') {
        // robotklo: en åpen C som peker utover
        s += strek('M' + P(tx - side * 1, ty - 4.5) + 'Q' + P(tx + side * 5.5, ty) + ' ' +
          P(tx - side * 1, ty + 4.5), f.aksent, 3);
      } else {
        s += sirkel(tx, ty, 3.6, f.aksent);
      }
    });
    return s;
  }

  function hjul(rnd, k, f) {
    var s = '', r = mellomtall(rnd, 5.5, 7);
    var y = Math.min(97 - r, k.bunn + 3);
    [-1, 1].forEach(function (side) {
      var x = 50 + side * k.halvbred * 0.55;
      s += '<circle cx="' + tall(x) + '" cy="' + tall(y) + '" r="' + tall(r) + '" fill="#150b22" stroke="' +
        f.strek + '" stroke-width="2.6"/>' + sirkel(x, y, r * 0.35, f.aksent);
    });
    return s;
  }

  function bein(rnd, k, f) {
    var s = '';
    [-1, 1].forEach(function (side) {
      var x = 50 + side * k.halvbred * mellomtall(rnd, 0.35, 0.55);
      var ned = Math.min(95, k.bunn + mellomtall(rnd, 7, 13));
      s += strek('M' + P(x, k.bunn - 3) + 'L' + P(x, ned), f.strek, 3.4);
      s += '<ellipse cx="' + tall(x + side * 2.5) + '" cy="' + tall(ned) +
        '" rx="5.5" ry="3" fill="' + f.strek + '"/>';
    });
    return s;
  }

  /* Mange tynne bein under kroppen — gjør en rund klump til et krypdyr. */
  function mangeBein(rnd, k, f) {
    var s = '', antall = 3 + Math.floor(rnd() * 3);
    for (var i = 0; i < antall; i++) {
      for (var side = -1; side <= 1; side += 2) {
        var t = (i + 1) / (antall + 1);
        var fx = 50 + side * k.halvbred * (0.3 + t * 0.6);
        var fy = k.topp + (k.bunn - k.topp) * 0.72;
        s += strek('M' + P(fx, fy) + 'Q' + P(fx + side * 9, fy + 9) + ' ' +
          P(fx + side * 7, Math.min(94, k.bunn + 9)), f.strek, 2.4);
      }
    }
    return s;
  }

  function stilkoyne(rnd, k, f, antall) {
    var s = '', i;
    for (i = 0; i < antall; i++) {
      var side = antall === 1 ? 0 : (i - (antall - 1) / 2) * 2 / Math.max(1, antall - 1);
      var fx = 50 + side * k.halvbred * 0.45;
      var r = mellomtall(rnd, 6, 8.5);
      /* Stilken får bare den plassen som faktisk finnes over kroppen. Uten
         taket vokste øyet ut av tegneflaten og ble klippet bort på toppen. */
      var rom = k.topp - (r + HIMMEL);
      var hoyde = Math.max(0, Math.min(mellomtall(rnd, 13, 22), rom));
      var tx = fx + side * mellomtall(rnd, 1, 6), ty = k.topp - hoyde;
      s += strek('M' + P(fx, k.topp + 4) + 'Q' + P(fx, ty + hoyde * 0.4) + ' ' + P(tx, ty), f.strek, 2.8);
      s += oye(tx, ty, r, rnd() > 0.8 ? 'ring' : 'vanlig', f, rnd);
    }
    return s;
  }

  /* ---------- mønster på kroppen ---------- */

  /* Mønsteret holder seg innenfor ansiktsboksen, ikke kroppens ytterkant.
     Ansiktsboksen er den eneste delen vi vet ligger trygt inne i silhuetten —
     for en boblende klase eller en pigget form kan ytterkanten være tom luft,
     og da flyter flekkene rundt utenfor figuren. */
  function moenster(rnd, k, f, stil) {
    var s = '', i;
    var a = k.ansikt, hb = a.halvbred, senterY = (a.topp + a.bunn) / 2;
    if (stil === 'flekker') {
      for (i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
        s += '<circle cx="' + tall(50 + (rnd() - 0.5) * hb * 1.3) + '" cy="' +
          tall(a.bunn - rnd() * (a.bunn - senterY) * 1.1) + '" r="' + tall(mellomtall(rnd, 2, 4.2)) +
          '" fill="' + f.aksent + '" opacity="0.45"/>';
      }
    } else if (stil === 'striper') {
      for (i = 0; i < 2 + Math.floor(rnd() * 2); i++) {
        var y = senterY + (a.bunn - senterY) * (0.4 + i * 0.26);
        s += strek('M' + P(50 - hb * 0.8, y) + 'Q' + P(50, y + 5) + ' ' + P(50 + hb * 0.8, y),
          f.aksent, 2.6);
      }
    } else if (stil === 'mage') {
      s += '<ellipse cx="50" cy="' + tall(senterY + (a.bunn - senterY) * 0.45) + '" rx="' +
        tall(hb * 0.6) + '" ry="' + tall((a.bunn - senterY) * 0.48) + '" fill="' + f.aksent +
        '" opacity="0.22"/>';
    } else if (stil === 'paneler') {
      // skjøter på sidene og en rad nagler nederst: plater, ikke skinn
      [-1, 1].forEach(function (side) {
        s += strek('M' + P(50 + side * hb * 0.95, senterY) + 'L' + P(50 + side * hb * 0.95, a.bunn - 2),
          f.aksent, 1.6);
      });
      [-0.6, 0, 0.6].forEach(function (t) {
        s += sirkel(50 + t * hb, a.bunn - 3, 1.5, f.aksent);
      });
    } else if (stil === 'skjell') {
      for (var rad = 0; rad < 2; rad++) {
        var sy = senterY + (a.bunn - senterY) * (0.45 + rad * 0.3);
        var n = 4 - rad, bred = hb * 1.4 / n;
        for (var j = 0; j < n; j++) {
          var sx = 50 - hb * 0.7 + bred * (j + 0.5);
          s += '<path d="M' + P(sx - bred / 2, sy) + 'Q' + P(sx, sy + bred * 0.6) + ' ' + P(sx + bred / 2, sy) +
            '" fill="none" stroke="' + f.aksent + '" stroke-width="1.8" opacity="0.5"/>';
        }
      }
    } else if (stil === 'lapper') {
      /* Et sydd sår — som en kosebamse som har vært med på litt av hvert.
         Det går loddrett langs den ene kanten: midt på ansiktet havnet det
         oppå munnen og ble til rot. */
      var side = rnd() > 0.5 ? 1 : -1, lx = 50 + side * hb * 0.8;
      var y1 = a.topp + (a.bunn - a.topp) * 0.42, y2 = a.topp + (a.bunn - a.topp) * 0.8;
      var skraa = side * (rnd() - 0.2) * 3;
      s += strek('M' + P(lx - skraa, y1) + 'L' + P(lx + skraa, y2), f.strek, 1.8);
      for (i = 0; i < 4; i++) {
        var t2 = (i + 0.5) / 4, cx = lx - skraa + skraa * 2 * t2, cy = y1 + (y2 - y1) * t2;
        s += strek('M' + P(cx - 3, cy) + 'L' + P(cx + 3, cy), f.strek, 1.6);
      }
    }
    return s;
  }

  /* ---------- verdenene ---------- */

  /* Hver beat har sine egne monstre, og de skal se ut som de hører hjemme
     der: roboter i rombasen, maneter og blekkspruter i havet, spøkelser med
     heksehatt i det gamle huset. Temaet bestemmer hvilke kropper, øyne,
     munner og pynt generatoren får velge mellom — resten er den samme.

     Monstre uten tema (barnas egne lyder, og BOOM BAP) tegnes nøyaktig som
     før: hvert valg under trekker like mange terningkast som det gjorde, så
     ingen eksisterende figur forandrer seg. */
  var TEMA = {
    rom: {
      former: [kroppBoks, kroppKuppel, kroppStolpe, kroppKuppel, kroppBoks],
      pynt: ['antenner', 'radar', 'antenner', 'radar', 'ingen'],
      oyne: ['visir', 'visir', 'skjerm', 'skjerm', 'ring'],
      munn: ['gitter', 'gitter', 'liten', 'sikksakk'],
      moenster: ['paneler', 'paneler', 'ingen'],
      hender: 'klo', bein: 'hjul'
    },
    jungel: {
      former: [kroppKlump, kroppKlase, kroppTrekant, kroppOrm, kroppKlump],
      pynt: ['blader', 'blader', 'blader', 'orer', 'hanekam'],
      oyne: ['vanlig', 'vanlig', 'lokk', 'glad', 'ring'],
      munn: ['tunge', 'tenner', 'oval', 'nebb', 'hoggtenner'],
      moenster: ['flekker', 'striper', 'flekker', 'ingen']
    },
    hav: {
      former: [kroppManet, kroppBlekksprut, kroppManet, kroppBlekksprut, kroppKlump],
      pynt: ['bobler', 'bobler', 'ingen'],
      oyne: ['vanlig', 'ring', 'lokk', 'vanlig'],
      munn: ['oval', 'liten', 'tunge', 'liten'],
      moenster: ['skjell', 'flekker', 'ingen']
    },
    gross: {
      former: [kroppSpokelse, kroppSpokelse, kroppStolpe, kroppTagg, kroppKlump],
      pynt: ['heksehatt', 'vinger', 'vinger', 'horn', 'heksehatt'],
      oyne: ['glod', 'glod', 'glod', 'vanlig', 'kryss'],
      munn: ['hoggtenner', 'hoggtenner', 'sikksakk', 'tenner'],
      moenster: ['lapper', 'ingen', 'lapper']
    }
  };

  // pynt som tegnes bak kroppen; alt annet legges foran
  var BAK = { orer: true, horn: true, blader: true, vinger: true };

  /* ---------- pikselmonstrene ---------- */

  /* PIXEL-verdenens monstre er tegnet som i et gammelt tv-spill: et rutenett
     på 11 x 11 der venstre side speiles over til høyre. Speilingen er det som
     gjør tilfeldige ruter til en figur — hjernen leser alt symmetrisk som et
     vesen. Øyne og munn ligger i de samme gruppene som hos de andre
     monstrene, så de blunker og synger på samme måte. */
  function tegnPixel(rnd, hue, f) {
    var N = 11, C = 8, X0 = 6, Y0 = 6, M = 5, x, y;
    var g = [];
    for (y = 0; y < N; y++) {
      g.push([]);
      for (x = 0; x < N; x++) g[y].push(0);
    }
    // 1 = kropp, 2 = aksent, 3 = øye, 4 = munn. dx er avstanden fra midten.
    function sett(dx, yy, v) {
      if (yy < 0 || yy >= N || dx > M) return;
      g[yy][M - dx] = v;
      g[yy][M + dx] = v;
    }

    var topp = 2 + Math.floor(rnd() * 2), bunn = 7 + Math.floor(rnd() * 2);
    var form = Math.floor(rnd() * 3), bredde = [];
    for (y = topp; y <= bunn; y++) {
      var t = (y - topp) / (bunn - topp), w;
      if (form === 0) w = 2 + Math.round(Math.sin(t * Math.PI) * 2);     // rund
      else if (form === 1) w = y === topp ? 2 : 3;                        // boks
      else w = Math.max(2, 4 - Math.round(t * 2));                         // stor skalle
      bredde[y] = w;
      for (x = 0; x <= w; x++) sett(x, y, 1);
    }

    var tw = bredde[topp];
    var pynt = velg(rnd, ['antenner', 'orer', 'horn', 'krone', 'ingen']);
    if (pynt === 'antenner') { sett(2, topp - 1, 1); sett(3, topp - 2, 2); }
    else if (pynt === 'orer') { sett(tw, topp - 1, 1); sett(tw, topp - 2, 1); }
    else if (pynt === 'horn') { sett(tw, topp - 1, 2); sett(tw + 1, topp - 2, 2); }
    else if (pynt === 'krone') { sett(0, topp - 1, 2); sett(2, topp - 1, 2); }

    if (rnd() > 0.35) {
      var armRad = topp + 2 + Math.floor(rnd() * 2);
      var aw = bredde[armRad] + 1;
      sett(aw, armRad, 1);
      sett(Math.min(M, aw + (rnd() > 0.5 ? 1 : 0)), armRad - 1, 2);
    }

    var bein = velg(rnd, ['to', 'tre', 'tentakler', 'to']);
    if (bein === 'to') { sett(2, bunn + 1, 1); sett(2, bunn + 2, 1); sett(3, bunn + 2, 1); }
    else if (bein === 'tre') { sett(0, bunn + 1, 1); sett(3, bunn + 1, 1); sett(0, bunn + 2, 2); sett(3, bunn + 2, 2); }
    else { sett(1, bunn + 1, 1); sett(3, bunn + 1, 1); sett(2, bunn + 2, 1); sett(4, bunn + 2, 1); }

    var oyeRad = topp + 1;
    var oyne = velg(rnd, [[2], [2], [0], [0, 3]]);
    oyne.forEach(function (dx) { sett(dx, oyeRad, 3); });
    var blikk = velg(rnd, [-1, 0, 1, 0.5, -0.5]);

    var munnRad = oyeRad + 2;
    var mw = Math.min(bredde[munnRad] - 1, 1 + Math.floor(rnd() * 2));
    for (x = 0; x <= mw; x++) sett(x, munnRad, 4);
    var tenner = rnd() > 0.5;

    /* Lyset kommer ovenfra: den øverste ruten i hver søyle er lysere og den
       nederste mørkere. Den mørke kanten rundt alt er det som gjør at det
       leser som pikselkunst og ikke som en haug firkanter. */
    var lys = farge(hue, 60), topplys = farge(hue, 76), skygge = farge(hue, 40);
    var kant = farge(hue, 20, 70);
    var under = '', kropp = '', oye = '', munn = '';
    function rute(px, py, b, h, fyll) {
      return '<rect x="' + tall(px) + '" y="' + tall(py) + '" width="' + tall(b) + '" height="' +
        tall(h) + '" fill="' + fyll + '"/>';
    }
    for (y = 0; y < N; y++) {
      for (x = 0; x < N; x++) {
        var v = g[y][x];
        if (!v) continue;
        var px = X0 + x * C, py = Y0 + y * C;
        under += rute(px - 1.5, py - 1.5, C + 3, C + 3, kant);
        if (v === 1) {
          var over = y === 0 || !g[y - 1][x], nedre = y === N - 1 || !g[y + 1][x];
          kropp += rute(px, py, C, C, over ? topplys : (nedre ? skygge : lys));
        } else if (v === 2) {
          kropp += rute(px, py, C, C, f.aksent);
        } else if (v === 3) {
          oye += rute(px, py, C, C, '#fff') +
            rute(px + C * 0.25 + blikk * C * 0.2, py + C * 0.3, C * 0.5, C * 0.5, '#150b22');
        } else {
          munn += rute(px, py, C, C, '#190c28');
          if (tenner && (x - M) % 2 === 0) munn += rute(px + 1.5, py, C - 3, C * 0.35, '#fff');
        }
      }
    }
    return '<svg class="mstr" viewBox="0 0 100 100" shape-rendering="crispEdges" aria-hidden="true">' +
      under + kropp + '<g class="oye">' + oye + '</g><g class="munn">' + munn + '</g></svg>';
  }

  /* ---------- tegnestilene ----------

     PIXEL viste at en helt annen MÅTE å tegne på gjør mer enn nye former i
     samme strek. Hver stil under er sin egen lille tegner: klistremerker med
     hvit kant (drager og pirater), blankt metall (roboter), glinsende godteri
     i 3D, hulemalerier av dinosaurer, og origami av papir (vinterdyr).

     Felles for alle: tegneflaten er 0–100, øynene ligger i grupper med
     klassen «oye» (så de blunker) og munnen i én gruppe «munn» (så den
     synger). Fargeforløp trenger id-er som er unike på siden, derfor får
     hver tegning et eget prefiks laget av nøkkelen. */

  var MORK = '#1d1030';

  function ellD(cx, cy, rx, ry) {
    return 'M' + P(cx - rx, cy) + 'A' + tall(rx) + ' ' + tall(ry) + ' 0 1 0 ' + P(cx + rx, cy) +
      'A' + tall(rx) + ' ' + tall(ry) + ' 0 1 0 ' + P(cx - rx, cy) + 'Z';
  }

  function mangekant(pkt) {
    return 'M' + pkt.map(function (p) { return P(p[0], p[1]); }).join('L') + 'Z';
  }

  /* En kurve som smalner av — horn, haler, armer. Tegnes som en flate og
     ikke som en strek, så den kan få kant og klistremerkeomriss som resten. */
  function tykkKurve(p0, p1, p2, w0, w1) {
    var v = [], h = [];
    for (var i = 0; i <= 10; i++) {
      var t = i / 10, u = 1 - t;
      var x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
      var y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      var dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
      var dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      var l = Math.sqrt(dx * dx + dy * dy) || 1, w = w0 + (w1 - w0) * t;
      v.push([x - dy / l * w, y + dx / l * w]);
      h.push([x + dy / l * w, y - dx / l * w]);
    }
    return mangekant(v.concat(h.reverse()));
  }

  function svg(innhold, ekstra) {
    return '<svg class="mstr" viewBox="0 0 100 100" aria-hidden="true"' + (ekstra || '') + '>' +
      innhold + '</svg>';
  }

  /* ---------- klistremerker ---------- */

  /* Hele figuren tegnes først i hvitt med tykk strek, så i farger oppå.
     Da får den en hvit kant rundt hele silhuetten, som et klistremerke — og
     delene flyter sammen i ett omriss i stedet for å ha kant hver for seg. */
  function klistremerke(deler) {
    var s = '<g fill="#fff" stroke="#fff" stroke-width="8" stroke-linejoin="round">';
    deler.forEach(function (d) { s += '<path d="' + d.d + '"/>'; });
    s += '</g>';
    deler.forEach(function (d) {
      s += '<path d="' + d.d + '" fill="' + d.fyll + '" stroke="' + MORK +
        '" stroke-width="2.6" stroke-linejoin="round"/>' + (d.ekstra || '');
    });
    return s;
  }

  function tegneserieOye(x, y, r, iris, blikk, slisse) {
    var px = x + blikk * r * 0.22;
    return '<g class="oye"><circle cx="' + tall(x) + '" cy="' + tall(y) + '" r="' + tall(r) +
      '" fill="#fff" stroke="' + MORK + '" stroke-width="2.2"/>' +
      sirkel(px, y + r * 0.06, r * 0.62, iris) +
      (slisse
        ? '<ellipse cx="' + tall(px) + '" cy="' + tall(y + r * 0.06) + '" rx="' + tall(r * 0.15) +
          '" ry="' + tall(r * 0.5) + '" fill="' + MORK + '"/>'
        : sirkel(px, y + r * 0.06, r * 0.32, MORK)) +
      sirkel(px - r * 0.24, y - r * 0.22, r * 0.2, '#fff') + '</g>';
  }

  function tegnDrage(rnd, hue) {
    var hud = farge(hue, 55, 78), lys = farge(hue, 72, 80);
    var mage = farge((hue + 45) % 360, 80, 85);
    var vinge = farge((hue + 25) % 360, 42, 72), hornF = 'hsl(42 75% 86%)';
    var hodeR = mellomtall(rnd, 19, 22.5), hodeY = mellomtall(rnd, 38, 42);
    var kRx = mellomtall(rnd, 16, 20), kRy = mellomtall(rnd, 12, 14.5), kY = 83 - kRy;
    var side = rnd() > 0.5 ? 1 : -1;
    var deler = [], i;

    // vinger bakerst, med to «fingerbein» i hver
    if (rnd() > 0.2) {
      var spenn = mellomtall(rnd, 18, 24);
      [-1, 1].forEach(function (s) {
        var ax = 50 + s * kRx * 0.45, ay = kY - kRy * 0.4;
        var tx = Math.max(8, Math.min(92, 50 + s * (kRx + spenn)));
        var ty = Math.max(10, ay - mellomtall(rnd, 24, 32));
        var d = 'M' + P(ax, ay) + 'Q' + P(ax + s * 6, ty - 2) + ' ' + P(tx, ty);
        var fra = [tx, ty + 2], til = [ax + s * 3, ay + 9], ben = '';
        for (var n = 1; n <= 3; n++) {
          var p1 = paaVei(fra, til, n / 3), pm = paaVei(fra, til, (n - 0.5) / 3);
          d += 'Q' + P(pm[0], pm[1] - 6) + ' ' + P(p1[0], p1[1]);
          if (n < 3) ben += '<path d="M' + P(ax, ay) + 'L' + P(p1[0], p1[1]) + '" stroke="' + MORK +
            '" stroke-width="1.3" opacity="0.45"/>';
        }
        deler.push({ d: d + 'Z', fyll: vinge, ekstra: ben });
      });
    }

    // halen svinger ut til siden og ender i en pilspiss
    var ende = [50 + side * mellomtall(rnd, 33, 38), kY - mellomtall(rnd, 8, 16)];
    deler.push({ d: tykkKurve([50 + side * kRx * 0.6, kY + kRy * 0.4], [50 + side * 40, kY + kRy + 2], ende, 5.5, 1.6), fyll: hud });
    deler.push({
      d: 'M' + P(ende[0] - 5, ende[1] + 1) + 'L' + P(ende[0], ende[1] - 7) + 'L' + P(ende[0] + 5, ende[1] + 1) +
        'Q' + P(ende[0], ende[1] - 1) + ' ' + P(ende[0] - 5, ende[1] + 1) + 'Z',
      fyll: vinge
    });

    // kropp med lys mage og striper
    var magen = '<ellipse cx="50" cy="' + tall(kY + 2) + '" rx="' + tall(kRx * 0.6) + '" ry="' +
      tall(kRy * 0.72) + '" fill="' + mage + '"/>';
    for (i = -1; i <= 1; i++) {
      magen += '<path d="M' + P(50 - kRx * 0.45, kY + 2 + i * 4.5) + 'Q' + P(50, kY + 4 + i * 4.5) + ' ' +
        P(50 + kRx * 0.45, kY + 2 + i * 4.5) + '" fill="none" stroke="' + MORK + '" stroke-width="1.2" opacity="0.3"/>';
    }
    deler.push({ d: ellD(50, kY, kRx, kRy), fyll: hud, ekstra: magen });
    [-1, 1].forEach(function (s) {
      var fx = 50 + s * kRx * 0.55, fy = kY + kRy - 1;
      var klor = '';
      for (var k = -1; k <= 1; k++) klor += sirkel(fx + k * 2.6, fy + 3, 0.9, '#fff');
      deler.push({ d: ellD(fx, fy, 6.5, 4.2), fyll: hud, ekstra: klor });
    });

    // horn og pigger bak hodet, så hodet dekker festet
    var hornStil = velg(rnd, ['boyd', 'rett', 'sma', 'boyd']);
    [-1, 1].forEach(function (s) {
      var bx = 50 + s * hodeR * 0.5, by = hodeY - hodeR * 0.6;
      var lengde = hornStil === 'sma' ? 8 : mellomtall(rnd, 12, 17);
      var tx = 50 + s * (hodeR * 0.5 + (hornStil === 'rett' ? 3 : 9)), ty = Math.max(8, by - lengde);
      var kx = hornStil === 'boyd' ? bx + s * 10 : (bx + tx) / 2;
      deler.push({ d: tykkKurve([bx, by], [kx, (by + ty) / 2], [tx, ty], 4, 0.7), fyll: hornF });
    });
    if (rnd() > 0.35) {
      for (i = -1; i <= 1; i++) {
        var px = 50 + i * 6.5, py = hodeY - hodeR * 0.84 + Math.abs(i) * 1.5;
        deler.push({ d: mangekant([[px - 3.5, py + 3], [px, py - (i === 0 ? 9 : 6.5)], [px + 3.5, py + 3]]), fyll: vinge });
      }
    }

    var glans = '<ellipse cx="' + tall(50 - hodeR * 0.45) + '" cy="' + tall(hodeY - hodeR * 0.5) + '" rx="' +
      tall(hodeR * 0.26) + '" ry="' + tall(hodeR * 0.14) + '" fill="#fff" opacity="0.45"/>';
    if (rnd() > 0.5) {
      for (i = 0; i < 3; i++) {
        glans += sirkel(50 + hodeR * (0.2 + i * 0.22), hodeY - hodeR * (0.62 - i * 0.12), 1.6 + i * 0.4, farge(hue, 42, 70));
      }
    }
    deler.push({ d: ellD(50, hodeY, hodeR * 1.05, hodeR * 0.92), fyll: hud, ekstra: glans });
    var sY = hodeY + hodeR * 0.48;
    var nese = '<ellipse cx="46" cy="' + tall(sY - hodeR * 0.14) + '" rx="1.4" ry="2" fill="' + MORK + '"/>' +
      '<ellipse cx="54" cy="' + tall(sY - hodeR * 0.14) + '" rx="1.4" ry="2" fill="' + MORK + '"/>';
    deler.push({ d: ellD(50, sY, hodeR * 0.66, hodeR * 0.4), fyll: lys, ekstra: nese });

    var s2 = klistremerke(deler);
    // rødme i kinnene
    [-1, 1].forEach(function (s) {
      s2 += '<ellipse cx="' + tall(50 + s * hodeR * 0.74) + '" cy="' + tall(hodeY + hodeR * 0.2) +
        '" rx="3.4" ry="2" fill="#ff5c9a" opacity="0.5"/>';
    });

    var iris = velg(rnd, ['hsl(48 100% 55%)', 'hsl(95 90% 48%)', 'hsl(28 100% 55%)', 'hsl(190 95% 50%)']);
    var slisse = rnd() > 0.4, blikk = (rnd() - 0.5) * 1.6;
    var antall = velg(rnd, [2, 2, 2, 2, 1, 3]), oyeY = hodeY - hodeR * 0.18;
    var steder = antall === 1 ? [[50, oyeY, hodeR * 0.4]]
      : (antall === 2 ? [[50 - hodeR * 0.45, oyeY, hodeR * 0.3], [50 + hodeR * 0.45, oyeY, hodeR * 0.3]]
        : [[50 - hodeR * 0.55, oyeY, hodeR * 0.24], [50, oyeY - hodeR * 0.18, hodeR * 0.24], [50 + hodeR * 0.55, oyeY, hodeR * 0.24]]);
    var sint = rnd() > 0.6;
    steder.forEach(function (p) {
      s2 += tegneserieOye(p[0], p[1], p[2], iris, blikk, slisse);
    });
    if (sint && antall === 2) {
      // bestemte bryn, ikke sinte: dragen er klar for eventyr
      [-1, 1].forEach(function (s) {
        var bx = 50 + s * hodeR * 0.45, by = oyeY - hodeR * 0.42;
        s2 += '<path d="M' + P(bx - s * 4.5, by - 2) + 'L' + P(bx + s * 4.5, by + 1.5) + '" stroke="' + MORK +
          '" stroke-width="2.8" stroke-linecap="round"/>';
      });
    }

    var my = sY + hodeR * 0.16, mw = hodeR * 0.34, stil = velg(rnd, ['glis', 'brol', 'tann']);
    var m = '<g class="munn">';
    if (stil === 'brol') {
      m += '<ellipse cx="50" cy="' + tall(my + 1) + '" rx="' + tall(mw * 0.6) + '" ry="3.8" fill="#5a0f2a" stroke="' + MORK + '" stroke-width="1.8"/>' +
        '<ellipse cx="50" cy="' + tall(my + 2.8) + '" rx="' + tall(mw * 0.35) + '" ry="1.5" fill="#ff7aa8"/>';
      [-1, 1].forEach(function (s) {
        var fx = 50 + s * mw * 0.3;
        m += '<path d="M' + P(fx - 1.5, my - 2.2) + 'L' + P(fx, my + 0.6) + 'L' + P(fx + 1.5, my - 2.2) + 'Z" fill="#fff"/>';
      });
    } else {
      var bredde = stil === 'tann' ? mw * 0.7 : mw;
      m += '<path d="M' + P(50 - bredde, my - 1) + 'Q' + P(50, my + 6.5) + ' ' + P(50 + bredde, my - 1) +
        'Z" fill="#5a0f2a" stroke="' + MORK + '" stroke-width="1.8" stroke-linejoin="round"/>';
      (stil === 'tann' ? [0.45] : [-0.5, 0.5]).forEach(function (t) {
        var fx = 50 + t * bredde;
        m += '<path d="M' + P(fx - 1.6, my - 0.6) + 'L' + P(fx, my + 2.6) + 'L' + P(fx + 1.6, my - 0.6) + 'Z" fill="#fff"/>';
      });
    }
    return svg(s2 + m + '</g>');
  }

  function tegnPirat(rnd, hue, f, uid) {
    var hud = farge(hue, 60, 72), lys = farge(hue, 74, 80);
    var form = velg(rnd, ['rund', 'paere', 'boks']);
    var topp = mellomtall(rnd, 27, 32), bunn = mellomtall(rnd, 80, 84), hb = mellomtall(rnd, 23, 28);
    var midY = (topp + bunn) / 2, kropp;
    if (form === 'rund') kropp = ellD(50, midY, hb, (bunn - topp) / 2);
    else if (form === 'paere') {
      kropp = glattBane([[50, topp - 3], [50 + hb * 0.78, topp + 3], [50 + hb * 0.85, topp + 22],
        [50 + hb * 1.08, bunn - 6], [50 + hb * 0.7, bunn + 2], [50 - hb * 0.7, bunn + 2],
        [50 - hb * 1.08, bunn - 6], [50 - hb * 0.85, topp + 22], [50 - hb * 0.78, topp + 3]]);
    } else kropp = hjorneBane([[50 - hb, topp], [50 + hb, topp], [50 + hb, bunn], [50 - hb, bunn]], 0.28);

    var deler = [];
    var krok = rnd() > 0.5 ? 1 : -1, treben = rnd() > 0.55 ? -krok : 0;

    // bein: bukse, støvel — eller treben
    [-1, 1].forEach(function (s) {
      var x = 50 + s * hb * 0.42;
      if (s === treben) {
        deler.push({ d: hjorneBane([[x - 2.4, bunn - 4], [x + 2.4, bunn - 4], [x + 1.8, 93], [x - 1.8, 93]], 0.25), fyll: 'hsl(30 45% 48%)' });
      } else {
        deler.push({ d: hjorneBane([[x - 4, bunn - 4], [x + 4, bunn - 4], [x + 4, 89], [x - 4, 89]], 0.2), fyll: 'hsl(222 40% 34%)' });
        deler.push({ d: ellD(x + s * 1.8, 90.5, 6.5, 3.4), fyll: '#2b1a12' });
      }
    });

    // armer: én hånd og én krok
    [-1, 1].forEach(function (s) {
      var ax = 50 + s * hb * 0.8, ay = midY + 2;
      var ex = 50 + s * Math.min(40, hb + 11), ey = midY + 10;
      var ekstra = s === krok
        ? '<path d="M' + P(ex, ey + 2) + 'L' + P(ex, ey + 5) + 'Q' + P(ex + s * 6.5, ey + 11) + ' ' + P(ex + s * 5, ey + 3) +
          '" fill="none" stroke="#dfe6ee" stroke-width="2.6" stroke-linecap="round"/>'
        : '';
      deler.push({ d: tykkKurve([ax, ay], [ax + s * 8, ay + 1], [ex, ey], 3.6, 3), fyll: 'hsl(0 0% 96%)', ekstra: ekstra });
      if (s !== krok) deler.push({ d: ellD(ex + s * 1, ey + 2, 4.2, 4), fyll: hud });
    });

    // kroppen, med stripet genser nederst (klippet til silhuetten)
    var striper = '<g clip-path="url(#' + uid + 'k)">';
    for (var y = bunn - 20, n = 0; y < bunn + 4; y += 5, n++) {
      striper += '<rect x="0" y="' + tall(y) + '" width="100" height="5" fill="' + (n % 2 ? '#f4f4f4' : 'hsl(355 80% 52%)') + '"/>';
    }
    striper += '</g>';
    deler.push({ d: kropp, fyll: hud, ekstra: striper });

    // hatten
    var hatt = velg(rnd, ['trespiss', 'bandana', 'bandana', 'trespiss', 'kaptein']);
    if (hatt === 'bandana') {
      var farg = rnd() > 0.5 ? 'hsl(355 80% 52%)' : farge((hue + 180) % 360, 50, 80);
      var prikker = '';
      for (var k = 0; k < 5; k++) prikker += sirkel(50 - hb * 0.6 + k * hb * 0.3, topp + 1 + (k % 2) * 3, 1.3, '#fff');
      deler.push({
        d: 'M' + P(50 - hb * 0.98, topp + 9) + 'Q' + P(50, topp - 13) + ' ' + P(50 + hb * 0.98, topp + 9) +
          'Q' + P(50, topp + 4) + ' ' + P(50 - hb * 0.98, topp + 9) + 'Z',
        fyll: farg, ekstra: prikker
      });
      var kx = 50 - krok * hb * 0.95;
      deler.push({ d: mangekant([[kx, topp + 7], [kx - krok * 9, topp + 4], [kx - krok * 7, topp + 13]]), fyll: farg });
    } else {
      var hy = Math.max(topp + 5, 28), w = Math.min(hb * 1.25, 34);
      var skalle = sirkel(50, hy - 9, 3.6, '#fff') + sirkel(48.6, hy - 9.4, 0.9, MORK) + sirkel(51.4, hy - 9.4, 0.9, MORK) +
        '<path d="M' + P(46, hy - 5.5) + 'L' + P(54, hy - 2.5) + 'M' + P(54, hy - 5.5) + 'L' + P(46, hy - 2.5) +
        '" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M' + P(50 - w * 0.9, hy - 1) + 'Q' + P(50, hy + 4) + ' ' + P(50 + w * 0.9, hy - 1) +
        '" fill="none" stroke="hsl(45 90% 60%)" stroke-width="1.8"/>';
      if (hatt === 'kaptein') {
        skalle += '<path d="M' + P(50 + w * 0.4, hy - 12) + 'Q' + P(50 + w * 0.8, hy - 24) + ' ' + P(50 + w * 0.95, hy - 20) +
          'Q' + P(50 + w * 0.7, hy - 14) + ' ' + P(50 + w * 0.45, hy - 10) + 'Z" fill="' + f.aksent + '" stroke="' + MORK + '" stroke-width="1.4"/>';
      }
      deler.push({
        d: 'M' + P(50 - w, hy) + 'Q' + P(50 - w * 0.62, hy - 16) + ' ' + P(50 - w * 0.3, hy - 10) +
          'Q' + P(50, hy - 22) + ' ' + P(50 + w * 0.3, hy - 10) + 'Q' + P(50 + w * 0.62, hy - 16) + ' ' + P(50 + w, hy) +
          'Q' + P(50, hy + 6) + ' ' + P(50 - w, hy) + 'Z',
        fyll: '#2a2036', ekstra: skalle
      });
    }

    var s = '<defs><clipPath id="' + uid + 'k"><path d="' + kropp + '"/></clipPath></defs>' + klistremerke(deler);

    // ansiktet
    var oyeY = topp + (bunn - topp) * 0.33, dx = hb * 0.36, r = Math.min(6.5, hb * 0.26);
    var klaff = rnd() > 0.45 ? (rnd() > 0.5 ? 1 : -1) : 0, blikk = (rnd() - 0.5) * 1.4;
    var iris = velg(rnd, ['hsl(200 80% 45%)', 'hsl(28 70% 38%)', 'hsl(120 55% 38%)']);
    if (klaff) {
      s += '<path d="M' + P(50 - hb * 0.95, oyeY - 9 + klaff * 2) + 'L' + P(50 + hb * 0.95, oyeY - 9 - klaff * 2) +
        '" stroke="' + MORK + '" stroke-width="1.8"/>';
    }
    [-1, 1].forEach(function (side) {
      var x = 50 + side * dx;
      if (side === klaff) {
        s += '<ellipse cx="' + tall(x) + '" cy="' + tall(oyeY) + '" rx="' + tall(r * 1.05) + '" ry="' + tall(r * 0.9) +
          '" fill="' + MORK + '"/>';
      } else {
        s += tegneserieOye(x, oyeY, r, iris, blikk, false);
      }
    });
    s += '<ellipse cx="50" cy="' + tall(oyeY + 8) + '" rx="4.2" ry="3.4" fill="' + lys + '" stroke="' + MORK + '" stroke-width="1.8"/>';
    var mY = oyeY + 15;
    if (rnd() > 0.55) {
      s += '<path d="M' + P(35, mY - 3) + 'Q' + P(50, mY + 17) + ' ' + P(65, mY - 3) + 'Q' + P(50, mY + 5) + ' ' + P(35, mY - 3) +
        'Z" fill="hsl(25 45% 30%)" stroke="' + MORK + '" stroke-width="1.6"/>';
    }
    if (rnd() > 0.4) {
      var ox = 50 + (klaff ? klaff : 1) * hb * 0.97;
      s += '<circle cx="' + tall(ox) + '" cy="' + tall(oyeY + 9) + '" r="2.8" fill="none" stroke="hsl(45 95% 55%)" stroke-width="1.8"/>';
    }
    var m = '<g class="munn">';
    if (rnd() > 0.5) {
      m += '<path d="M' + P(42, mY - 1) + 'Q' + P(50, mY + 7) + ' ' + P(58, mY - 1) + 'Z" fill="#5a0f2a" stroke="' + MORK +
        '" stroke-width="1.8" stroke-linejoin="round"/>' +
        '<rect x="' + tall(44.5) + '" y="' + tall(mY - 0.8) + '" width="4" height="2.6" fill="#fff"/>' +
        '<rect x="' + tall(49.5) + '" y="' + tall(mY - 0.8) + '" width="4" height="2.6" fill="hsl(45 95% 55%)"/>';
    } else {
      m += '<ellipse cx="50" cy="' + tall(mY + 1) + '" rx="4.5" ry="3.6" fill="#5a0f2a" stroke="' + MORK + '" stroke-width="1.8"/>' +
        '<ellipse cx="50" cy="' + tall(mY + 2.8) + '" rx="2.6" ry="1.3" fill="#ff7aa8"/>';
    }
    s += m + '</g>';

    // papegøye på skulderen
    if (rnd() > 0.7) {
      var px = 50 - krok * (hb - 1), py = topp + 12;
      s += '<g stroke="' + MORK + '" stroke-width="1.4">' +
        '<path d="M' + P(px - 1, py + 6) + 'L' + P(px - krok * 3, py + 15) + 'L' + P(px + krok * 1, py + 7) + 'Z" fill="hsl(355 80% 52%)"/>' +
        '<ellipse cx="' + tall(px) + '" cy="' + tall(py + 3) + '" rx="4" ry="5.5" fill="hsl(120 70% 45%)"/>' +
        '<circle cx="' + tall(px + krok * 0.5) + '" cy="' + tall(py - 3.5) + '" r="3.6" fill="hsl(120 70% 45%)"/>' +
        '<path d="M' + P(px - krok * 3, py - 4.5) + 'L' + P(px - krok * 7, py - 2.5) + 'L' + P(px - krok * 3, py - 1.5) + 'Z" fill="hsl(45 95% 55%)"/>' +
        '</g>' + sirkel(px - krok * 1, py - 4.3, 0.9, MORK);
    }
    return svg(s);
  }

  /* ---------- metall ---------- */

  function tegnMetall(rnd, hue, f, uid) {
    var lys = farge(hue, 60, 100), strek = '#1b2130', mork = '#0e1320';
    var A = 'url(#' + uid + 'a)', B = 'url(#' + uid + 'b)';
    var defs = '<defs>' +
      '<linearGradient id="' + uid + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + farge(hue, 92, 18) +
      '"/><stop offset="0.5" stop-color="' + farge(hue, 66, 14) + '"/><stop offset="1" stop-color="' + farge(hue, 38, 22) + '"/></linearGradient>' +
      '<linearGradient id="' + uid + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + farge(hue, 80, 14) +
      '"/><stop offset="0.5" stop-color="' + farge(hue, 54, 14) + '"/><stop offset="1" stop-color="' + farge(hue, 30, 22) + '"/></linearGradient>' +
      '</defs>';
    function rekt(x, y, b, h, rx, fyll, bredde) {
      return '<rect x="' + tall(x) + '" y="' + tall(y) + '" width="' + tall(b) + '" height="' + tall(h) + '" rx="' + tall(rx) +
        '" fill="' + fyll + '" stroke="' + strek + '" stroke-width="' + (bredde || 2.4) + '"/>';
    }
    function lampe(x, y, r) {
      return '<circle cx="' + tall(x) + '" cy="' + tall(y) + '" r="' + tall(r * 1.3) + '" fill="' + lys + '" opacity="0.25"/>' +
        '<circle cx="' + tall(x) + '" cy="' + tall(y) + '" r="' + tall(r) + '" fill="' + mork + '" stroke="' + strek + '" stroke-width="1.6"/>' +
        sirkel(x, y, r * 0.66, lys) + sirkel(x - r * 0.25, y - r * 0.25, r * 0.22, '#fff');
    }

    var hw = mellomtall(rnd, 19, 26), hh = mellomtall(rnd, 19, 25);
    var bw = mellomtall(rnd, 16, 24), bh = mellomtall(rnd, 19, 25), hals = 4;
    var ben = velg(rnd, ['belter', 'hjul', 'fjaer', 'bein']);
    var y0 = Math.max(18, 93 - (hh + hals + bh + 12));
    var y1 = y0 + hh + hals, yb = y1 + bh;
    var s = defs;

    // antenne
    var ant = velg(rnd, ['kule', 'lyn', 'dobbel', 'kule', 'ingen']);
    if (ant === 'kule') {
      var at = Math.max(9, y0 - mellomtall(rnd, 9, 13));
      s += '<path d="M' + P(50, y0) + 'L' + P(50, at) + '" stroke="' + strek + '" stroke-width="2.4"/>' + lampe(50, at, 3.4);
    } else if (ant === 'lyn') {
      var lt = Math.max(7, y0 - 13);
      s += '<path d="M' + P(50, y0) + 'L' + P(53, y0 - 5) + 'L' + P(47, y0 - 8) + 'L' + P(51, lt) +
        '" fill="none" stroke="' + lys + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>';
    } else if (ant === 'dobbel') {
      [-1, 1].forEach(function (sd) {
        var tx = 50 + sd * hw * 0.55, ty = Math.max(9, y0 - 9);
        s += '<path d="M' + P(50 + sd * hw * 0.35, y0) + 'L' + P(tx, ty) + '" stroke="' + strek + '" stroke-width="2.2"/>' + lampe(tx, ty, 2.6);
      });
    }

    // ører, armer og bein ligger bak kroppen
    [-1, 1].forEach(function (sd) {
      s += rekt(50 + sd * (hw + 1) - 3.5, y0 + hh * 0.3, 7, hh * 0.4, 2, B, 2);
    });
    var klo = rnd() > 0.5, armOpp = rnd() > 0.5;
    [-1, 1].forEach(function (sd) {
      var ax = 50 + sd * bw, ay = y1 + 6;
      var ex = Math.max(8, Math.min(92, 50 + sd * (bw + 11))), ey = ay + (armOpp ? -8 : 12);
      var d = 'M' + P(ax, ay) + 'L' + P(50 + sd * (bw + 7), ay + 3) + 'L' + P(ex, ey);
      s += '<path d="' + d + '" fill="none" stroke="' + strek + '" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<path d="' + d + '" fill="none" stroke="' + farge(hue, 70, 14) + '" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<circle cx="' + tall(50 + sd * (bw + 7)) + '" cy="' + tall(ay + 3) + '" r="2.6" fill="' + A + '" stroke="' + strek + '" stroke-width="1.4"/>';
      if (klo) {
        s += '<path d="M' + P(ex - sd * 1, ey - 4.5) + 'Q' + P(ex + sd * 6, ey) + ' ' + P(ex - sd * 1, ey + 4.5) +
          '" fill="none" stroke="' + strek + '" stroke-width="2.8" stroke-linecap="round"/>';
      } else {
        s += '<circle cx="' + tall(ex) + '" cy="' + tall(ey) + '" r="3.6" fill="' + A + '" stroke="' + strek + '" stroke-width="1.8"/>';
      }
    });
    if (ben === 'belter') {
      s += rekt(50 - bw - 2, yb - 1, bw * 2 + 4, 11, 5.5, '#2a3040');
      for (var h = 0; h < 4; h++) {
        s += '<circle cx="' + tall(50 - bw + 3 + h * (bw * 2 - 6) / 3) + '" cy="' + tall(yb + 4.5) + '" r="3" fill="' + A + '" stroke="' + strek + '" stroke-width="1.2"/>';
      }
    } else if (ben === 'hjul') {
      [-1, 1].forEach(function (sd) {
        var x = 50 + sd * bw * 0.55;
        s += '<circle cx="' + tall(x) + '" cy="' + tall(yb + 5.5) + '" r="6" fill="#2a3040" stroke="' + strek + '" stroke-width="2.2"/>' +
          '<circle cx="' + tall(x) + '" cy="' + tall(yb + 5.5) + '" r="2.4" fill="' + A + '"/>';
      });
    } else if (ben === 'fjaer') {
      var z = 'M' + P(50, yb);
      for (var q = 1; q <= 5; q++) z += 'L' + P(50 + (q % 2 ? 5 : -5), yb + q * 1.7);
      s += '<path d="' + z + 'L' + P(50, yb + 9) + '" fill="none" stroke="' + strek + '" stroke-width="2.4" stroke-linejoin="round"/>' +
        rekt(38, yb + 8.5, 24, 3.5, 1.5, A, 1.8);
    } else {
      [-1, 1].forEach(function (sd) {
        var x = 50 + sd * bw * 0.45;
        s += rekt(x - 3, yb - 1, 6, 8, 1, B, 1.8) + rekt(x - 6 + sd * 1.5, yb + 7, 12, 4, 2, A, 1.8);
      });
    }

    // hals, kropp, hode
    s += rekt(46, y0 + hh - 1, 8, hals + 2, 1, B, 1.8);
    s += rekt(50 - bw, y1, bw * 2, bh, 4, B);
    var bryst = velg(rnd, ['skjerm', 'hjerte', 'knapper', 'maaler']), cy = y1 + bh * 0.48;
    if (bryst === 'skjerm') {
      s += rekt(50 - bw * 0.55, cy - 6, bw * 1.1, 12, 2, mork, 1.6);
      [0.6, 1, 0.4, 0.8].forEach(function (v, i) {
        s += '<rect x="' + tall(50 - bw * 0.45 + i * bw * 0.24) + '" y="' + tall(cy + 4.5 - v * 8) + '" width="' + tall(bw * 0.16) +
          '" height="' + tall(v * 8) + '" fill="' + lys + '"/>';
      });
    } else if (bryst === 'hjerte') {
      s += rekt(50 - 7, cy - 6.5, 14, 13, 3, mork, 1.6) +
        '<path d="M' + P(50, cy + 3.5) + 'C' + P(43, cy - 1) + ' ' + P(46, cy - 6) + ' ' + P(50, cy - 2.5) + 'C' + P(54, cy - 6) + ' ' +
        P(57, cy - 1) + ' ' + P(50, cy + 3.5) + 'Z" fill="hsl(350 95% 62%)"/>';
    } else if (bryst === 'knapper') {
      [0, 50, 120].forEach(function (h2, i) {
        s += '<circle cx="' + tall(50 + (i - 1) * 7) + '" cy="' + tall(cy) + '" r="2.8" fill="hsl(' + h2 + ' 90% 55%)" stroke="' + strek + '" stroke-width="1.4"/>';
      });
    } else {
      s += '<circle cx="50" cy="' + tall(cy) + '" r="7" fill="#f2f5f8" stroke="' + strek + '" stroke-width="1.8"/>' +
        '<path d="M' + P(50, cy) + 'L' + P(50 + 4.5, cy - 3.5) + '" stroke="hsl(355 85% 50%)" stroke-width="1.6" stroke-linecap="round"/>' +
        sirkel(50, cy, 1.2, strek);
    }

    var rund = velg(rnd, [3, 3, 8, 11]);
    s += rekt(50 - hw, y0, hw * 2, hh, rund, A);
    s += '<rect x="' + tall(50 - hw + 3) + '" y="' + tall(y0 + 2.5) + '" width="' + tall(hw * 0.8) + '" height="2.2" rx="1.1" fill="#fff" opacity="0.45"/>';
    if (rund < 8) {
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (k) {
        s += sirkel(50 + k[0] * (hw - 3.2), k[1] > 0 ? y0 + 3.2 : y0 + hh - 3.2, 1.2, farge(hue, 40, 10));
      });
    }

    var oy = y0 + hh * 0.4, oyne = velg(rnd, ['lamper', 'lamper', 'kamera', 'visir', 'ulike']);
    s += '<g class="oye">';
    if (oyne === 'kamera') {
      var kr = Math.min(hw * 0.42, hh * 0.3);
      s += '<circle cx="50" cy="' + tall(oy) + '" r="' + tall(kr) + '" fill="' + mork + '" stroke="' + strek + '" stroke-width="1.8"/>' +
        sirkel(50, oy, kr * 0.75, farge(hue, 25, 30)) + sirkel(50, oy, kr * 0.45, lys) + sirkel(50 - kr * 0.25, oy - kr * 0.25, kr * 0.16, '#fff');
    } else if (oyne === 'visir') {
      s += '<rect x="' + tall(50 - hw * 0.78) + '" y="' + tall(oy - 4.5) + '" width="' + tall(hw * 1.56) + '" height="9" rx="4.5" fill="' + mork +
        '" stroke="' + strek + '" stroke-width="1.8"/><rect x="' + tall(50 - hw * 0.6) + '" y="' + tall(oy - 1.2) + '" width="' + tall(hw * 1.2) +
        '" height="2.4" rx="1.2" fill="' + lys + '"/>';
    } else {
      var lr = Math.min(hw * 0.26, 6.5);
      s += lampe(50 - hw * 0.45, oy, oyne === 'ulike' ? lr * 1.25 : lr) + lampe(50 + hw * 0.45, oy, oyne === 'ulike' ? lr * 0.7 : lr);
    }
    s += '</g>';

    var my = y0 + hh * 0.78, mw = hw * 0.5, munnStil = velg(rnd, ['led', 'gitter', 'sikksakk']);
    s += '<g class="munn"><rect x="' + tall(50 - mw) + '" y="' + tall(my - 2.6) + '" width="' + tall(mw * 2) + '" height="5.2" rx="1.6" fill="' + mork +
      '" stroke="' + strek + '" stroke-width="1.4"/>';
    if (munnStil === 'led') {
      for (var l = 0; l < 5; l++) s += '<rect x="' + tall(50 - mw + 1.5 + l * (mw * 2 - 3) / 5) + '" y="' + tall(my - 1.2) + '" width="' + tall((mw * 2 - 3) / 5 - 1) + '" height="2.4" fill="' + lys + '"/>';
    } else if (munnStil === 'gitter') {
      for (var g2 = 1; g2 < 6; g2++) s += '<path d="M' + P(50 - mw + g2 * mw / 3, my - 2) + 'L' + P(50 - mw + g2 * mw / 3, my + 2) + '" stroke="' + farge(hue, 55, 15) + '" stroke-width="1.2"/>';
    } else {
      var zz = 'M' + P(50 - mw + 1.5, my);
      for (var z2 = 1; z2 <= 6; z2++) zz += 'L' + P(50 - mw + 1.5 + z2 * (mw * 2 - 3) / 6, my + (z2 % 2 ? -1.4 : 1.4));
      s += '<path d="' + zz + '" fill="none" stroke="' + lys + '" stroke-width="1.4"/>';
    }
    s += '</g>';
    return svg(s);
  }

  /* ---------- godteri i 3D ---------- */

  function tegnGodteri(rnd, hue, f, uid) {
    var G = 'url(#' + uid + 'g)';
    var s = '<defs><radialGradient id="' + uid + 'g" cx="0.36" cy="0.3" r="0.78">' +
      '<stop offset="0" stop-color="' + farge(hue, 94, 100) + '"/><stop offset="0.3" stop-color="' + farge(hue, 80, 95) + '"/>' +
      '<stop offset="0.72" stop-color="' + farge(hue, 62, 85) + '"/><stop offset="1" stop-color="' + farge(hue, 42, 72) + '"/></radialGradient></defs>' +
      '<ellipse cx="50" cy="93" rx="23" ry="3" fill="#000" opacity="0.35"/>';
    var kant = farge(hue, 32, 60), annen = farge((hue + 150) % 360, 78, 90);
    var form = velg(rnd, ['kule', 'drops', 'bonne', 'cupcake', 'slikkepinne', 'innpakket']);
    var a;           // hvor ansiktet sitter: x, y og størrelse
    var glans = null;
    function strossel(x0, x1, y0, y1, n) {
      var t = '';
      for (var i = 0; i < n; i++) {
        var x = mellomtall(rnd, x0, x1), y = mellomtall(rnd, y0, y1), v = Math.round(rnd() * 180);
        t += '<rect x="' + tall(x - 2.2) + '" y="' + tall(y - 0.8) + '" width="4.4" height="1.6" rx="0.8" fill="hsl(' +
          Math.round(rnd() * 360) + ' 90% 65%)" transform="rotate(' + v + ' ' + tall(x) + ' ' + tall(y) + ')"/>';
      }
      return t;
    }

    if (form === 'kule') {
      var r = mellomtall(rnd, 27, 30), cy = 91 - r;
      s += '<circle cx="50" cy="' + tall(cy) + '" r="' + tall(r) + '" fill="' + G + '" stroke="' + kant + '" stroke-width="1.5"/>';
      if (rnd() > 0.5) s += strossel(36, 64, cy - r * 0.8, cy - r * 0.45, 7);
      a = { y: cy + r * 0.08, b: r };
      glans = [50 - r * 0.42, cy - r * 0.5, r * 0.28, r * 0.15];
    } else if (form === 'drops') {
      s += '<path d="M' + P(22, 90) + 'C' + P(19, 52) + ' ' + P(30, 27) + ' ' + P(50, 27) + 'C' + P(70, 27) + ' ' + P(81, 52) + ' ' +
        P(78, 90) + 'Q' + P(50, 94) + ' ' + P(22, 90) + 'Z" fill="' + G + '" stroke="' + kant + '" stroke-width="1.5"/>';
      for (var k = 0; k < 16; k++) {
        s += '<rect x="' + tall(mellomtall(rnd, 28, 71)) + '" y="' + tall(mellomtall(rnd, 34, 86)) + '" width="1.6" height="1.6" fill="#fff" opacity="0.6"/>';
      }
      a = { y: 64, b: 24 };
      glans = [38, 40, 7, 4];
    } else if (form === 'bonne') {
      s += '<ellipse cx="50" cy="62" rx="33" ry="22" transform="rotate(-16 50 62)" fill="' + G + '" stroke="' + kant + '" stroke-width="1.5"/>';
      a = { y: 61, b: 21 };
      glans = [33, 52, 8, 4];
    } else if (form === 'cupcake') {
      s += '<path d="M' + P(27, 64) + 'L' + P(73, 64) + 'L' + P(67, 90) + 'L' + P(33, 90) + 'Z" fill="' + annen + '" stroke="' + kant + '" stroke-width="1.5" stroke-linejoin="round"/>';
      for (var rille = 1; rille < 7; rille++) {
        var rx0 = 27 + rille * 46 / 7, rx1 = 33 + rille * 34 / 7;
        s += '<path d="M' + P(rx0, 64) + 'L' + P(rx1, 90) + '" stroke="#fff" stroke-width="1.2" opacity="0.5"/>';
      }
      s += '<path d="' + glattBane([[50, 26], [62, 32], [74, 40], [78, 56], [70, 68], [50, 70], [30, 68], [22, 56], [26, 40], [38, 32]]) +
        '" fill="' + G + '" stroke="' + kant + '" stroke-width="1.5"/>';
      s += '<path d="M' + P(50, 24) + 'Q' + P(53, 14) + ' ' + P(58, 12) + '" fill="none" stroke="hsl(120 50% 35%)" stroke-width="1.6"/>' +
        '<circle cx="50" cy="26" r="5.5" fill="hsl(355 90% 52%)" stroke="hsl(355 70% 35%)" stroke-width="1.2"/>' + sirkel(48.2, 24.3, 1.5, '#fff');
      s += strossel(34, 66, 36, 44, 6);
      a = { y: 52, b: 21 };
      glans = [34, 42, 5, 3];
    } else if (form === 'slikkepinne') {
      s += '<rect x="47.5" y="62" width="5" height="30" rx="2" fill="#f7f7f7" stroke="#c9c9c9" stroke-width="1"/>';
      s += '<circle cx="50" cy="42" r="28" fill="' + G + '" stroke="' + kant + '" stroke-width="1.5"/>';
      var spiral = 'M' + P(50, 42), ang = 0, rr = 2;
      for (var sp = 0; sp < 30; sp++) { ang += 0.55; rr += 0.82; spiral += 'L' + P(50 + Math.cos(ang) * rr, 42 + Math.sin(ang) * rr); }
      s += '<path d="' + spiral + '" fill="none" stroke="#fff" stroke-width="3.2" opacity="0.45" stroke-linecap="round"/>';
      a = { y: 45, b: 22 };
      glans = [37, 27, 7, 3.5];
    } else {
      [-1, 1].forEach(function (sd) {
        s += '<path d="M' + P(50 + sd * 22, 60) + 'L' + P(50 + sd * 43, 45) + 'Q' + P(50 + sd * 38, 60) + ' ' + P(50 + sd * 43, 75) +
          'Z" fill="' + annen + '" stroke="' + kant + '" stroke-width="1.5" stroke-linejoin="round"/>' +
          '<path d="M' + P(50 + sd * 24, 60) + 'L' + P(50 + sd * 38, 52) + 'M' + P(50 + sd * 24, 60) + 'L' + P(50 + sd * 38, 68) +
          '" stroke="#fff" stroke-width="1.2" opacity="0.6"/>';
      });
      s += '<ellipse cx="50" cy="60" rx="27" ry="22" fill="' + G + '" stroke="' + kant + '" stroke-width="1.5"/>';
      a = { y: 59, b: 20 };
      glans = [39, 47, 7, 3.5];
    }
    s += '<ellipse cx="' + tall(glans[0]) + '" cy="' + tall(glans[1]) + '" rx="' + tall(glans[2]) + '" ry="' + tall(glans[3]) +
      '" fill="#fff" opacity="0.6" transform="rotate(-28 ' + tall(glans[0]) + ' ' + tall(glans[1]) + ')"/>';

    // ansikt: store blanke øyne, rødme i kinnene
    var b = a.b, ey = a.y - b * 0.16, ex = b * 0.42, oyeStil = velg(rnd, ['blanke', 'blanke', 'glad', 'iris']);
    [-1, 1].forEach(function (sd) {
      s += '<ellipse cx="' + tall(50 + sd * b * 0.66) + '" cy="' + tall(a.y + b * 0.16) + '" rx="' + tall(b * 0.15) + '" ry="' + tall(b * 0.09) +
        '" fill="hsl(340 95% 72%)" opacity="0.7"/>';
    });
    [-1, 1].forEach(function (sd) {
      var x = 50 + sd * ex, rx = b * 0.22, ry = b * 0.28;
      s += '<g class="oye">';
      if (oyeStil === 'glad') {
        s += '<path d="M' + P(x - rx, ey + 1) + 'Q' + P(x, ey - ry * 1.1) + ' ' + P(x + rx, ey + 1) + '" fill="none" stroke="#2a1030" stroke-width="2.6" stroke-linecap="round"/>';
      } else {
        if (oyeStil === 'iris') {
          s += '<ellipse cx="' + tall(x) + '" cy="' + tall(ey) + '" rx="' + tall(rx) + '" ry="' + tall(ry) + '" fill="#fff" stroke="#2a1030" stroke-width="1.2"/>' +
            '<ellipse cx="' + tall(x) + '" cy="' + tall(ey + ry * 0.15) + '" rx="' + tall(rx * 0.72) + '" ry="' + tall(ry * 0.75) + '" fill="' + farge((hue + 180) % 360, 45, 80) + '"/>' +
            '<ellipse cx="' + tall(x) + '" cy="' + tall(ey + ry * 0.2) + '" rx="' + tall(rx * 0.4) + '" ry="' + tall(ry * 0.45) + '" fill="#2a1030"/>';
        } else {
          s += '<ellipse cx="' + tall(x) + '" cy="' + tall(ey) + '" rx="' + tall(rx) + '" ry="' + tall(ry) + '" fill="#2a1030"/>';
        }
        s += sirkel(x + rx * 0.3, ey - ry * 0.4, rx * 0.4, '#fff') + sirkel(x - rx * 0.35, ey + ry * 0.45, rx * 0.17, '#fff');
      }
      s += '</g>';
    });
    var my = a.y + b * 0.3, munnStil = velg(rnd, ['aapen', 'katt', 'liten']);
    s += '<g class="munn">';
    if (munnStil === 'aapen') {
      s += '<path d="M' + P(50 - b * 0.2, my - 1) + 'Q' + P(50, my + b * 0.36) + ' ' + P(50 + b * 0.2, my - 1) + 'Z" fill="#5a1030"/>' +
        '<ellipse cx="50" cy="' + tall(my + b * 0.12) + '" rx="' + tall(b * 0.08) + '" ry="' + tall(b * 0.05) + '" fill="#ff7aa8"/>';
    } else if (munnStil === 'katt') {
      s += '<ellipse cx="50" cy="' + tall(my + 1.4) + '" rx="1.8" ry="1.4" fill="#5a1030"/>' +
        '<path d="M' + P(50 - b * 0.16, my - 0.5) + 'Q' + P(50 - b * 0.08, my + 2.5) + ' ' + P(50, my) + 'Q' + P(50 + b * 0.08, my + 2.5) + ' ' +
        P(50 + b * 0.16, my - 0.5) + '" fill="none" stroke="#2a1030" stroke-width="1.8" stroke-linecap="round"/>';
    } else {
      s += '<ellipse cx="50" cy="' + tall(my + 0.5) + '" rx="' + tall(b * 0.07) + '" ry="' + tall(b * 0.08) + '" fill="#5a1030"/>';
    }
    return svg(s + '</g>');
  }

  /* ---------- hulemalerier ---------- */

  /* Dinosaurene står i profil, som på en hulevegg: en fylt silhuett i
     kritt på en steinflis, med skravur og en ekstra, litt forskjøvet
     krittstrek rundt. Silhuettene er noen få nøkkelpunkter per art som rystes
     litt og glattes — da blir hvert dyr litt forskjellig, og alle ser tegnet
     for hånd. */
  var DINOER = {
    trex: {
      kropp: [[10, 60], [26, 50], [40, 44], [52, 40], [60, 30], [66, 20], [80, 17], [90, 22], [93, 30], [86, 35],
        [74, 37], [68, 43], [66, 53], [58, 63], [44, 65], [30, 61]],
      bein: [[[46, 60], [43, 74], [48, 86]], [[56, 60], [60, 74], [55, 86]]], arm: [[64, 48], [70, 53], [73, 50]],
      oye: [79, 24], munn: [85, 31], tenner: true
    },
    langhals: {
      kropp: [[5, 68], [20, 58], [34, 48], [50, 43], [62, 46], [67, 36], [71, 22], [75, 12], [85, 10], [91, 15], [86, 20],
        [78, 21], [76, 32], [74, 46], [70, 58], [56, 65], [38, 66], [22, 66]],
      bein: [[[30, 60], [30, 86]], [[40, 63], [40, 86]], [[58, 62], [58, 86]], [[66, 58], [66, 86]]],
      oye: [82, 14], munn: [87, 18]
    },
    triceratops: {
      kropp: [[8, 62], [22, 54], [36, 46], [52, 44], [62, 46], [63, 30], [70, 22], [78, 30], [84, 40], [93, 48], [86, 55],
        [74, 57], [66, 62], [52, 67], [34, 67], [20, 65]],
      bein: [[[30, 63], [30, 86]], [[40, 65], [40, 86]], [[58, 65], [58, 86]], [[66, 63], [66, 86]]],
      horn: [[[79, 37], [91, 27]], [[71, 31], [82, 19]], [[88, 48], [94, 44]]],
      oye: [78, 42], munn: [88, 52]
    },
    stego: {
      kropp: [[5, 72], [18, 62], [32, 50], [48, 44], [62, 48], [72, 56], [82, 56], [90, 59], [91, 64], [84, 67], [72, 67],
        [62, 70], [44, 71], [26, 71], [14, 72]],
      plater: [[24, 56], [34, 48], [46, 43], [57, 45], [66, 51]],
      bein: [[[30, 68], [30, 86]], [[38, 70], [38, 86]], [[56, 69], [56, 86]], [[64, 67], [64, 86]]],
      oye: [86, 59], munn: [89, 64]
    },
    ptero: {
      kropp: [[50, 34], [56, 38], [90, 30], [80, 48], [58, 50], [56, 64], [50, 72], [44, 64], [42, 50], [20, 48], [10, 30], [44, 38]],
      bein: [[[47, 68], [45, 80]], [[53, 68], [55, 80]]],
      hode: true, oye: [54, 27], munn: [62, 31]
    }
  };

  function tegnDino(rnd, hue, f, uid) {
    var art = velg(rnd, ['trex', 'langhals', 'triceratops', 'stego', 'ptero', 'trex']);
    var D = DINOER[art];
    var kritt = farge(hue, 64, 62), mork2 = farge(hue, 42, 55), lysKritt = '#f6ecd9';
    function ryst(p) { return [p[0] + (rnd() - 0.5) * 2.4, p[1] + (rnd() - 0.5) * 2.4]; }

    // steinflisen
    var stein = [];
    for (var i = 0; i < 11; i++) {
      var ang = i / 11 * Math.PI * 2, rr = 45 + (rnd() - 0.5) * 3;
      stein.push([50 + Math.cos(ang) * rr, 50 + Math.sin(ang) * rr * 0.97]);
    }
    var s = '<defs><linearGradient id="' + uid + 's" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#4c4038"/>' +
      '<stop offset="1" stop-color="#29211d"/></linearGradient></defs>' +
      '<path d="' + glattBane(stein) + '" fill="url(#' + uid + 's)" stroke="#15100e" stroke-width="2"/>';
    for (i = 0; i < 14; i++) {
      var va = rnd() * Math.PI * 2, vr = rnd() * 38;
      s += sirkel(50 + Math.cos(va) * vr, 50 + Math.sin(va) * vr, 0.5 + rnd(), '#5d5046');
    }
    var sprekk = 'M' + P(50 + 44 * Math.cos(1.2 + rnd()), 50 + 44 * Math.sin(1.2 + rnd()));
    for (i = 0; i < 3; i++) sprekk += 'L' + P(mellomtall(rnd, 30, 70), mellomtall(rnd, 70, 88));
    s += '<path d="' + sprekk + '" fill="none" stroke="#1a1412" stroke-width="1"/>';

    // dyret, speilet halve gangen så noen ser til venstre
    var speil = rnd() > 0.5;
    /* Litt mindre enn flisen, så langhalsen ikke stikker hodet ut over kanten. */
    var g = '<g transform="translate(7 7.3) scale(0.86)"><g' + (speil ? ' transform="matrix(-1 0 0 1 100 0)"' : '') + '>';
    D.bein.forEach(function (b) {
      var d = 'M' + b.map(function (p) { var q = ryst(p); return P(q[0], q[1]); }).join('L');
      g += '<path d="' + d + '" fill="none" stroke="' + mork2 + '" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
    });
    if (D.plater) {
      D.plater.forEach(function (p, k) {
        var h = k === 2 ? 13 : 10;
        g += '<path d="' + mangekant([[p[0] - 5, p[1] + 4], [p[0] - 1, p[1] - h], [p[0] + 5, p[1] + 3]]) + '" fill="' +
          farge((hue + 30) % 360, 60, 60) + '" stroke="' + mork2 + '" stroke-width="1.5" stroke-linejoin="round"/>';
      });
    }
    var kropp = glattBane(D.kropp.map(ryst));
    g += '<path d="' + kropp + '" fill="' + kritt + '" stroke="' + mork2 + '" stroke-width="2"/>';
    if (D.hode) {
      g += '<path d="M' + P(55, 30) + 'L' + P(72, 32) + 'L' + P(56, 35) + 'Z" fill="' + kritt + '" stroke="' + mork2 + '" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M' + P(47, 26) + 'L' + P(34, 20) + 'L' + P(48, 30) + 'Z" fill="' + kritt + '" stroke="' + mork2 + '" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<circle cx="51" cy="29" r="7" fill="' + kritt + '" stroke="' + mork2 + '" stroke-width="1.8"/>';
    }
    if (D.horn) {
      D.horn.forEach(function (h) {
        var b0 = h[0], t = h[1];
        g += '<path d="' + mangekant([[b0[0] - 2.2, b0[1] + 1.5], t, [b0[0] + 2.2, b0[1] - 1.5]]) + '" fill="' + lysKritt +
          '" stroke="' + mork2 + '" stroke-width="1.3" stroke-linejoin="round"/>';
      });
    }
    if (D.arm) {
      g += '<path d="M' + D.arm.map(function (p) { return P(p[0], p[1]); }).join('L') + '" fill="none" stroke="' + mork2 +
        '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    // skravur og flekker, som om det er malt med kritt og fingre
    var sx = 0, sy = 0;
    D.kropp.forEach(function (p) { sx += p[0]; sy += p[1]; });
    sx /= D.kropp.length; sy /= D.kropp.length;
    for (i = 0; i < 5; i++) {
      var hx = sx - 12 + i * 5 + (rnd() - 0.5) * 3, hy = sy + (rnd() - 0.5) * 4;
      g += '<path d="M' + P(hx, hy + 3) + 'L' + P(hx + 3.5, hy - 3) + '" stroke="' + lysKritt + '" stroke-width="1.1" opacity="0.35"/>';
    }
    for (i = 0; i < 4; i++) {
      g += sirkel(sx - 10 + rnd() * 20, sy - 6 + rnd() * 6, 1.4 + rnd() * 1.4, mork2);
    }
    g += '<path d="' + kropp + '" fill="none" stroke="' + lysKritt + '" stroke-width="1.2" opacity="0.5" transform="translate(0.8 -0.6)"/>';

    var o = D.oye, m = D.munn;
    g += '<g class="oye"><circle cx="' + o[0] + '" cy="' + o[1] + '" r="3.4" fill="' + lysKritt + '" stroke="' + mork2 + '" stroke-width="1"/>' +
      sirkel(o[0] + 0.8, o[1], 1.7, '#2a1f1a') + '</g>';
    g += '<g class="munn"><ellipse cx="' + m[0] + '" cy="' + m[1] + '" rx="' + (D.tenner ? 5.5 : 3.6) + '" ry="1.8" fill="#2a1f1a"/>';
    if (D.tenner) {
      for (i = 0; i < 3; i++) g += '<path d="M' + P(m[0] - 3.5 + i * 3, m[1] - 1.6) + 'l1 2.2l1 -2.2Z" fill="' + lysKritt + '"/>';
    }
    g += '</g></g></g>';
    return svg(s + g);
  }

  /* ---------- origami ---------- */

  /* Hver flate brettes i trekanter fra midten, og hver trekant får sin
     egen lysstyrke — lysere oppe til venstre, der lyset kommer fra. Det er
     hele origamiuttrykket: ingen streker, bare flater som møtes. */
  function fasett(pkt, hue, lys, metn, rnd) {
    var cx = 0, cy = 0, s = '', n = pkt.length;
    pkt.forEach(function (p) { cx += p[0]; cy += p[1]; });
    cx /= n; cy /= n;
    for (var i = 0; i < n; i++) {
      var a = pkt[i], b = pkt[(i + 1) % n];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      var l = Math.max(8, Math.min(97, lys + (cx - mx) * 0.3 + (cy - my) * 0.4 + (rnd() - 0.5) * 7));
      var c = farge(hue, l, metn);
      s += '<path d="' + mangekant([[cx, cy], a, b]) + '" fill="' + c + '" stroke="' + c + '" stroke-width="0.5" stroke-linejoin="round"/>';
    }
    return s;
  }

  function ring(cx, cy, rx, ry, n, rot) {
    var p = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + (rot || 0) - Math.PI / 2;
      p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return p;
  }

  function hexOye(x, y, r, kull) {
    if (kull) {
      return '<g class="oye"><path d="' + mangekant(ring(x, y, r, r, 6)) + '" fill="#1c1a24"/>' +
        '<rect x="' + tall(x - r * 0.45) + '" y="' + tall(y - r * 0.5) + '" width="' + tall(r * 0.35) + '" height="' + tall(r * 0.35) + '" fill="#fff"/></g>';
    }
    return '<g class="oye"><path d="' + mangekant(ring(x, y, r, r, 6)) + '" fill="#fff"/>' +
      '<path d="' + mangekant(ring(x, y + r * 0.08, r * 0.55, r * 0.55, 6)) + '" fill="#1c1a24"/>' +
      '<rect x="' + tall(x - r * 0.3) + '" y="' + tall(y - r * 0.35) + '" width="' + tall(r * 0.25) + '" height="' + tall(r * 0.25) + '" fill="#fff"/></g>';
  }

  function tegnOrigami(rnd, hue) {
    var dyr = velg(rnd, ['ugle', 'pingvin', 'rev', 'isbjorn', 'reinsdyr', 'snomann']);
    var s = '', m = '', i;
    // snøfnugg rundt
    for (i = 0; i < 4; i++) {
      var fx = [12, 88, 14, 86][i] + (rnd() - 0.5) * 4, fy = [14, 18, 50, 56][i] + (rnd() - 0.5) * 6, fr = 2 + rnd() * 1.5;
      var d = '';
      for (var k = 0; k < 3; k++) {
        var ang = k * Math.PI / 3;
        d += 'M' + P(fx - Math.cos(ang) * fr, fy - Math.sin(ang) * fr) + 'L' + P(fx + Math.cos(ang) * fr, fy + Math.sin(ang) * fr);
      }
      s += '<path d="' + d + '" stroke="#eaf6ff" stroke-width="0.9" opacity="0.55"/>';
    }
    var oransje = 32;
    var blikk = (rnd() - 0.5) * 2;

    if (dyr === 'ugle') {
      [-1, 1].forEach(function (sd) {
        s += fasett([[50 + sd * 14, 38], [50 + sd * 23, 16], [50 + sd * 26, 42]], hue, 42, 50, rnd);
      });
      s += fasett(ring(50, 60, 25, 29, 8, Math.PI / 8), hue, 52, 48, rnd);
      s += fasett(ring(50, 72, 13, 14, 6), hue, 80, 35, rnd);
      [-1, 1].forEach(function (sd) {
        s += fasett([[50 + sd * 18, 52], [50 + sd * 28, 66], [50 + sd * 20, 84]], hue, 38, 50, rnd);
        s += fasett(ring(50 + sd * 10.5, 50, 11, 11, 6), hue, 88, 30, rnd);
        s += fasett([[50 + sd * 6, 88], [50 + sd * 11, 88], [50 + sd * 8.5, 93]], oransje, 55, 90, rnd);
      });
      s += hexOye(39.5, 50, 7, false) + hexOye(60.5, 50, 7, false);
      m = fasett([[46, 57], [54, 57], [50, 65]], oransje, 58, 95, rnd);
    } else if (dyr === 'pingvin') {
      [-1, 1].forEach(function (sd) {
        s += fasett([[50 + sd * 21, 48], [50 + sd * 34, 68], [50 + sd * 22, 66]], hue, 26, 40, rnd);
        s += fasett([[50 + sd * 4, 87], [50 + sd * 15, 87], [50 + sd * 9, 93]], oransje, 55, 90, rnd);
      });
      s += fasett([[50, 18], [64, 26], [72, 52], [67, 82], [50, 89], [33, 82], [28, 52], [36, 26]], hue, 26, 40, rnd);
      s += fasett([[50, 38], [61, 48], [63, 70], [50, 84], [37, 70], [39, 48]], hue, 93, 12, rnd);
      s += fasett([[40, 30], [60, 30], [58, 42], [42, 42]], hue, 90, 12, rnd);
      s += hexOye(44, 35, 4, false) + hexOye(56, 35, 4, false);
      [-1, 1].forEach(function (sd) {
        s += '<ellipse cx="' + (50 + sd * 11) + '" cy="42" rx="2.6" ry="1.5" fill="hsl(345 90% 70%)" opacity="0.7"/>';
      });
      m = fasett([[45, 41], [55, 41], [50, 48]], oransje, 58, 95, rnd);
    } else if (dyr === 'rev') {
      s += fasett([[62, 80], [84, 60], [92, 72], [80, 90], [64, 90]], hue, 50, 70, rnd);
      s += fasett([[84, 60], [92, 72], [90, 62]], hue, 94, 10, rnd);
      s += fasett([[37, 62], [63, 62], [68, 90], [32, 90]], hue, 48, 65, rnd);
      s += fasett([[42, 66], [58, 66], [56, 86], [44, 86]], hue, 92, 12, rnd);
      [-1, 1].forEach(function (sd) {
        s += fasett([[50 + sd * 24, 28], [50 + sd * 19, 8], [50 + sd * 9, 30]], hue, 50, 70, rnd);
        s += fasett([[50 + sd * 21, 26], [50 + sd * 18.5, 14], [50 + sd * 13, 28]], hue, 22, 40, rnd);
      });
      s += fasett([[26, 28], [40, 34], [60, 34], [74, 28], [70, 46], [58, 60], [50, 64], [42, 60], [30, 46]], hue, 52, 72, rnd);
      [-1, 1].forEach(function (sd) {
        s += fasett([[50 + sd * 20, 46], [50 + sd * 6, 56], [50, 64], [50 + sd * 4, 52]], hue, 93, 10, rnd);
      });
      s += hexOye(40, 42, 4, false) + hexOye(60, 42, 4, false);
      s += '<path d="' + mangekant([[47, 57], [53, 57], [50, 61]]) + '" fill="#1c1a24"/>';
      m = '<path d="' + mangekant([[47.5, 63], [52.5, 63], [50, 66]]) + '" fill="#5a1d2a"/>';
    } else if (dyr === 'isbjorn') {
      s += fasett(ring(50, 79, 25, 14, 8, Math.PI / 8), hue, 86, 22, rnd);
      [-1, 1].forEach(function (sd) {
        s += fasett(ring(50 + sd * 17, 88, 6, 4, 6), hue, 80, 22, rnd);
        s += fasett(ring(50 + sd * 17, 28, 6.5, 6.5, 6), hue, 84, 22, rnd);
        s += fasett(ring(50 + sd * 17, 28.5, 3, 3, 6), hue, 60, 30, rnd);
      });
      s += fasett(ring(50, 45, 23, 20, 8, Math.PI / 8), hue, 90, 20, rnd);
      s += fasett(ring(50, 53, 10.5, 7.5, 6), hue, 97, 10, rnd);
      s += hexOye(41, 40, 3.2, true) + hexOye(59, 40, 3.2, true);
      s += '<path d="' + mangekant([[46, 49], [54, 49], [50, 53.5]]) + '" fill="#1c1a24"/>';
      m = '<path d="' + mangekant([[47, 56], [53, 56], [50, 59]]) + '" fill="#5a1d2a"/>';
    } else if (dyr === 'reinsdyr') {
      var gevir = '#f2e3c6';
      [-1, 1].forEach(function (sd) {
        var gd = 'M' + P(50 + sd * 8, 30) + 'L' + P(50 + sd * 18, 12) + 'M' + P(50 + sd * 13, 21) + 'L' + P(50 + sd * 24, 16) +
          'M' + P(50 + sd * 16, 15) + 'L' + P(50 + sd * 14, 7) + 'M' + P(50 + sd * 19, 18) + 'L' + P(50 + sd * 28, 10);
        s += '<path d="' + gd + '" stroke="' + gevir + '" stroke-width="2.6" stroke-linecap="round"/>';
      });
      s += fasett([[36, 62], [64, 62], [68, 90], [32, 90]], hue, 42, 45, rnd);
      [-1, 1].forEach(function (sd) {
        s += fasett([[50 + sd * 14, 34], [50 + sd * 28, 30], [50 + sd * 16, 42]], hue, 40, 45, rnd);
      });
      s += fasett([[37, 28], [63, 28], [66, 46], [58, 66], [42, 66], [34, 46]], hue, 46, 45, rnd);
      s += fasett([[42, 52], [58, 52], [56, 66], [44, 66]], hue, 70, 35, rnd);
      s += hexOye(42, 42, 4, false) + hexOye(58, 42, 4, false);
      var rodNese = rnd() > 0.5;
      s += '<path d="' + mangekant(ring(50, 56, 4.5, 3.8, 6)) + '" fill="' + (rodNese ? 'hsl(355 90% 55%)' : '#1c1a24') + '"/>' +
        (rodNese ? '<circle cx="50" cy="56" r="7" fill="hsl(355 100% 60%)" opacity="0.25"/>' : '');
      m = '<path d="' + mangekant([[47, 61.5], [53, 61.5], [50, 64.5]]) + '" fill="#5a1d2a"/>';
    } else {
      // snømann med skjerf, hatt og gulrot
      s += fasett(ring(50, 76, 21, 15, 8, Math.PI / 8), hue, 92, 25, rnd);
      s += fasett(ring(50, 54, 16, 12, 8, Math.PI / 8), hue, 93, 25, rnd);
      s += fasett(ring(50, 34, 13, 11.5, 8, Math.PI / 8), hue, 94, 25, rnd);
      s += fasett([[36, 44], [64, 44], [62, 49], [38, 49]], (hue + 180) % 360, 55, 80, rnd);
      s += fasett([[56, 46], [62, 46], [64, 60], [58, 58]], (hue + 180) % 360, 50, 80, rnd);
      s += fasett([[38, 24], [62, 24], [62, 27], [38, 27]], 250, 18, 15, rnd);
      s += fasett([[42, 25], [58, 25], [56, 9], [44, 9]], 250, 20, 15, rnd);
      s += '<rect x="42.6" y="19" width="14.8" height="3" fill="' + farge(hue, 55, 80) + '"/>';
      s += hexOye(45, 31, 2.6, true) + hexOye(55, 31, 2.6, true);
      s += fasett([[49, 34.5], [49, 38], [60, 36.5]], oransje, 55, 95, rnd);
      [58, 64].forEach(function (y) { s += '<path d="' + mangekant(ring(50, y, 1.8, 1.8, 6)) + '" fill="#1c1a24"/>'; });
      for (i = 0; i < 5; i++) {
        var t = i / 4, kx = 44.5 + t * 11, ky = 40.5 + Math.sin(t * Math.PI) * 2;
        m += '<rect x="' + tall(kx - 0.9) + '" y="' + tall(ky - 0.9) + '" width="1.8" height="1.8" fill="#1c1a24"/>';
      }
    }
    return svg(s + '<g class="munn">' + m + '</g>');
  }

  /* ---------- tegneserie ---------- */

  /* Superhelter som i et tegneseriehefte: tykk svart strek, flate farger,
     rasterprikker i skyggene og en eksplosjon bak med «POW!». Heltene er
     fortsatt monstre — med horn, antenner og maske. */
  function stjerneform(cx, cy, ytre, indre, n, rnd) {
    var p = [];
    for (var i = 0; i < n * 2; i++) {
      var a = i / (n * 2) * Math.PI * 2 - Math.PI / 2;
      var r = (i % 2 ? indre : ytre) * (1 + (rnd() - 0.5) * 0.12);
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return p;
  }

  function tegnTegneserie(rnd, hue, f, uid) {
    var BLEKK = '#111';
    var hud = farge(hue, 60, 78);
    var drakt = velg(rnd, ['hsl(215 85% 50%)', 'hsl(355 85% 52%)', 'hsl(140 70% 40%)', 'hsl(275 70% 52%)', 'hsl(28 95% 52%)']);
    var kappeF = velg(rnd, ['hsl(355 85% 50%)', 'hsl(48 100% 52%)', 'hsl(200 90% 48%)', 'hsl(290 70% 50%)']);
    var maskeF = velg(rnd, [BLEKK, kappeF, drakt]);
    function linje(d, fyll, b) {
      return '<path d="' + d + '" fill="' + fyll + '" stroke="' + BLEKK + '" stroke-width="' + (b || 2.4) + '" stroke-linejoin="round"/>';
    }
    var s = '<defs><pattern id="' + uid + 'p" width="3.6" height="3.6" patternUnits="userSpaceOnUse">' +
      '<circle cx="1.8" cy="1.8" r="0.85" fill="#000" opacity="0.3"/></pattern>' +
      '<pattern id="' + uid + 'q" width="4" height="4" patternUnits="userSpaceOnUse">' +
      '<circle cx="2" cy="2" r="1.1" fill="hsl(20 100% 55%)" opacity="0.55"/></pattern></defs>';
    var smell = mangekant(stjerneform(50, 50, 45, 33, 12, rnd));
    s += linje(smell, '#ffd93e', 2) + '<path d="' + smell + '" fill="url(#' + uid + 'q)"/>';
    s += '<text x="21" y="22" transform="rotate(-14 21 22)" text-anchor="middle" font-size="11" font-weight="900" ' +
      'font-family="Impact, \'Arial Black\', sans-serif" fill="hsl(355 90% 52%)" stroke="' + BLEKK + '" stroke-width="0.8">' +
      velg(rnd, ['POW!', 'BAM!', 'ZAP!', 'WOW!', 'BOOM!', 'KRASJ!']) + '</text>';

    var hy = mellomtall(rnd, 32, 35), hr = mellomtall(rnd, 12, 14);
    // helten tegnes litt større enn eksplosjonen bak, ellers drukner den i kortet
    s += '<g transform="translate(-5 -5.8) scale(1.1)">';
    // kappen bak alt
    s += linje('M' + P(37, 50) + 'L' + P(63, 50) + 'Q' + P(74, 70) + ' ' + P(76, 88) + 'Q' + P(68, 84) + ' ' + P(63, 89) +
      'Q' + P(56, 84) + ' ' + P(50, 89) + 'Q' + P(44, 84) + ' ' + P(37, 89) + 'Q' + P(32, 84) + ' ' + P(24, 88) +
      'Q' + P(26, 70) + ' ' + P(37, 50) + 'Z', kappeF);

    // bein og støvler
    [-1, 1].forEach(function (sd) {
      var x = 50 + sd * 5.5;
      s += linje(hjorneBane([[x - 3.6, 72], [x + 3.6, 72], [x + 3.4, 86], [x - 3.4, 86]], 0.15), drakt);
      s += linje(hjorneBane([[x - 4, 84], [x + 4, 84], [x + 4 + sd * 2, 92], [x - 4 + sd * 0.5, 92]], 0.25), kappeF);
    });

    // armene: på hoftene, en knyttneve i været, eller begge opp
    var pose = velg(rnd, ['hofter', 'opp', 'kraft']);
    [-1, 1].forEach(function (sd) {
      var sx = 50 + sd * 14, sy = 53, albue, hand;
      if (pose === 'kraft' || (pose === 'opp' && sd === 1)) {
        albue = [50 + sd * 27, 50]; hand = [50 + sd * (pose === 'opp' ? 22 : 25), pose === 'opp' ? 24 : 36];
      } else {
        albue = [50 + sd * 25, 60]; hand = [50 + sd * 15, 70];
      }
      s += linje(tykkKurve([sx, sy], albue, hand, 3.4, 3), drakt);
      s += linje(ellD(hand[0], hand[1], 4, 4), hud, 2);
    });

    // brystkassen, med rasterskygge på høyre side og merket midt på
    var torso = hjorneBane([[34, 49], [66, 49], [59, 75], [41, 75]], 0.2);
    s += linje(torso, drakt) + '<path d="M' + P(50, 49) + 'L' + P(66, 49) + 'L' + P(59, 75) + 'L' + P(50, 75) + 'Z" fill="url(#' + uid + 'p)"/>';
    s += '<rect x="41" y="70" width="18" height="4.5" fill="hsl(48 100% 55%)" stroke="' + BLEKK + '" stroke-width="1.8"/>';
    s += linje(ellD(50, 60, 6.8, 6.8), 'hsl(48 100% 60%)', 1.8);
    var merke = velg(rnd, ['lyn', 'stjerne', 'hjerte']);
    if (merke === 'lyn') s += '<path d="' + mangekant([[51.5, 54.5], [46.5, 61], [50, 61], [48.5, 65.5], [53.5, 59], [50, 59]]) + '" fill="hsl(355 90% 50%)"/>';
    else if (merke === 'stjerne') s += '<path d="' + mangekant(stjerneform(50, 60.4, 5, 2.2, 5, function () { return 0.5; })) + '" fill="hsl(355 90% 50%)"/>';
    else s += '<path d="M' + P(50, 64) + 'C' + P(44, 60) + ' ' + P(46, 55) + ' ' + P(50, 58) + 'C' + P(54, 55) + ' ' + P(56, 60) + ' ' + P(50, 64) + 'Z" fill="hsl(355 90% 50%)"/>';

    // monsterpynt bak hodet
    var pynt = velg(rnd, ['orer', 'horn', 'antenne', 'hanekam', 'ingen']);
    if (pynt === 'horn') {
      [-1, 1].forEach(function (sd) { s += linje(tykkKurve([50 + sd * hr * 0.55, hy - hr * 0.6], [50 + sd * hr * 1.1, hy - hr * 1.1], [50 + sd * hr * 0.9, hy - hr * 1.7], 3, 0.6), '#f4efe0', 2); });
    } else if (pynt === 'orer') {
      [-1, 1].forEach(function (sd) { s += linje(mangekant([[50 + sd * hr * 0.4, hy - hr * 0.8], [50 + sd * hr * 1.05, hy - hr * 1.6], [50 + sd * hr * 0.95, hy - hr * 0.3]]), hud, 2); });
    } else if (pynt === 'antenne') {
      s += '<path d="M' + P(50, hy - hr) + 'L' + P(53, hy - hr - 6) + '" stroke="' + BLEKK + '" stroke-width="2"/>' + linje(ellD(53, hy - hr - 7, 2.6, 2.6), kappeF, 1.6);
    } else if (pynt === 'hanekam') {
      s += linje('M' + P(44, hy - hr + 3) + 'L' + P(46, hy - hr - 8) + 'L' + P(50, hy - hr - 1) + 'L' + P(53, hy - hr - 10) + 'L' + P(56, hy - hr + 3) + 'Z', BLEKK, 1.6);
    }

    s += linje(ellD(50, hy, hr, hr * 1.02), hud, 2.6);
    s += '<path d="M' + P(50, hy - hr) + 'A' + tall(hr) + ' ' + tall(hr) + ' 0 0 1 ' + P(50, hy + hr) + 'Z" fill="url(#' + uid + 'p)"/>';

    // masken med hvite øyne uten pupiller — heltenes blikk
    var ey = hy - hr * 0.08;
    s += linje('M' + P(50 - hr - 1.5, ey - 1) + 'Q' + P(50 - hr * 0.55, ey - 7.5) + ' ' + P(50, ey - 3.5) + 'Q' + P(50 + hr * 0.55, ey - 7.5) + ' ' +
      P(50 + hr + 1.5, ey - 1) + 'Q' + P(50 + hr * 0.8, ey + 6.5) + ' ' + P(50 + 2.5, ey + 4) + 'L' + P(47.5, ey + 4) +
      'Q' + P(50 - hr * 0.8, ey + 6.5) + ' ' + P(50 - hr - 1.5, ey - 1) + 'Z', maskeF, 2);
    [-1, 1].forEach(function (sd) {
      s += '<g class="oye"><path d="M' + P(50 + sd * hr * 0.2, ey + 1.2) + 'Q' + P(50 + sd * hr * 0.45, ey - 3.6) + ' ' + P(50 + sd * hr * 0.72, ey + 0.2) +
        'Q' + P(50 + sd * hr * 0.46, ey + 2.4) + ' ' + P(50 + sd * hr * 0.2, ey + 1.2) + 'Z" fill="#fff" stroke="' + BLEKK + '" stroke-width="1.2"/></g>';
    });
    var my = hy + hr * 0.52;
    s += '<g class="munn"><path d="M' + P(45, my - 1) + 'Q' + P(50, my + 5) + ' ' + P(55, my - 1) + 'Z" fill="#5a0f2a" stroke="' + BLEKK +
      '" stroke-width="1.6" stroke-linejoin="round"/><rect x="46.2" y="' + tall(my - 0.8) + '" width="7.6" height="1.8" fill="#fff"/></g>';
    return svg(s + '</g>');
  }

  /* ---------- glassmaleri ---------- */

  /* Folk fra borgen i et kirkevindu: en spissbue delt i ruter av bly, og
     figurene i sterke glassfarger med tykke blylinjer rundt. Et svakt lys
     innenfra gjør at det ser ut som sol som skinner gjennom. */
  function tegnGlassmaleri(rnd, hue, f, uid) {
    var BLY = '#15121a';
    var bue = 'M' + P(14, 95) + 'L' + P(14, 42) + 'Q' + P(14, 6) + ' ' + P(50, 5) + 'Q' + P(86, 6) + ' ' + P(86, 42) + 'L' + P(86, 95) + 'Z';
    function glass(d, fyll, b) {
      return '<path d="' + d + '" fill="' + fyll + '" stroke="' + BLY + '" stroke-width="' + (b || 2.4) + '" stroke-linejoin="round"/>';
    }
    var s = '<defs><clipPath id="' + uid + 'v"><path d="' + bue + '"/></clipPath>' +
      '<radialGradient id="' + uid + 'l" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/>' +
      '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>';
    // rutene bak figuren, i to glassfarger som veksler
    s += '<g clip-path="url(#' + uid + 'v)">';
    var n = 10;
    for (var i = 0; i < n; i++) {
      var a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      s += glass(mangekant([[50, 58], [50 + Math.cos(a0) * 80, 58 + Math.sin(a0) * 80], [50 + Math.cos(a1) * 80, 58 + Math.sin(a1) * 80]]),
        farge((hue + (i % 2 ? 0 : 28)) % 360, i % 2 ? 34 : 44, 70), 1.6);
    }
    s += '<circle cx="50" cy="58" r="33" fill="none" stroke="' + BLY + '" stroke-width="1.6"/></g>';

    var hud = 'hsl(32 70% 78%)', kappe = farge((hue + 180) % 360, 42, 75), gull = 'hsl(45 90% 55%)';
    var hvem = velg(rnd, ['ridder', 'konge', 'dronning', 'narr', 'trollmann']);

    // kappe/skuldre nederst
    s += glass('M' + P(20, 95) + 'Q' + P(24, 70) + ' ' + P(50, 67) + 'Q' + P(76, 70) + ' ' + P(80, 95) + 'Z', kappe);
    s += '<path d="M' + P(50, 68) + 'L' + P(50, 95) + '" stroke="' + BLY + '" stroke-width="1.8"/>';

    var oyne = '', munn = '';
    if (hvem === 'ridder') {
      s += glass('M' + P(50, 29) + 'Q' + P(56, 14) + ' ' + P(62, 8) + 'Q' + P(60, 20) + ' ' + P(54, 30) + 'Z', farge(hue, 55, 85), 1.8);
      s += glass('M' + P(35, 64) + 'L' + P(35, 44) + 'Q' + P(35, 28) + ' ' + P(50, 27) + 'Q' + P(65, 28) + ' ' + P(65, 44) + 'L' + P(65, 64) + 'Z', '#c9d2dc');
      s += glass(hjorneBane([[36, 42], [64, 42], [64, 50], [36, 50]], 0.2), '#7f8b99', 1.8);
      oyne = '<g class="oye"><rect x="39" y="45" width="8.5" height="2.4" rx="1.2" fill="#ffd23e"/></g>' +
        '<g class="oye"><rect x="52.5" y="45" width="8.5" height="2.4" rx="1.2" fill="#ffd23e"/></g>';
      munn = '<g class="munn">' + [44, 48, 52, 56].map(function (x) { return sirkel(x, 57, 1.1, BLY); }).join('') + '</g>';
      s += glass(hjorneBane([[41, 72], [59, 72], [59, 82], [50, 92], [41, 82]], 0.15), farge(hue, 50, 75), 2);
      s += '<path d="M' + P(50, 74) + 'L' + P(50, 88) + 'M' + P(44, 79) + 'L' + P(56, 79) + '" stroke="' + gull + '" stroke-width="2.6"/>';
    } else {
      s += glass(ellD(50, 50, 13.5, 14.5), hud);
      var ey = 48;
      [-1, 1].forEach(function (sd) {
        oyne += '<g class="oye">' + sirkel(50 + sd * 5, ey, 1.9, BLY) + sirkel(50 + sd * 5 - 0.6, ey - 0.6, 0.6, '#fff') + '</g>';
      });
      munn = '<g class="munn"><ellipse cx="50" cy="56" rx="3" ry="1.8" fill="hsl(355 60% 40%)" stroke="' + BLY + '" stroke-width="1"/></g>';
      if (hvem === 'konge') {
        s += glass('M' + P(38, 58) + 'Q' + P(50, 78) + ' ' + P(62, 58) + 'Q' + P(56, 62) + ' ' + P(50, 60) + 'Q' + P(44, 62) + ' ' + P(38, 58) + 'Z', farge((hue + 30) % 360, 60, 40), 1.8);
        s += glass(mangekant([[36, 40], [36, 26], [42, 33], [50, 22], [58, 33], [64, 26], [64, 40]]), gull);
        s += sirkel(50, 34, 2, 'hsl(355 90% 50%)') + sirkel(42.5, 36, 1.5, 'hsl(210 90% 50%)') + sirkel(57.5, 36, 1.5, 'hsl(140 80% 40%)');
      } else if (hvem === 'dronning') {
        s += glass('M' + P(40, 38) + 'L' + P(58, 6) + 'L' + P(62, 10) + 'L' + P(60, 38) + 'Z', farge(hue, 55, 80));
        s += '<path d="M' + P(59, 8) + 'Q' + P(76, 30) + ' ' + P(70, 60) + '" fill="none" stroke="#f3eaff" stroke-width="3" opacity="0.7"/>';
        s += glass('M' + P(37, 44) + 'Q' + P(34, 60) + ' ' + P(40, 64) + 'L' + P(40, 48) + 'Z', farge((hue + 30) % 360, 55, 45), 1.6);
        s += glass('M' + P(63, 44) + 'Q' + P(66, 60) + ' ' + P(60, 64) + 'L' + P(60, 48) + 'Z', farge((hue + 30) % 360, 55, 45), 1.6);
        s += '<path d="M' + P(40, 68) + 'Q' + P(50, 75) + ' ' + P(60, 68) + '" fill="none" stroke="' + gull + '" stroke-width="2"/>' + sirkel(50, 72, 2, 'hsl(200 90% 55%)');
      } else if (hvem === 'narr') {
        var a = farge(hue, 55, 80), b = farge((hue + 180) % 360, 55, 80);
        s += glass('M' + P(37, 42) + 'Q' + P(26, 30) + ' ' + P(18, 34) + 'Q' + P(30, 22) + ' ' + P(44, 34) + 'Z', a, 2);
        s += glass('M' + P(63, 42) + 'Q' + P(74, 30) + ' ' + P(82, 34) + 'Q' + P(70, 22) + ' ' + P(56, 34) + 'Z', a, 2);
        s += glass('M' + P(40, 40) + 'Q' + P(44, 20) + ' ' + P(50, 10) + 'Q' + P(56, 20) + ' ' + P(60, 40) + 'Z', b, 2);
        s += sirkel(18, 34, 2.4, gull) + sirkel(82, 34, 2.4, gull) + sirkel(50, 10, 2.4, gull);
        var tagger = 'M' + P(33, 68);
        for (var k = 0; k < 6; k++) tagger += 'L' + P(35.7 + k * 5.7, k % 2 ? 68 : 75) + 'L' + P(38.5 + k * 5.7, 68);
        s += glass(tagger + 'Z', a, 1.6);
      } else {
        s += glass('M' + P(38, 58) + 'Q' + P(44, 86) + ' ' + P(50, 90) + 'Q' + P(56, 86) + ' ' + P(62, 58) + 'Q' + P(50, 64) + ' ' + P(38, 58) + 'Z', '#eef0f5', 1.8);
        s += glass('M' + P(28, 40) + 'Q' + P(50, 34) + ' ' + P(72, 40) + 'L' + P(60, 36) + 'L' + P(54, 9) + 'L' + P(40, 37) + 'Z', farge(hue, 45, 70));
        s += '<path d="' + mangekant(stjerneform(49, 26, 3, 1.3, 5, function () { return 0.5; })) + '" fill="' + gull + '"/>' + sirkel(54, 17, 1.2, gull);
        [-1, 1].forEach(function (sd) {
          s += '<path d="M' + P(50 + sd * 7.5, 44.5) + 'L' + P(50 + sd * 2.5, 45.5) + '" stroke="#eef0f5" stroke-width="2.2" stroke-linecap="round"/>';
        });
      }
    }
    s += oyne + munn;
    s += '<path d="' + bue + '" fill="url(#' + uid + 'l)"/>';
    s += '<path d="' + bue + '" fill="none" stroke="' + BLY + '" stroke-width="3.2"/>';
    return svg(s);
  }

  /* ---------- stjernebilder ---------- */

  /* Figurene er stjernebilder på en himmel: stjerner forbundet med tynne
     streker, og en svak tegning bak, som på et gammelt stjernekart. Øynene er
     de to klareste stjernene, og munnen er en liten bue av stjerner. */
  function tegnStjernebilde(rnd, hue, f, uid) {
    var s = '<defs><radialGradient id="' + uid + 'h" cx="0.5" cy="0.4" r="0.65"><stop offset="0" stop-color="' + farge(hue, 16, 60) +
      '"/><stop offset="1" stop-color="#05060f"/></radialGradient></defs>' +
      '<circle cx="50" cy="50" r="46" fill="url(#' + uid + 'h)" stroke="' + farge(hue, 50, 60) + '" stroke-width="1" opacity="0.95"/>';
    s += '<ellipse cx="50" cy="50" rx="44" ry="12" transform="rotate(-30 50 50)" fill="' + farge(hue, 70, 70) + '" opacity="0.08"/>';
    for (var i = 0; i < 24; i++) {
      var a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 42;
      s += '<circle cx="' + tall(50 + Math.cos(a) * r) + '" cy="' + tall(50 + Math.sin(a) * r) + '" r="' + tall(0.3 + rnd() * 0.5) +
        '" fill="#fff" opacity="' + tall(0.3 + rnd() * 0.5) + '"/>';
    }

    var type = velg(rnd, ['romvesen', 'bjorn', 'katt', 'fisk', 'fugl', 'blekk']);
    var rx = mellomtall(rnd, 18, 23), ry = mellomtall(rnd, 16, 20), cy = type === 'blekk' ? 42 : 48;
    var n = 7 + Math.floor(rnd() * 3), hode = [];
    for (i = 0; i < n; i++) {
      var v = i / n * Math.PI * 2 - Math.PI / 2, jr = 1 + (rnd() - 0.5) * 0.14;
      hode.push([50 + Math.cos(v) * rx * jr, cy + Math.sin(v) * ry * jr]);
    }
    var streker = [], stjerner = hode.slice(), lys = '#d6e8ff';
    for (i = 0; i < n; i++) streker.push([hode[i], hode[(i + 1) % n]]);
    var topp = hode[0];
    function ekstra(p) { stjerner.push(p); return p; }
    if (type === 'romvesen') {
      [-1, 1].forEach(function (sd) {
        var b = hode[sd === -1 ? n - 1 : 1];
        var ende = ekstra([b[0] + sd * 8, Math.max(9, b[1] - 16)]);
        streker.push([b, ende]);
      });
    } else if (type === 'bjorn' || type === 'katt') {
      [-1, 1].forEach(function (sd) {
        var b1 = hode[sd === -1 ? n - 1 : 1], b2 = hode[sd === -1 ? n - 2 : 2];
        var spiss = ekstra(type === 'katt' ? [b1[0] + sd * 6, b1[1] - 13] : [(b1[0] + b2[0]) / 2 + sd * 6, Math.min(b1[1], b2[1]) - 7]);
        streker.push([b1, spiss], [spiss, b2]);
      });
      if (type === 'katt') {
        [-1, 1].forEach(function (sd) {
          streker.push([[50 + sd * rx * 0.45, cy + ry * 0.35], ekstra([50 + sd * (rx + 8), cy + ry * 0.25])]);
        });
      }
    } else if (type === 'fisk') {
      var h1 = hode[Math.floor(n / 4)], h2 = hode[Math.floor(n / 4) + 1];
      var t1 = ekstra([Math.min(93, h1[0] + 16), h1[1] - 10]), t2 = ekstra([Math.min(93, h2[0] + 16), h2[1] + 10]);
      streker.push([h1, t1], [t1, t2], [t2, h2]);
    } else if (type === 'fugl') {
      [-1, 1].forEach(function (sd) {
        var b = [50 + sd * rx, cy];
        var m = ekstra([50 + sd * (rx + 12), cy - 14]), e = ekstra([50 + sd * (rx + 22), Math.max(10, cy - 6)]);
        streker.push([b, m], [m, e]);
      });
    } else {
      for (var k = 0; k < 5; k++) {
        var fx = 50 - rx * 0.7 + k * rx * 0.35, fy = cy + ry * 0.8;
        var p1 = ekstra([fx + (k % 2 ? 3 : -3), fy + 12]), p2 = ekstra([fx + (k % 2 ? -2 : 2), Math.min(92, fy + 24)]);
        streker.push([[fx, fy], p1], [p1, p2]);
      }
    }
    if (type !== 'blekk' && type !== 'fugl' && type !== 'fisk') {
      // en liten kropp under hodet
      var kb = ekstra([50 - rx * 0.6, Math.min(92, cy + ry + 18)]), kh = ekstra([50 + rx * 0.6, Math.min(92, cy + ry + 18)]);
      var bunn = hode[Math.floor(n / 2)];
      streker.push([bunn, kb], [bunn, kh], [kb, kh]);
    }

    // den svake tegningen bak, så formen synes mellom stjernene
    s += '<path d="' + glattBane(hode) + '" fill="' + farge(hue, 60, 70) + '" opacity="0.18" stroke="' + farge(hue, 75, 85) + '" stroke-width="1" stroke-opacity="0.5"/>';
    s += '<path d="' + streker.map(function (st) { return 'M' + P(st[0][0], st[0][1]) + 'L' + P(st[1][0], st[1][1]); }).join('') +
      '" stroke="' + lys + '" stroke-width="0.9" opacity="0.6"/>';
    stjerner.forEach(function (p, j) {
      var r2 = j % 3 === 0 ? 1.9 : 1.3;
      s += '<circle cx="' + tall(p[0]) + '" cy="' + tall(p[1]) + '" r="' + tall(r2 * 2.4) + '" fill="' + farge(hue, 80, 100) + '" opacity="0.28"/>' + sirkel(p[0], p[1], r2, '#fff');
    });
    if (topp) {
      s += '<path d="M' + P(topp[0], topp[1] - 5) + 'L' + P(topp[0], topp[1] + 5) + 'M' + P(topp[0] - 5, topp[1]) + 'L' + P(topp[0] + 5, topp[1]) +
        '" stroke="#fff" stroke-width="0.8" opacity="0.8"/>';
    }
    var ey = cy - ry * 0.1;
    [-1, 1].forEach(function (sd) {
      var x = 50 + sd * rx * 0.36;
      s += '<g class="oye"><circle cx="' + tall(x) + '" cy="' + tall(ey) + '" r="6" fill="' + farge(hue, 80, 100) + '" opacity="0.35"/>' +
        sirkel(x, ey, 2.7, '#fff') + '<path d="M' + P(x, ey - 5.5) + 'L' + P(x, ey + 5.5) + 'M' + P(x - 5.5, ey) + 'L' + P(x + 5.5, ey) +
        '" stroke="#fff" stroke-width="0.8"/></g>';
    });
    var my = cy + ry * 0.42;
    s += '<g class="munn"><path d="M' + P(44, my) + 'Q' + P(50, my + 5) + ' ' + P(56, my) + '" fill="none" stroke="' + lys + '" stroke-width="1" opacity="0.8"/>' +
      sirkel(44, my, 1.2, '#fff') + sirkel(50, my + 2.5, 1.4, '#fff') + sirkel(56, my, 1.2, '#fff') + '</g>';
    return svg(s);
  }

  /* ---------- frukt ---------- */

  /* Frukt med ansikt. Fargene er fruktens egne — et eple skal være rødt
     eller grønt, ikke lilla — så barna kjenner igjen hva det er. Skyggen og
     glansen klippes til fruktens form. */
  function tegnFrukt(rnd, hue, f, uid) {
    var frukt = velg(rnd, ['eple', 'banan', 'jordbaer', 'melon', 'appelsin', 'ananas', 'avokado', 'paere']);
    var kropp, fyll, kant, pynt = '', bak = '', inni = '', a;
    var gronn = 'hsl(110 60% 40%)', stilk = 'hsl(25 50% 30%)';
    function blad(x, y, vinkel, l) {
      return '<ellipse cx="' + tall(x) + '" cy="' + tall(y) + '" rx="' + tall(l) + '" ry="' + tall(l * 0.42) + '" transform="rotate(' + vinkel + ' ' +
        tall(x) + ' ' + tall(y) + ')" fill="' + gronn + '" stroke="hsl(110 60% 25%)" stroke-width="1.6"/>';
    }
    if (frukt === 'eple' || frukt === 'appelsin') {
      var farg = frukt === 'appelsin' ? 30 : velg(rnd, [355, 355, 95, 48]);
      fyll = 'hsl(' + farg + ' 85% 54%)'; kant = 'hsl(' + farg + ' 70% 30%)';
      kropp = frukt === 'eple'
        ? glattBane([[50, 34], [62, 28], [76, 36], [80, 56], [72, 78], [58, 88], [50, 85], [42, 88], [28, 78], [20, 56], [24, 36], [38, 28]])
        : ellD(50, 60, 29, 28);
      pynt = '<path d="M' + P(50, 34) + 'Q' + P(49, 24) + ' ' + P(53, 18) + '" fill="none" stroke="' + stilk + '" stroke-width="3" stroke-linecap="round"/>' + blad(59, 23, -25, 8);
      if (frukt === 'appelsin') {
        for (var k = 0; k < 14; k++) pynt += sirkel(mellomtall(rnd, 30, 70), mellomtall(rnd, 40, 80), 0.7, 'hsl(28 80% 42%)');
      }
      a = { x: 50, y: 60, b: 26 };
    } else if (frukt === 'banan') {
      fyll = 'hsl(50 95% 58%)'; kant = 'hsl(40 70% 32%)';
      kropp = 'M' + P(24, 26) + 'Q' + P(24, 82) + ' ' + P(76, 84) + 'Q' + P(86, 84) + ' ' + P(82, 75) + 'Q' + P(42, 68) + ' ' + P(36, 24) + 'Z';
      pynt = sirkel(30, 24, 3, stilk) + sirkel(82, 79, 2.2, stilk);
      a = { x: 44, y: 62, b: 18 };
    } else if (frukt === 'jordbaer') {
      fyll = 'hsl(352 85% 52%)'; kant = 'hsl(352 70% 30%)';
      kropp = 'M' + P(50, 90) + 'Q' + P(18, 62) + ' ' + P(24, 42) + 'Q' + P(30, 30) + ' ' + P(50, 32) + 'Q' + P(70, 30) + ' ' + P(76, 42) + 'Q' + P(82, 62) + ' ' + P(50, 90) + 'Z';
      for (k = 0; k < 16; k++) {
        var fx = mellomtall(rnd, 30, 70), fy = mellomtall(rnd, 40, 78);
        if (Math.abs(fx - 50) < 14 && fy > 44 && fy < 66) continue;          // ikke frø i ansiktet
        pynt += '<ellipse cx="' + tall(fx) + '" cy="' + tall(fy) + '" rx="0.8" ry="1.3" fill="hsl(50 95% 70%)"/>';
      }
      for (k = 0; k < 5; k++) pynt += blad(50 + (k - 2) * 5.5, 31 - Math.abs(k - 2) * -1.5, (k - 2) * 28, 7);
      a = { x: 50, y: 54, b: 22 };
    } else if (frukt === 'melon') {
      fyll = 'hsl(352 85% 60%)'; kant = 'hsl(130 60% 25%)';
      kropp = 'M' + P(12, 40) + 'L' + P(88, 40) + 'A38 38 0 0 1 ' + P(12, 40) + 'Z';
      pynt = '<path d="M' + P(14, 41) + 'A36 36 0 0 0 ' + P(86, 41) + '" fill="none" stroke="hsl(80 60% 88%)" stroke-width="4"/>' +
        '<path d="M' + P(12, 40) + 'A38 38 0 0 0 ' + P(88, 40) + '" fill="none" stroke="hsl(130 60% 35%)" stroke-width="4.5"/>';
      [[30, 50], [70, 50], [36, 64], [64, 64], [50, 72]].forEach(function (p) {
        pynt += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="1.3" ry="2.2" fill="#2a1a18"/>';
      });
      a = { x: 50, y: 52, b: 20 };
    } else if (frukt === 'ananas') {
      fyll = 'hsl(42 90% 55%)'; kant = 'hsl(32 70% 30%)';
      kropp = ellD(50, 64, 22, 26);
      for (k = 0; k < 7; k++) {
        bak += '<path d="' + mangekant([[44 + k * 2, 42], [30 + k * 6.7, Math.max(8, 14 + Math.abs(k - 3) * 5)], [48 + k * 2 - 2, 44]]) +
          '" fill="' + (k % 2 ? gronn : 'hsl(120 55% 32%)') + '" stroke="hsl(110 60% 22%)" stroke-width="1.4" stroke-linejoin="round"/>';
      }
      for (k = -3; k <= 3; k++) {
        inni += '<path d="M' + P(50 + k * 8 - 14, 40) + 'L' + P(50 + k * 8 + 14, 90) + 'M' + P(50 + k * 8 + 14, 40) + 'L' + P(50 + k * 8 - 14, 90) +
          '" stroke="' + kant + '" stroke-width="1" opacity="0.35"/>';
      }
      a = { x: 50, y: 66, b: 20 };
    } else if (frukt === 'avokado') {
      fyll = 'hsl(80 55% 68%)'; kant = 'hsl(100 55% 20%)';
      kropp = 'M' + P(50, 18) + 'Q' + P(64, 18) + ' ' + P(68, 42) + 'Q' + P(80, 64) + ' ' + P(72, 82) + 'Q' + P(50, 98) + ' ' + P(28, 82) +
        'Q' + P(20, 64) + ' ' + P(32, 42) + 'Q' + P(36, 18) + ' ' + P(50, 18) + 'Z';
      bak = '<path d="' + kropp + '" fill="hsl(100 55% 26%)" transform="translate(50 57) scale(1.1) translate(-50 -57)"/>';
      pynt = '<circle cx="50" cy="72" r="11" fill="hsl(25 55% 38%)" stroke="hsl(25 50% 22%)" stroke-width="1.6"/>' +
        '<ellipse cx="46" cy="68" rx="3" ry="2" fill="#fff" opacity="0.35"/>';
      a = { x: 50, y: 46, b: 18 };
    } else {
      fyll = velg(rnd, ['hsl(75 70% 55%)', 'hsl(55 85% 58%)']); kant = 'hsl(80 50% 28%)';
      kropp = glattBane([[50, 28], [58, 32], [62, 46], [74, 60], [74, 78], [62, 90], [38, 90], [26, 78], [26, 60], [38, 46], [42, 32]]);
      pynt = '<path d="M' + P(50, 30) + 'Q' + P(51, 22) + ' ' + P(54, 17) + '" fill="none" stroke="' + stilk + '" stroke-width="2.6" stroke-linecap="round"/>' + blad(59, 21, -20, 7);
      a = { x: 50, y: 66, b: 22 };
    }

    var s = '<defs><clipPath id="' + uid + 'k"><path d="' + kropp + '"/></clipPath></defs>' + bak +
      '<path d="' + kropp + '" fill="' + fyll + '" stroke="' + kant + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<g clip-path="url(#' + uid + 'k)">' + inni + '<ellipse cx="70" cy="74" rx="30" ry="26" fill="#000" opacity="0.13"/>' +
      '<ellipse cx="36" cy="40" rx="9" ry="5" fill="#fff" opacity="0.35" transform="rotate(-30 36 40)"/></g>' + pynt;

    // armer og bein på noen av dem
    if (rnd() > 0.5 && frukt !== 'melon') {
      var mork = '#3a2418';
      [-1, 1].forEach(function (sd) {
        s += '<path d="M' + P(a.x + sd * a.b * 1.05, a.y + a.b * 0.5) + 'Q' + P(a.x + sd * (a.b * 1.05 + 8), a.y + a.b * 0.5) + ' ' + P(a.x + sd * (a.b * 1.05 + 9), a.y + a.b * 0.2) +
          '" fill="none" stroke="' + mork + '" stroke-width="2.2" stroke-linecap="round"/>' + sirkel(a.x + sd * (a.b * 1.05 + 9), a.y + a.b * 0.2, 2.6, '#fff');
      });
    }

    var b = a.b, ey = a.y - b * 0.12;
    [-1, 1].forEach(function (sd) {
      var x = a.x + sd * b * 0.34;
      s += '<g class="oye"><ellipse cx="' + tall(x) + '" cy="' + tall(ey) + '" rx="' + tall(b * 0.09) + '" ry="' + tall(b * 0.13) + '" fill="#2a1a18"/>' +
        sirkel(x + b * 0.03, ey - b * 0.05, b * 0.035, '#fff') + '</g>';
      s += '<ellipse cx="' + tall(a.x + sd * b * 0.58) + '" cy="' + tall(a.y + b * 0.12) + '" rx="' + tall(b * 0.12) + '" ry="' + tall(b * 0.07) +
        '" fill="hsl(345 95% 70%)" opacity="0.6"/>';
    });
    var my = a.y + b * 0.22, munnStil = velg(rnd, ['smil', 'o', 'tunge']);
    s += '<g class="munn">';
    if (munnStil === 'o') {
      s += '<ellipse cx="' + tall(a.x) + '" cy="' + tall(my + 1) + '" rx="' + tall(b * 0.08) + '" ry="' + tall(b * 0.1) + '" fill="#5a1a22"/>';
    } else {
      s += '<path d="M' + P(a.x - b * 0.18, my - 0.5) + 'Q' + P(a.x, my + b * 0.3) + ' ' + P(a.x + b * 0.18, my - 0.5) + 'Z" fill="#5a1a22"/>';
      if (munnStil === 'tunge') s += '<ellipse cx="' + tall(a.x) + '" cy="' + tall(my + b * 0.13) + '" rx="' + tall(b * 0.08) + '" ry="' + tall(b * 0.05) + '" fill="#ff7aa0"/>';
    }
    return svg(s + '</g>');
  }

  /* ---------- akvarell ---------- */

  /* Småkryp malt med vannfarger på papir: hver flate males to-tre ganger
     litt forskjøvet og halvgjennomsiktig, så kantene blir mørkere der
     lagene overlapper — slik vannfarge tørker. Oppå kommer en tynn
     blekkstrek som ikke helt treffer fargen, som i en skisse. */
  function tegnAkvarell(rnd, hue) {
    var BLEKK = '#3b2f2a';
    function klatt(cx, cy, rx, ry, n) {
      var p = [];
      for (var i = 0; i < (n || 9); i++) {
        var a = i / (n || 9) * Math.PI * 2, j = 1 + (rnd() - 0.5) * 0.12;
        p.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
      }
      return glattBane(p);
    }
    function vask(d, farg, lag) {
      var t = '';
      for (var i = 0; i < (lag || 3); i++) {
        t += '<path d="' + d + '" fill="' + farg + '" opacity="0.42" transform="translate(' + tall((rnd() - 0.5) * 2.2) + ' ' + tall((rnd() - 0.5) * 2.2) + ')"/>';
      }
      return t + '<path d="' + d + '" fill="none" stroke="' + BLEKK + '" stroke-width="1.1" transform="translate(0.7 0.5)"/>';
    }
    function blekk(d, b) {
      return '<path d="' + d + '" fill="none" stroke="' + BLEKK + '" stroke-width="' + (b || 1.2) + '" stroke-linecap="round"/>';
    }
    function blekkOye(x, y, r) {
      return '<g class="oye">' + sirkel(x, y, r, '#fff') + '<circle cx="' + tall(x) + '" cy="' + tall(y) + '" r="' + tall(r) + '" fill="none" stroke="' + BLEKK +
        '" stroke-width="0.9"/>' + sirkel(x + r * 0.15, y + r * 0.1, r * 0.55, BLEKK) + sirkel(x - r * 0.1, y - r * 0.2, r * 0.18, '#fff') + '</g>';
    }
    var s = '<rect x="6" y="6" width="88" height="88" rx="10" fill="#f5efe2" stroke="#d8cdb6" stroke-width="1"/>';
    for (var i = 0; i < 18; i++) s += sirkel(mellomtall(rnd, 10, 90), mellomtall(rnd, 10, 90), 0.4 + rnd() * 0.5, '#e2d6bf');
    var farg = farge(hue, 55, 70), farg2 = farge((hue + 40) % 360, 60, 70);
    var kryp = velg(rnd, ['marihone', 'bie', 'snegle', 'sommerfugl', 'larve', 'frosk']);
    var m = '', oy = '';

    if (kryp === 'marihone') {
      [-1, 1].forEach(function (sd) {
        for (var k = 0; k < 3; k++) s += blekk('M' + P(50 + sd * 18, 56 + k * 9) + 'L' + P(50 + sd * 29, 60 + k * 10));
        s += blekk('M' + P(50 + sd * 5, 30) + 'Q' + P(50 + sd * 9, 20) + ' ' + P(50 + sd * 15, 18)) + sirkel(50 + sd * 15, 18, 1.8, BLEKK);
      });
      s += vask(klatt(50, 64, 26, 23), 'hsl(355 85% 52%)');
      s += blekk('M' + P(50, 44) + 'L' + P(50, 86));
      [[38, 56], [62, 56], [36, 72], [64, 72], [46, 80], [56, 64]].forEach(function (p) { s += vask(klatt(p[0], p[1], 3.6, 3.4, 7), '#222', 2); });
      s += vask(klatt(50, 38, 15, 10), '#2b2430');
      oy = blekkOye(45, 37, 3.4) + blekkOye(55, 37, 3.4);
      m = '<path d="M' + P(46.5, 42) + 'Q' + P(50, 45.5) + ' ' + P(53.5, 42) + 'Z" fill="hsl(350 80% 65%)"/>';
    } else if (kryp === 'bie') {
      [-1, 1].forEach(function (sd) { s += vask(klatt(50 + sd * 17, 42, 13, 9), 'hsl(200 70% 85%)', 2); });
      s += vask(klatt(50, 66, 22, 19), 'hsl(46 95% 58%)');
      [60, 70].forEach(function (y) { s += '<path d="M' + P(30, y) + 'Q' + P(50, y + 4) + ' ' + P(70, y) + '" fill="none" stroke="#2b2430" stroke-width="5" opacity="0.8"/>'; });
      s += blekk('M' + P(50, 85) + 'L' + P(50, 91), 1.6);
      [-1, 1].forEach(function (sd) {
        s += blekk('M' + P(50 + sd * 5, 30) + 'Q' + P(50 + sd * 8, 20) + ' ' + P(50 + sd * 13, 17)) + sirkel(50 + sd * 13, 17, 1.6, BLEKK);
      });
      s += vask(klatt(50, 38, 13, 12), 'hsl(46 95% 62%)');
      oy = blekkOye(45, 37, 3.6) + blekkOye(55, 37, 3.6);
      m = '<path d="M' + P(46, 42.5) + 'Q' + P(50, 47) + ' ' + P(54, 42.5) + 'Z" fill="hsl(350 70% 45%)"/>';
    } else if (kryp === 'snegle') {
      s += vask('M' + P(14, 82) + 'Q' + P(16, 64) + ' ' + P(28, 64) + 'Q' + P(40, 66) + ' ' + P(48, 74) + 'L' + P(84, 76) + 'Q' + P(90, 80) + ' ' + P(84, 84) + 'Z', farg2);
      [[21, 46], [30, 44]].forEach(function (p) { s += blekk('M' + P(p[0] + 1, 64) + 'L' + P(p[0], p[1] + 3), 1.4); oy += blekkOye(p[0], p[1], 3.2); });
      s += vask(klatt(60, 54, 21, 20), farg);
      var sp = 'M' + P(60, 54), v = 0, r = 1;
      for (i = 0; i < 26; i++) { v += 0.5; r += 0.65; sp += 'L' + P(60 + Math.cos(v) * r, 54 + Math.sin(v) * r); }
      s += blekk(sp, 1.1);
      m = '<path d="M' + P(17, 72) + 'Q' + P(21, 75) + ' ' + P(25, 72) + 'Z" fill="hsl(350 70% 45%)"/>';
    } else if (kryp === 'sommerfugl') {
      [-1, 1].forEach(function (sd) {
        s += vask(klatt(50 + sd * 20, 40, 17, 16), farg);
        s += vask(klatt(50 + sd * 15, 68, 11, 12), farg2);
        s += vask(klatt(50 + sd * 22, 38, 5, 5, 7), 'hsl(' + ((hue + 180) % 360) + ' 70% 60%)', 2);
        s += blekk('M' + P(50 + sd * 3, 36) + 'Q' + P(50 + sd * 6, 22) + ' ' + P(50 + sd * 12, 16));
      });
      s += vask(klatt(50, 64, 4, 18), '#4a3a44');
      s += vask(klatt(50, 42, 9, 9), '#4a3a44');
      oy = blekkOye(46.5, 41, 2.6) + blekkOye(53.5, 41, 2.6);
      m = '<path d="M' + P(47.5, 46) + 'Q' + P(50, 48.5) + ' ' + P(52.5, 46) + 'Z" fill="hsl(350 80% 70%)"/>';
    } else if (kryp === 'larve') {
      var ledd = [[20, 76, 9], [32, 72, 10], [45, 72, 10.5], [58, 70, 11]];
      ledd.forEach(function (l, k) {
        s += blekk('M' + P(l[0] - 3, l[1] + l[2] - 1) + 'L' + P(l[0] - 4, l[1] + l[2] + 4)) + blekk('M' + P(l[0] + 3, l[1] + l[2] - 1) + 'L' + P(l[0] + 4, l[1] + l[2] + 4));
        s += vask(klatt(l[0], l[1], l[2], l[2]), k % 2 ? farg : farg2, 2);
      });
      [-1, 1].forEach(function (sd) {
        s += blekk('M' + P(70 + sd * 5, 36) + 'Q' + P(70 + sd * 8, 24) + ' ' + P(70 + sd * 12, 22)) + sirkel(70 + sd * 12, 22, 1.8, farge((hue + 180) % 360, 60, 55));
      });
      s += vask(klatt(70, 50, 16, 15), farg);
      oy = blekkOye(64, 47, 3.8) + blekkOye(76, 47, 3.8);
      m = '<path d="M' + P(65, 55) + 'Q' + P(70, 60) + ' ' + P(75, 55) + 'Z" fill="hsl(350 70% 45%)"/>';
    } else {
      [-1, 1].forEach(function (sd) {
        s += vask(klatt(50 + sd * 24, 82, 9, 5), farge(hue, 45, 60), 2);
      });
      s += vask(klatt(50, 64, 30, 21), farge(hue, 50, 60));
      s += vask(klatt(50, 70, 17, 11), farge(hue, 80, 50), 2);
      [-1, 1].forEach(function (sd) { s += vask(klatt(50 + sd * 13, 44, 9, 9), farge(hue, 50, 60), 2); });
      oy = blekkOye(37, 43, 5.5) + blekkOye(63, 43, 5.5);
      [-1, 1].forEach(function (sd) { s += '<ellipse cx="' + (50 + sd * 18) + '" cy="60" rx="4" ry="2.4" fill="hsl(350 90% 70%)" opacity="0.5"/>'; });
      m = '<path d="M' + P(36, 58) + 'Q' + P(50, 67) + ' ' + P(64, 58) + 'Q' + P(50, 62) + ' ' + P(36, 58) + 'Z" fill="hsl(350 60% 40%)"/>';
    }
    return svg(s + oy + '<g class="munn">' + m + '</g>');
  }

  /* ---------- regnbue ---------- */

  /* Eventyrvesener i pastell: enhjørninger med regnbuemanke, feer,
     skyer med regnbue under, stjerner og kaniner — med glitter rundt.
     Myke konturer i en mørkere pastell, ikke svart strek. */
  var REGNBUE = ['hsl(355 90% 72%)', 'hsl(30 95% 70%)', 'hsl(52 95% 68%)', 'hsl(130 60% 70%)', 'hsl(200 80% 72%)', 'hsl(270 70% 78%)'];

  function glimt(x, y, r, farg) {
    return '<path d="M' + P(x, y - r) + 'Q' + P(x, y) + ' ' + P(x + r, y) + 'Q' + P(x, y) + ' ' + P(x, y + r) + 'Q' + P(x, y) + ' ' +
      P(x - r, y) + 'Q' + P(x, y) + ' ' + P(x, y - r) + 'Z" fill="' + farg + '"/>';
  }

  function tegnRegnbue(rnd, hue, f, uid) {
    var pastell = farge(hue, 90, 70), kant = farge(hue, 60, 45), rosa = 'hsl(340 90% 85%)';
    function form(d, fyll, b) {
      return '<path d="' + d + '" fill="' + fyll + '" stroke="' + kant + '" stroke-width="' + (b || 1.8) + '" stroke-linejoin="round"/>';
    }
    var s = '<defs><radialGradient id="' + uid + 'r" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="' + farge(hue, 85, 80) +
      '" stop-opacity="0.5"/><stop offset="1" stop-color="' + farge(hue, 85, 80) + '" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="50" cy="52" r="46" fill="url(#' + uid + 'r)"/>';
    var hvem = velg(rnd, ['enhjorning', 'enhjorning', 'fe', 'sky', 'stjerne', 'kanin']);
    var oyeY = 50, oyeX = 7, oyeR = 4.2, munnY = 60, kinnY = 57;

    if (hvem === 'sky' || rnd() > 0.6) {
      // regnbuen bak
      REGNBUE.forEach(function (c, i) {
        var r = 40 - i * 3.2;
        s += '<path d="M' + P(50 - r, 78) + 'A' + tall(r) + ' ' + tall(r) + ' 0 0 1 ' + P(50 + r, 78) + '" fill="none" stroke="' + c + '" stroke-width="3.3"/>';
      });
    }

    if (hvem === 'enhjorning') {
      var manke = rnd() > 0.5 ? 1 : -1;
      s += form(ellD(50, 82, 17, 10), pastell);
      [-1, 1].forEach(function (sd) { s += form(ellD(50 + sd * 9, 90, 4.5, 3.2), farge(hue, 75, 70)); });
      REGNBUE.forEach(function (c, i) {
        s += '<ellipse cx="' + tall(50 + manke * (17 + i * 1.2)) + '" cy="' + tall(30 + i * 7.5) + '" rx="7" ry="6" fill="' + c + '" stroke="' + kant + '" stroke-width="1.2"/>';
      });
      [-1, 1].forEach(function (sd) {
        s += form(mangekant([[50 + sd * 9, 34], [50 + sd * 17, 18], [50 + sd * 18, 36]]), pastell);
        s += '<path d="' + mangekant([[50 + sd * 11, 32], [50 + sd * 16, 22], [50 + sd * 16.5, 33]]) + '" fill="' + rosa + '"/>';
      });
      s += form('M' + P(45, 30) + 'L' + P(50, 5) + 'L' + P(55, 30) + 'Z', 'hsl(45 95% 70%)', 1.6);
      for (var k = 1; k <= 3; k++) s += '<path d="M' + P(46 + k * 0.6, 29 - k * 6) + 'L' + P(54 - k * 0.6, 26 - k * 6) + '" stroke="hsl(40 80% 50%)" stroke-width="1"/>';
      s += form(ellD(50, 46, 20, 17), pastell);
      REGNBUE.slice(0, 3).forEach(function (c, i) {
        s += '<ellipse cx="' + tall(50 + manke * (4 - i * 4)) + '" cy="' + tall(30 + i * 1.5) + '" rx="6" ry="5" fill="' + c + '" stroke="' + kant + '" stroke-width="1.2"/>';
      });
      s += form(ellD(50, 56, 11, 7.5), rosa, 1.4);
      s += sirkel(46.5, 55, 1, kant) + sirkel(53.5, 55, 1, kant);
      oyeY = 45; oyeX = 8; munnY = 60; kinnY = 51;
    } else if (hvem === 'fe') {
      [-1, 1].forEach(function (sd) {
        s += '<ellipse cx="' + (50 + sd * 17) + '" cy="44" rx="14" ry="10" transform="rotate(' + (sd * -25) + ' ' + (50 + sd * 17) + ' 44)" fill="' + farge((hue + 60) % 360, 90, 85) + '" opacity="0.7" stroke="#fff" stroke-width="1.2"/>';
        s += '<ellipse cx="' + (50 + sd * 14) + '" cy="62" rx="9" ry="7" transform="rotate(' + (sd * 25) + ' ' + (50 + sd * 14) + ' 62)" fill="' + farge((hue + 60) % 360, 90, 85) + '" opacity="0.7" stroke="#fff" stroke-width="1.2"/>';
      });
      s += form('M' + P(50, 58) + 'L' + P(66, 90) + 'Q' + P(50, 94) + ' ' + P(34, 90) + 'Z', pastell);
      s += '<path d="M' + P(64, 64) + 'L' + P(76, 44) + '" stroke="hsl(45 80% 45%)" stroke-width="1.6"/>' + glimt(77, 42, 5.5, 'hsl(48 100% 65%)');
      s += form(ellD(50, 42, 14, 14.5), 'hsl(25 85% 88%)');
      s += form('M' + P(36, 44) + 'Q' + P(34, 24) + ' ' + P(50, 26) + 'Q' + P(66, 24) + ' ' + P(64, 44) + 'Q' + P(58, 32) + ' ' + P(50, 33) + 'Q' + P(42, 32) + ' ' + P(36, 44) + 'Z', farge(hue, 65, 60));
      oyeY = 43; oyeX = 5.5; oyeR = 3.4; munnY = 50; kinnY = 48;
    } else if (hvem === 'sky') {
      var sky = [[36, 58, 13], [50, 50, 16], [64, 58, 13], [50, 62, 14], [28, 64, 9], [72, 64, 9]];
      sky.forEach(function (b) { s += '<circle cx="' + b[0] + '" cy="' + b[1] + '" r="' + (b[2] + 1.8) + '" fill="' + kant + '"/>'; });
      sky.forEach(function (b) { s += sirkel(b[0], b[1], b[2], farge(hue, 96, 60)); });
      [36, 50, 64].forEach(function (x, i) { s += '<path d="M' + P(x, 80 + i % 2 * 3) + 'q-2 4 0 6q2 -2 0 -6Z" fill="hsl(200 80% 72%)"/>'; });
      oyeY = 55; munnY = 64; kinnY = 61;
    } else if (hvem === 'stjerne') {
      s += form(hjorneBane(stjerneform(50, 54, 38, 18, 5, function () { return 0.5; }), 0.22), 'hsl(48 100% 75%)', 2);
      oyeY = 52; munnY = 61; kinnY = 58;
    } else {
      [-1, 1].forEach(function (sd) {
        s += form(ellD(50 + sd * 8, 22, 5.5, 15), pastell);
        s += '<ellipse cx="' + (50 + sd * 8) + '" cy="23" rx="2.6" ry="10" fill="' + rosa + '"/>';
      });
      s += form(ellD(50, 78, 16, 13), pastell);
      s += form(ellD(50, 50, 19, 17), pastell);
      s += glimt(50, 38, 4, 'hsl(48 100% 65%)');
      s += '<path d="M' + P(48, 55) + 'L' + P(52, 55) + 'L' + P(50, 57.5) + 'Z" fill="hsl(340 80% 65%)"/>';
      oyeY = 49; munnY = 60; kinnY = 56;
    }

    // glitter rundt
    for (var g = 0; g < 6; g++) {
      var ga = rnd() * Math.PI * 2, gr = mellomtall(rnd, 36, 43);
      s += glimt(50 + Math.cos(ga) * gr, 52 + Math.sin(ga) * gr, 2 + rnd() * 2.5, rnd() > 0.5 ? '#fff' : 'hsl(48 100% 70%)');
    }
    // store glitrende øyne med vipper
    [-1, 1].forEach(function (sd) {
      var x = 50 + sd * oyeX;
      s += '<g class="oye"><ellipse cx="' + tall(x) + '" cy="' + tall(oyeY) + '" rx="' + tall(oyeR * 0.82) + '" ry="' + tall(oyeR) + '" fill="#3a2050"/>' +
        sirkel(x + oyeR * 0.25, oyeY - oyeR * 0.35, oyeR * 0.35, '#fff') + sirkel(x - oyeR * 0.3, oyeY + oyeR * 0.4, oyeR * 0.15, '#fff') +
        '<path d="M' + P(x + sd * oyeR * 0.6, oyeY - oyeR * 0.7) + 'l' + P(sd * 2.2, -1.8) + 'M' + P(x + sd * oyeR * 0.85, oyeY - oyeR * 0.2) + 'l' + P(sd * 2.4, -0.6) +
        '" stroke="#3a2050" stroke-width="1" stroke-linecap="round"/></g>';
      s += '<ellipse cx="' + tall(50 + sd * (oyeX + 5)) + '" cy="' + tall(kinnY) + '" rx="3" ry="1.8" fill="hsl(340 95% 75%)" opacity="0.7"/>';
    });
    s += '<g class="munn"><path d="M' + P(47, munnY - 0.5) + 'Q' + P(50, munnY + 4) + ' ' + P(53, munnY - 0.5) + 'Z" fill="hsl(340 60% 45%)"/></g>';
    return svg(s);
  }

  var STILER = {
    drage: tegnDrage, pirat: tegnPirat, metall: tegnMetall,
    godteri: tegnGodteri, dino: tegnDino, origami: tegnOrigami,
    tegneserie: tegnTegneserie, glassmaleri: tegnGlassmaleri, stjernebilde: tegnStjernebilde,
    frukt: tegnFrukt, akvarell: tegnAkvarell, regnbue: tegnRegnbue
  };

  /* ---------- selve monsteret ---------- */

  function tegn(noekkel, hue, opsjoner) {
    var o = opsjoner || {};
    var rnd = terning(fro(noekkel));
    var T = o.tema ? TEMA[o.tema] : null;

    /* To farger, ikke én. Kroppsfargen er monsterets identitet og må matche
       kortet, men en kontrastfarge på horn, hender og mønster er det som
       løfter figuren fra «silhuett» til «figur». */
    var aksentHue = (hue + mellomtall(rnd, 60, 300)) % 360;
    var f = {
      strek: farge(hue, mellomtall(rnd, 62, 72)),
      aksent: farge(aksentHue, mellomtall(rnd, 60, 70)),
      fyll: farge(hue, mellomtall(rnd, 14, 20), mellomtall(rnd, 55, 75))
    };

    if (o.tema === 'pixel') return tegnPixel(rnd, hue, f);
    if (STILER[o.tema]) return STILER[o.tema](rnd, hue, f, 'm' + fro(noekkel).toString(36));

    var k = (T ? velg(rnd, T.former) : FORMER[Math.floor(rnd() * FORMER.length)])(rnd, f);
    var a = k.ansikt;
    var hoyde = a.bunn - a.topp;
    var hodeX = k.hodeX || 50;
    var lag = [];

    /* Lagrekkefølgen er det som gjør at delene ser festet ut. Alt som skal
       stikke ut av kroppen tegnes FØR den, så silhuetten dekker overgangen. */

    // 1. bein og armer bakerst
    if (!k.ingenLemmer) {
      if (k.beinPlass && rnd() > 0.45) lag.push(T && T.bein === 'hjul' ? hjul(rnd, k, f) : bein(rnd, k, f));
      else if (!k.beinPlass && rnd() > 0.7) lag.push(mangeBein(rnd, k, f));
      if (rnd() > 0.45) lag.push(armer(rnd, k, f, T && T.hender));
    }

    // 2. pynt som stikker opp bak hodet
    var pynt = velg(rnd, T ? T.pynt : ['ingen', 'ingen', 'antenner', 'horn', 'orer', 'enhjorning', 'hanekam']);
    if (BAK[pynt]) lag.push(hodepynt(rnd, k, f, pynt));

    // 3. kroppen
    lag.push(k.deler.join(''));

    // 4. mønster oppå kroppen
    lag.push(moenster(rnd, k, f, velg(rnd, T ? T.moenster : ['ingen', 'ingen', 'flekker', 'striper', 'mage'])));

    // 5. pynt som skal ligge foran
    if (pynt !== 'ingen' && !BAK[pynt]) {
      lag.push(hodepynt(rnd, k, f, pynt));
    }

    // 6. øyne — enten i ansiktet eller på stilker over kroppen.
    //    Stilker krever at det faktisk er plass over figuren.
    var paaStilk = !k.smal && !k.maskin && k.topp > 24 && rnd() > 0.78;
    var oyeY = a.topp + hoyde * mellomtall(rnd, 0.26, 0.38);
    var munnY = a.topp + hoyde * mellomtall(rnd, 0.6, 0.74);

    if (paaStilk) {
      lag.push(stilkoyne(rnd, k, f, 1 + Math.floor(rnd() * 2)));
      munnY = a.topp + hoyde * mellomtall(rnd, 0.38, 0.55);
    } else {
      var antall = velg(rnd, [1, 1, 2, 2, 2, 2, 3, 3, 4]);
      var stil = velg(rnd, T ? T.oyne : ['vanlig', 'vanlig', 'vanlig', 'lokk', 'ring', 'glad', 'kryss']);
      /* Kryss-øyne er en vits som bare virker på ett eller to. På fire på rad
         leser «XXXX» som tekst, ikke som et ansikt. */
      if (antall > 2 && (stil === 'kryss' || stil === 'glad')) stil = 'vanlig';
      if (stil === 'skjerm' && antall > 2) antall = 2;
    }

    if (stil === 'visir') {
      lag.push(visir(hodeX, oyeY, a.halvbred, f, rnd() - 0.5));
      munnY = Math.max(munnY, oyeY + 13);
    } else if (!paaStilk) {
      /* Fire øyne settes i kvadrat, ikke på rekke. En rekke på fire blir en
         knapperad; to og to over hverandre blir et insekt. */
      var kvadrat = antall === 4;
      var maksR = a.halvbred / (antall === 1 ? 1.9 : (kvadrat ? 2.9 : antall * 1.35));
      var r = Math.min(maksR, antall === 1 ? 13 : 10);
      var ulik = !kvadrat && rnd() > 0.72;     // asymmetri er det som gir karakter
      var harBryn = stil !== 'glad' && stil !== 'kryss' && rnd() > 0.45;
      var helning = (rnd() - 0.5) * 6;
      var blikk = rnd() > 0.25 ? (rnd() - 0.5) * 1.6 : null;   // null = skjeløyd

      var steder = [];
      if (kvadrat) {
        [-1, 1].forEach(function (ry) {
          [-1, 1].forEach(function (rx) {
            steder.push([hodeX + rx * r * 1.3, oyeY + ry * r * 1.15, r]);
          });
        });
      } else {
        for (var i = 0; i < antall; i++) {
          var ox = antall === 1 ? hodeX : hodeX + (i - (antall - 1) / 2) * (r * 2.45);
          var oy = (antall === 3 && i === 1) ? oyeY - r * 0.7 : oyeY;
          steder.push([ox, oy, ulik && i === 0 ? r * 0.68 : r]);
        }
      }
      steder.forEach(function (p, i) {
        lag.push(oye(p[0], p[1], p[2], stil, f, rnd, blikk));
        if (harBryn && (!kvadrat || i < 2)) {
          // brynet holdes under taket; på høye figurer ble det ellers klippet bort
          var brynY = Math.max(p[1] - p[2] * 1.55, 3 + Math.abs(helning));
          lag.push(bryn(p[0], brynY, p[2], i === 0 ? helning : -helning, f));
        }
      });
      if (kvadrat) munnY = Math.max(munnY, oyeY + r * 2.6);
    }

    // 7. munnen til slutt, øverst i stabelen
    var munnB = Math.min(a.halvbred * mellomtall(rnd, 0.42, 0.62), 19);
    // holder munnen innenfor ansiktet uansett hva øynene har dyttet den til
    munnY = Math.min(munnY, a.bunn - munnB * 0.6 - 3);
    lag.push(munn(hodeX, munnY, munnB,
      velg(rnd, T ? T.munn : ['oval', 'tenner', 'tenner', 'hoggtenner', 'tunge', 'sikksakk', 'liten', 'nebb']),
      f, rnd));

    if (o.merke) {
      lag.push('<text x="50" y="96" text-anchor="middle" font-size="14">' + o.merke + '</text>');
    }

    return '<svg class="mstr" viewBox="0 0 100 100" aria-hidden="true">' + lag.join('') + '</svg>';
  }

  /* Hver nye stemme får en farge langt unna de forrige. Gyldne snitt rundt
     fargesirkelen sprer dem jevnt uten at vi må holde regnskap. */
  function nyHue(nr) {
    return Math.round((nr * 137.508 + 20) % 360);
  }

  /* Alle stilene et monster kan tegnes i: null er den opprinnelige
     neonstilen, resten er verdenene. Brukes til å teste at alle stilene tegner riktig. */
  var ALLE_STILER = [null, 'pixel'].concat(Object.keys(TEMA), Object.keys(STILER));

  return { tegn: tegn, nyHue: nyHue, STILER: ALLE_STILER };
})();
