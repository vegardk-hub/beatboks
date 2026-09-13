# Beatboks

En beatbox-app for barn. Barna tar opp sin egen stemme, legger effekter på den,
og hver lyd blir et monster de kan skru av og på over et beat som alltid går i
takt. Laget for nettbrett (iPad og Android), for lesere på 6–8 år.

Ingen byggesteg, ingen avhengigheter, ingen lydfiler. Åpne `index.html` over
HTTPS (eller `localhost`) og den virker.

## Hvordan det henger sammen

| Fil | Ansvar |
| --- | --- |
| `audio.js` | Lydmotoren: trommesyntese, effektkjeder, taktklokke, eksport |
| `record.js` | Mikrofon, etterarbeid på opptaket, lagring i IndexedDB |
| `analyse.js` | Hører på et opptak og skriver det ned som en beat |
| `monsters.js` | Tegner monstrene prosedyrisk som neon-SVG |
| `visual.js` | Bakgrunnen og visualiseringsringen under opptak |
| `app.js` | Skjermer, tilstand og hendelser |

Noen valg som er verdt å kjenne til før du endrer noe:

**All lyd syntetiseres.** Appen har ingen lydfiler. Det er derfor tempoet kan
endres fritt uten at trommene låter strukket, og derfor den virker offline med
én gang. Alt som lager lyd tar `AudioContext` som første argument — eksporten
kjører nøyaktig samme kode i en `OfflineAudioContext`, så det barna hører er
det de får i fila.

**Alt tonalt ligger i A-moll pentaton.** Det er ikke pynt: det er grunnen til
at en seksåring kan skru på alle monstrene samtidig uten at det låter surt.
Det gjelder på tvers av alle grunnbeatene, så de kan bytte stil midt i en låt
uten at deres egne lyder plutselig blir sure mot bassen.

**Monsteret er instrumentet, grunnbeaten er arrangementet.** `BEATS` sier hva
et monster ER (lydstemme, navn, farge), `GRUNNBEATS` sier hva det SPILLER.
Derfor kan DUNDER gå fra boom bap til reggae uten å skifte utseende — barna
kjenner igjen sin egen kick uansett hvilken låt de bygger.

**Mikrofonens «hjelp» er skrudd av** (`echoCancellation`, `noiseSuppression`,
`autoGainControl` = `false`). Støyfjerning spiser nettopp tsss- og pff-lydene
som *er* beatboxing, og automatisk volumkontroll flater ut slagene.

**Beatet dempes under opptak.** Uten hodetelefoner ville det lekket inn i
mikrofonen og blitt lagt oppå seg selv. Barna får takten som lys i stedet.
Har de hodetelefoner, kan de skru på «behold beatet» på opptaksskjermen.

**Opptaket trimmes og normaliseres automatisk.** Trimmingen er det som avgjør
om loopen lander på slaget — et opptak med et halvt sekund nøling foran kommer
alltid for sent, uansett hvor godt barnet traff.

**En lagret sang er en tilstand, ikke et lydopptak.** Den husker hvilke monstre
som sto på, hvilken grunnbeat og hvilket tempo, og hvilken effekt og rytme hver
stemme hadde. Å spille den av setter brettet tilbake til akkurat det — og da
oppfører figurene seg av seg selv slik de skal, fordi animasjonen leser
lydnivået fra hvert monsters egen analysenode. Sangene ligger nederst på
brettet og ikke bak en knapp: et barn som må huske at det finnes en skjerm et
sted, spiller ikke av sangen sin igjen.

**Egen beat: tempoet gjettes ikke.** Barna beatboxer i fire takter mens
steglysene løper som metronom, så appen vet allerede hvor raskt det går og
trenger bare finne ut hvor i takten de begynte. Det er både mer treffsikkert
enn tempogjetting og lettere å forstå: følger du lysene, blir beaten din.
Beatet er alltid dempet under dette opptaket — hører de den gamle beaten mens
de lager en ny, hermer de den, og skulle høyttaleren stå på ville appens egne
trommer havnet i analysen.

**Kartet er et instrument, ikke en kvittering.** Rutenettet som vises etter
analysen kan redigeres: barnet trykker slag inn og ut, og utkastet spiller hele
tiden mens de gjør det, så endringen høres med én gang og i sammenheng. Å vise
en stille tegning og først spille den av etterpå ville gjort dette til en
gjettelek. Alle trommemonstrene skrus på mens de redigerer — ellers ville en
rute de trykker på vært stum fordi monsteret tilfeldigvis sto av — og brettet
settes tilbake slik det var hvis de angrer.

**Analysen måler ØKNING, ikke nivå.** Det gjelder både anslagsdeteksjonen og
gjenkjenningen, og begge steder var det forskjellen på å virke og ikke virke:
en kick sveiper nedover i tonehøyde, så grunntonen vandrer inn i bassbåndet
etter anslaget og så ut som et nytt slag; og en hi-hat slått 200 ms etter en
kick står fortsatt i kickens bass-hale og ble målt som skarptromme. Begge
forsvant da målingen ble gjort mot nivået like før slaget.

