/* Alt som beveger seg.

   Én eneste rAF-løkke driver hele appen. Flere løkker som tegner hver sin del
   blir fort til rykkete bilde på et nettbrett, fordi de kjemper om den samme
   rammen. Den som vil ha noe animert melder seg på her. */
var Visuell = (function () {
  'use strict';

  var lyttere = [];
  var gaar = false, forrigeTid = 0;

  function leggTil(fn) {
    if (lyttere.indexOf(fn) < 0) lyttere.push(fn);
    if (!gaar) { gaar = true; forrigeTid = performance.now(); requestAnimationFrame(ramme); }
  }

  function fjern(fn) {
    var i = lyttere.indexOf(fn);
    if (i >= 0) lyttere.splice(i, 1);
  }

  function ramme(naa) {
    var dt = Math.min((naa - forrigeTid) / 1000, 0.05);
    forrigeTid = naa;
    for (var i = 0; i < lyttere.length; i++) {
      try { lyttere[i](dt, naa); } catch (e) {}
    }
    requestAnimationFrame(ramme);
  }

  /* ---------- nivåmåling ---------- */

  var tidsbuffer = {};
  function niva(analyse) {
    if (!analyse) return 0;
    var n = analyse.fftSize;
    if (!tidsbuffer[n]) tidsbuffer[n] = new Uint8Array(n);
    var d = tidsbuffer[n];
    analyse.getByteTimeDomainData(d);
    var sum = 0;
    for (var i = 0; i < n; i++) {
      var x = (d[i] - 128) / 128;
      sum += x * x;
    }
    return Math.min(1, Math.sqrt(sum / n) * 2.4);
  }

  /* ---------- takten ---------- */

  /* Motoren planlegger lyd fram i tid, så køen må tømmes av nøyaktig én
     leser — ellers stjeler bakgrunnen stegene fra steglysene, eller omvendt.
     Denne lytteren meldes på først og er den eneste som rører køen. */
  var takt = { steg: -1, blaff: 0 };

  leggTil(function (dt) {
    var ko = Motor.stegKo;
    while (ko.length && Motor.ctx && ko[0].tid <= Motor.ctx.currentTime) {
      var s = ko.shift();
      takt.steg = s.steg;
      if (s.steg === 0) takt.blaff = 1;
    }
    takt.blaff = Math.max(0, takt.blaff - dt * 3.2);
  });

  /* ---------- bakgrunnen ---------- */

  /* Perspektivgitteret beveger seg i tempoet til musikken, ikke i klokketid.
     Det er den detaljen som gjør at rommet føles som om det danser med. */
  function bakgrunn(lerret) {
    var g = lerret.getContext('2d');
    var b = 0, h = 0, dpr = 1;
    var stjerner = [];
    var fase = 0, vandring = 0;

    function maal() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      b = lerret.clientWidth; h = lerret.clientHeight;
      lerret.width = Math.floor(b * dpr);
      lerret.height = Math.floor(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      stjerner = [];
      var antall = Math.round(b * h / 14000);
      for (var i = 0; i < antall; i++) {
        stjerner.push({
          x: Math.random() * b,
          y: Math.random() * h * 0.66,
          r: Math.random() * 1.4 + 0.4,
          f: Math.random() * 6.28,
          v: 0.6 + Math.random() * 1.8
        });
      }
    }

    maal();
    window.addEventListener('resize', maal);
    window.addEventListener('orientationchange', function () { setTimeout(maal, 250); });

    leggTil(function (dt, naa) {
      var niv = Motor.rigg ? niva(Motor.rigg.analyse) : 0;
      var bpm = Motor.bpm;
      if (Motor.spiller) fase += dt * (bpm / 60) * 0.25;
      vandring += dt * 0.06;
      var blink = takt.blaff;      // blaffet i horisonten på hver ny takt

      g.clearRect(0, 0, b, h);

      var horisont = h * 0.6;

      // stjerner
      for (var i = 0; i < stjerner.length; i++) {
        var st = stjerner[i];
        var lys = 0.35 + 0.65 * Math.abs(Math.sin(st.f + naa / 1000 * st.v));
        g.globalAlpha = lys * (0.5 + niv * 0.5);
        g.fillStyle = i % 7 === 0 ? '#ff6ad5' : '#cfe9ff';
        g.fillRect(st.x, st.y, st.r, st.r);
      }
      g.globalAlpha = 1;

      // to glødende skyer som puster med miksen
      var farger = [[320, b * 0.22, h * 0.26], [190, b * 0.8, h * 0.2]];
      g.globalCompositeOperation = 'lighter';
      for (var k = 0; k < farger.length; k++) {
        var f = farger[k];
        var rad = (Math.min(b, h) * 0.42) * (0.85 + niv * 0.5 + Math.sin(vandring + k) * 0.08);
        var grad = g.createRadialGradient(f[1], f[2], 0, f[1], f[2], rad);
        grad.addColorStop(0, 'hsla(' + f[0] + ' 100% 60% / ' + (0.16 + niv * 0.16).toFixed(3) + ')');
        grad.addColorStop(1, 'hsla(' + f[0] + ' 100% 50% / 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, b, h);
      }
      g.globalCompositeOperation = 'source-over';

      // horisontlinje
      g.strokeStyle = 'hsla(300 100% ' + (62 + blink * 30) + '% / ' + (0.5 + blink * 0.5) + ')';
      g.lineWidth = 1 + blink * 2.5;
      g.beginPath();
      g.moveTo(0, horisont);
      g.lineTo(b, horisont);
      g.stroke();

      // gitteret under horisonten
      g.lineWidth = 1;
      var linjer = 14;
      for (var j = 0; j < linjer; j++) {
        var p = (j + (fase % 1)) / linjer;
        var y = horisont + (h - horisont) * p * p;
        if (y > h) continue;
        g.strokeStyle = 'hsla(190 100% 60% / ' + (0.32 * (1 - p) + 0.06).toFixed(3) + ')';
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(b, y);
        g.stroke();
      }
      for (var v = -9; v <= 9; v++) {
        g.strokeStyle = 'hsla(285 100% 65% / ' + (0.06 + niv * 0.1).toFixed(3) + ')';
        g.beginPath();
        g.moveTo(b / 2 + v * (b * 0.035), horisont);
        g.lineTo(b / 2 + v * (b * 0.55), h);
        g.stroke();
      }
    });
  }

  /* ---------- visualisering under opptak ---------- */

  /* Dette er selve belønningen: barnet skal se sin egen stemme. Ringen av
     søyler er frekvensene, den indre bølgen er selve lydtrykket, og fargen
     skyver seg mot varmt når de tar i. */
  function opptaksring(lerret, hentAnalyse) {
    var g = lerret.getContext('2d');
    var b = 0, h = 0, dpr = 1;
    var gnister = [];
    var sniv = 0;

    function maal() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      b = lerret.clientWidth; h = lerret.clientHeight;
      lerret.width = Math.floor(b * dpr);
      lerret.height = Math.floor(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var frekvens = null, boelge = null;

    function tegn(dt, naa) {
      if (lerret.clientWidth !== b || lerret.clientHeight !== h) maal();
      var an = hentAnalyse();
      g.clearRect(0, 0, b, h);
      if (!an) return;
      if (!frekvens || frekvens.length !== an.frequencyBinCount) {
        frekvens = new Uint8Array(an.frequencyBinCount);
        boelge = new Uint8Array(an.fftSize);
      }
      an.getByteFrequencyData(frekvens);
      an.getByteTimeDomainData(boelge);

      var sum = 0, i;
      for (i = 0; i < boelge.length; i++) {
        var x = (boelge[i] - 128) / 128;
        sum += x * x;
      }
      var niv = Math.min(1, Math.sqrt(sum / boelge.length) * 3);
      sniv += (niv - sniv) * Math.min(1, dt * 14);

      var cx = b / 2, cy = h / 2;
      var indre = Math.min(b, h) * 0.21;
      var hue = 190 - sniv * 150;          // blått i ro, rosa når de tar i

      // glød i midten
      var grad = g.createRadialGradient(cx, cy, 0, cx, cy, indre * (2.4 + sniv * 1.2));
      grad.addColorStop(0, 'hsla(' + hue + ' 100% 65% / ' + (0.3 + sniv * 0.45).toFixed(3) + ')');
      grad.addColorStop(1, 'hsla(' + hue + ' 100% 55% / 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, b, h);

      // søyler rundt hele sirkelen, speilet så den blir symmetrisk
      var soyler = 96, halv = soyler / 2;
      var bruk = Math.min(frekvens.length, 160);
      g.lineCap = 'round';
      for (i = 0; i < soyler; i++) {
        var idx = i < halv ? i : soyler - 1 - i;
        var v = frekvens[Math.floor(idx / halv * bruk)] / 255;
        v = Math.pow(v, 1.35);
        var a = i / soyler * Math.PI * 2 - Math.PI / 2;
        var l1 = indre + 6;
        var l2 = l1 + v * Math.min(b, h) * 0.26 + 2;
        g.strokeStyle = 'hsl(' + (hue + idx * 1.1) + ' 100% ' + (55 + v * 25) + '%)';
        g.lineWidth = Math.max(2, Math.min(b, h) * 0.012);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * l1, cy + Math.sin(a) * l1);
        g.lineTo(cx + Math.cos(a) * l2, cy + Math.sin(a) * l2);
        g.stroke();
      }

      // bølgeformen som en lukket ring
      g.strokeStyle = 'hsl(' + hue + ' 100% 78%)';
      g.lineWidth = 2.5;
      g.beginPath();
      var steg = Math.max(1, Math.floor(boelge.length / 180));
      for (i = 0; i < boelge.length; i += steg) {
        var aa = i / boelge.length * Math.PI * 2 - Math.PI / 2;
        var rr = indre * (0.72 + (boelge[i] - 128) / 128 * 0.5);
        var px = cx + Math.cos(aa) * rr, py = cy + Math.sin(aa) * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();

      // gnister når de virkelig tar i
      if (niv > 0.42 && Math.random() < niv) {
        var vinkel = Math.random() * Math.PI * 2;
        gnister.push({
          x: cx + Math.cos(vinkel) * indre, y: cy + Math.sin(vinkel) * indre,
          vx: Math.cos(vinkel) * (60 + Math.random() * 200),
          vy: Math.sin(vinkel) * (60 + Math.random() * 200),
          liv: 1, hue: hue + Math.random() * 60
        });
      }
      for (i = gnister.length - 1; i >= 0; i--) {
        var gn = gnister[i];
        gn.x += gn.vx * dt; gn.y += gn.vy * dt; gn.liv -= dt * 1.6;
        if (gn.liv <= 0) { gnister.splice(i, 1); continue; }
        g.globalAlpha = gn.liv;
        g.fillStyle = 'hsl(' + gn.hue + ' 100% 70%)';
        g.beginPath();
        g.arc(gn.x, gn.y, 2.5 * gn.liv + 0.5, 0, 6.284);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    maal();
    leggTil(tegn);
    return function () { fjern(tegn); };
  }

  return {
    leggTil: leggTil, fjern: fjern, niva: niva,
    bakgrunn: bakgrunn, opptaksring: opptaksring,
    takt: takt
  };
})();
