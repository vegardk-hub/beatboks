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
    }
    return s;
  }

  /* ---------- lemmer ---------- */

  /* Armene tegnes BAK kroppen. Da skjuler silhuetten festet automatisk, og
     bare den delen som stikker ut synes. Tegnet foran ble de til en strek
     tvers over ansiktet på alle former som er smalere nederst enn på midten. */
  function armer(rnd, k, f) {
    var s = '', y = k.topp + (k.bunn - k.topp) * mellomtall(rnd, 0.5, 0.7);
    var opp = rnd() > 0.5;
    [-1, 1].forEach(function (side) {
      var fx = 50 + side * k.halvbred * 0.75;
      var lengde = mellomtall(rnd, 11, 19);
      // hånden holdes innenfor tegneflaten, ellers klippes den av på brede kropper
      var tx = Math.max(6, Math.min(94, fx + side * lengde));
      var ty = y + (opp ? -lengde * 0.7 : lengde * 0.45);
      s += strek('M' + P(fx, y) + 'Q' + P(fx + side * lengde * 0.7, y) + ' ' + P(tx, ty), f.strek, 3);
      s += sirkel(tx, ty, 3.6, f.aksent);
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
    }
    return s;
  }

  /* ---------- selve monsteret ---------- */

  function tegn(noekkel, hue, opsjoner) {
    var o = opsjoner || {};
    var rnd = terning(fro(noekkel));

    /* To farger, ikke én. Kroppsfargen er monsterets identitet og må matche
       kortet, men en kontrastfarge på horn, hender og mønster er det som
       løfter figuren fra «silhuett» til «figur». */
    var aksentHue = (hue + mellomtall(rnd, 60, 300)) % 360;
    var f = {
      strek: farge(hue, mellomtall(rnd, 62, 72)),
      aksent: farge(aksentHue, mellomtall(rnd, 60, 70)),
      fyll: farge(hue, mellomtall(rnd, 14, 20), mellomtall(rnd, 55, 75))
    };

    var k = FORMER[Math.floor(rnd() * FORMER.length)](rnd, f);
    var a = k.ansikt;
    var hoyde = a.bunn - a.topp;
    var hodeX = k.hodeX || 50;
    var lag = [];

    /* Lagrekkefølgen er det som gjør at delene ser festet ut. Alt som skal
       stikke ut av kroppen tegnes FØR den, så silhuetten dekker overgangen. */

    // 1. bein og armer bakerst
    if (k.beinPlass && rnd() > 0.45) lag.push(bein(rnd, k, f));
    else if (!k.beinPlass && rnd() > 0.7) lag.push(mangeBein(rnd, k, f));
    if (rnd() > 0.45) lag.push(armer(rnd, k, f));

    // 2. pynt som stikker opp bak hodet
    var pynt = velg(rnd, ['ingen', 'ingen', 'antenner', 'horn', 'orer', 'enhjorning', 'hanekam']);
    if (pynt === 'orer' || pynt === 'horn') lag.push(hodepynt(rnd, k, f, pynt));

    // 3. kroppen
    lag.push(k.deler.join(''));

    // 4. mønster oppå kroppen
    lag.push(moenster(rnd, k, f, velg(rnd, ['ingen', 'ingen', 'flekker', 'striper', 'mage'])));

    // 5. pynt som skal ligge foran
    if (pynt === 'antenner' || pynt === 'enhjorning' || pynt === 'hanekam') {
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
      var stil = velg(rnd, ['vanlig', 'vanlig', 'vanlig', 'lokk', 'ring', 'glad', 'kryss']);
      /* Kryss-øyne er en vits som bare virker på ett eller to. På fire på rad
         leser «XXXX» som tekst, ikke som et ansikt. */
      if (antall > 2 && (stil === 'kryss' || stil === 'glad')) stil = 'vanlig';

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
          lag.push(bryn(p[0], p[1] - p[2] * 1.55, p[2], i === 0 ? helning : -helning, f));
        }
      });
      if (kvadrat) munnY = Math.max(munnY, oyeY + r * 2.6);
    }

    // 7. munnen til slutt, øverst i stabelen
    var munnB = Math.min(a.halvbred * mellomtall(rnd, 0.42, 0.62), 19);
    // holder munnen innenfor ansiktet uansett hva øynene har dyttet den til
    munnY = Math.min(munnY, a.bunn - munnB * 0.6 - 3);
    lag.push(munn(hodeX, munnY, munnB,
      velg(rnd, ['oval', 'tenner', 'tenner', 'hoggtenner', 'tunge', 'sikksakk', 'liten', 'nebb']),
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

  return { tegn: tegn, nyHue: nyHue };
})();