**Monstrene bygges fra silhuetten og ut.** Første versjon hadde én kroppsform
med varierende pynt, og da ble alle monstrene samme hode med ulikt antall
øyne — det øyet fester seg ved er omrisset, ikke detaljene. Nå finnes det åtte
ulike kroppsformer (`FORMER` i `monsters.js`), og hver av dem sier selv hvor
ansiktet skal sitte. Ansiktskoden trenger aldri vite hvilken form den står i.
Lemmer og hodepynt tegnes *bak* kroppen, så silhuetten dekker festet og armene
ikke blir en strek tvers over ansiktet.

## Endre noe

En ny grunnbeat legges i `GRUNNBEATS` i `audio.js`. Den trenger `bpm` og et
`spor` for hvert monster-id. Rytmesporene er 16 tegn, der `x` er hardt slag,
`o` mykt og `.` stille (`rare` bruker i tillegg `r` for kant og `k` for
bjelle). De tonale sporene — `bass` og `blipp` — skrives som 16 notenavn
adskilt med mellomrom, der `.` er pause.

Pass på at ikke kick, klapp og skarptromme lander på nøyaktig samme steg. De
summerer seg da til klipping, og det høres. Slik måler du:

```js
Motor.plasser.forEach(p => p.paa = p.kind === 'trommer');
Motor.settGrunnbeat('din-nye-beat');
const b = await Motor.ctx.decodeAudioData(await (await Motor.eksporter(2)).arrayBuffer());
const d = b.getChannelData(0);
console.log('topp', Math.max(...d).toFixed(3));   // skal ligge under 0,95
```

Endrer du på gjenkjenningen i `analyse.js`, kan du teste den mot en fasit du
lager selv: sett opp en **enstemmig** grunnbeat (aldri to lyder på samme steg —
en munn kan ikke det heller), eksporter fire takter, og send det tilbake inn:

```js
Motor.leggTilGrunnbeat({ id:'t', navn:'T', emoji:'T', bpm:92, spor: {
  dunder:'x.......x.......', skarp:'....x.......x...', tikk:'..x...x...x...x.',
  riste:'................', rare:'................', klapp:'................',
  bass:'. . . . . . . . . . . . . . . .', blipp:'. . . . . . . . . . . . . . . .' } });
Motor.settGrunnbeat('t', false);
Motor.plasser.forEach(p => p.paa = ['dunder','skarp','tikk'].indexOf(p.id) >= 0);
const buf = await Motor.ctx.decodeAudioData(await (await Motor.eksporter(4)).arrayBuffer());
console.log(Analyse.tilBeat(buf, 92).spor);   // skal gi mønsteret over tilbake
```

`tilBeat` returnerer også `treff`, `fase` og `rotasjon`, så det går an å se
nøyaktig hva appen hørte og hvor den la slagene.

Kjente grenser: to lyder på samme sekstendedel smelter til ett anslag og
gjenkjennes som den kraftigste av dem — det gjør ikke noe i praksis, siden en
munn er enstemmig. Rytmeegg og hi-hat skilles bare når «tsss» faktisk er
merkbart lengre enn «ts»; ellers blir begge til hi-hat.

Et nytt beat-monster legges i `BEATS` samme sted — husk da å gi det et spor i
alle fem grunnbeatene, ellers er det stumt i de andre. En ny effekt legges i
`EFFEKTER`; den trenger enten en `rate` (avspillingsfart), en `bygg`-funksjon
som returnerer `{ inn, ut }`, eller begge.

En ny kroppsform legges i `FORMER` i `monsters.js`. Den må returnere `deler`
(SVG-tekst), ytterkantene `topp`/`bunn`/`halvbred`, og en `ansikt`-boks som er
garantert *inne i* silhuetten — mønster og ansikt plasseres etter den, og for
former som bobler eller pigger er ytterkanten delvis tom luft.

Tegneflaten er `0 0 100 100` og klipper alt utenfor. Alt som stikker opp må
respektere taket `HIMMEL`. Slik sjekker du at ingenting blir klippet:

```js
const d = document.createElement('div');
document.body.appendChild(d);
for (let i = 0; i < 400; i++) {
  d.innerHTML = Monstre.tegn('t' + i, Monstre.nyHue(i));
  const b = d.querySelector('svg').getBBox();
  if (b.x < -2 || b.y < -2 || b.x + b.width > 102 || b.y + b.height > 102) console.log(i, b);
}
```

Ved hver endring som pushes: bump `VERSJON` i `app.js` **og** `CACHE` i
`sw.js`. Versjonen vises nederst i appen, så det er lett å se om nettbrettet
faktisk har hentet siste utgave.

## Publisering

Mikrofon krever HTTPS. GitHub Pages holder:

```bash
git push -u origin master
```

Slå så på Pages for repoet (Settings → Pages → Deploy from branch → `master`,
mappe `/`). På iPad: åpne adressen i Safari, trykk Del → «Legg til på
Hjem-skjerm». Da kjører den i fullskjerm uten adressefelt.

## Kjøre lokalt

```bash
node server.js
```

Mikrofon virker på `localhost` uten sertifikat.
