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
| `analyse.js` | Hører hva slags lyd et opptak er (brukes til navnene) |
| `navn.js` | Gir hver lyd et lydmalende navn ut fra hvordan den låter |
| `monsters.js` | Tegner monstrene prosedyrisk som neon-SVG |
| `visual.js` | Bakgrunnen og visualiseringsringen under opptak |
| `app.js` | Skjermer, tilstand og hendelser |

Noen valg som er verdt å kjenne til før du endrer noe:

**All lyd syntetiseres.** Appen har ingen lydfiler. Det er derfor tempoet kan
endres fritt uten at trommene låter strukket, og derfor den virker offline med
én gang. Alt som lager lyd tar `AudioContext` som første argument — eksporten
kjører nøyaktig samme kode i en `OfflineAudioContext`, så det barna hører er
det de får i fila.

**Atten beats i tre rader, og hver er en hel verden.** BOOM BAP, ROMBASE,
JUNGEL, HAVDYP, PIXEL, SPØKELSE, DRAGER, FABRIKK, GODTELAND, DINO, VINTER,
PIRAT, SUPERHELT, BORG, GALAKSE, FRUKTFEST, HAGEN og EVENTYR har hver sine
egne monstre, egne syntetiserte lyder, egen
toneart og eget tempo — ikke samme trommer i nytt mønster. Å bytte beat
bytter monstrene, lydene, tempoet og fargene på himmelen på én gang, så det
føles som å gå inn i et annet rom. Barnas egne lyder blir stående og spiller
videre oppå den nye beaten: det er barnets band, beaten er scenen. Hver
verden husker hvilke av sine monstre som sto på sist (`S.trommer`), så det
går an å hoppe fram og tilbake.

**Hver verden har sin toneart, og alt i den passer sammen.** Innenfor én beat
er alle tonene valgt slik at en seksåring kan skru på alle monstrene samtidig
uten at det skjærer: A-moll pentaton i BOOM BAP, E-moll i ROMBASE, C-dur i
JUNGEL, D-moll i HAVDYP, G-dur i PIXEL, D-moll i DRAGER, G-moll i FABRIKK,
F-dur i GODTELAND, E-moll i DINO, D-dur i VINTER — pentatone skalaer, der
ingen to toner gnisser. SPØKELSE og PIRAT er unntakene med vilje: E harmonisk
moll i spøkelseshuset, der den ene hevede tonen (D#) gjør det skummelt, og
en E-dur-akkord i A-moll hos piratene — det er den som gjør det til en
sjømannssang. I begge løser det seg alltid opp igjen.

**Monstrene hører hjemme i sin verden.** `monsters.js` har et tema per verden
som bestemmer hvilke kropper, øyne, munner og pynt generatoren får velge
mellom: roboter med visir og hjul, jungeldyr med blader, maneter og
blekkspruter, pikselmonstre som i et gammelt tv-spill, og spøkelser med
heksehatt og selvlysende øyne.

**Flere verdener har sin egen tegnestil**, ikke bare egne monstre. PIXEL
tegner i ruter som et gammelt tv-spill, og i andre rad har nesten hver verden
sin egen måte å tegne på (`STILER` i `monsters.js`): klistremerker med hvit
kant for drager og pirater, blankt metall med fargeforløp for robotene,
glinsende 3D-godteri, hulemalerier av dinosaurer på en steinflis, og origami
for vinterdyrene der hver flate brettes i trekanter med egen lysstyrke. Tredje
rad har tegneserie med rasterprikker for superheltene, glassmaleri for
borgen, stjernebilder for galaksen, frukt med ansikt for fruktfesten,
akvarell for småkrypene i hagen, og pastell med regnbuer og glitter for
eventyret. Hver
stil er sin egen lille tegner, men alle legger øynene i `oye`-grupper og
munnen i en `munn`-gruppe, så de blunker og synger som alle andre monstre.
Fargeforløp og klipping trenger id-er som er unike på siden; hver tegning får
et prefiks laget av nøkkelen.

**Barnas nye lyder henter figuren fra alle verdenene.** Hver ny lyd trekker en
tilfeldig stil — neon, piksel, robot, drage, godteri, hulemaleri, origami … —
og stilen lagres på lyden (`tema` i `S.stemmer`), så figuren ser lik ut i
morgen. To lyder på rad får aldri samme stil. Liker ikke barnet figuren,
trykker de på den på opptaksskjermen og får en ny. Lyder laget før dette har
ingen stil lagret og tegnes nøyaktig som før.

Monstre uten tema — barnas egne lyder og BOOM
BAP — trekker nøyaktig like mange terningkast som før, så ingen eksisterende
figur har forandret seg. De nye kroppsformene står derfor utenfor `FORMER`.

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
som sto på, hvilken beat og hvilket tempo, og hvilken effekt og rytme hver
stemme hadde. Å spille den av setter brettet tilbake til akkurat det — og da
oppfører figurene seg av seg selv slik de skal, fordi animasjonen leser
lydnivået fra hvert monsters egen analysenode. Sangene ligger nederst på
brettet og ikke bak en knapp: et barn som må huske at det finnes en skjerm et
sted, spiller ikke av sangen sin igjen.

**Opptil 200 egne lyder, og det koster bare det som spiller.** En stemme har
lydkjede bare så lenge den står på, og opptaket dekodes først når den skrus på.
Det er ikke optimalisering for sin egen skyld: HULE regner konvolusjon på hver
lydblokk og ROBOT og ROMVESEN har oscillatorer som aldri stopper, også i
stillhet. Med kjeder for alle 200 ville et nettbrett hatt det tilsvarende av
førti stemmer i gang permanent. Målt her: 40 samtidige stemmer regnes fem
ganger raskere enn sanntid, og oppstart med 200 lagrede lyder tar 43 ms mot
23 ms med ingen.

**Appen gir lydene navn selv**, lydmalende ut fra hvordan de låter (`navn.js`):
en lyd som består av flere slag blir slagene etter hverandre (BOM-TI-BOM,
PAF-TI), en lang lyd får navn etter tone og klang (MMMM, VIIIU, KSSJ), og ett
kort slag etter hva slags slag det var (BOOM, KLASK, TJIK). Lang lyd sjekkes
før rytme — et sus svinger hele tiden litt og ville ellers sett ut som mange
slag. Tonehøyden tar den *første* nesten-høyeste toppen i autokorrelasjonen,
ikke den høyeste; ellers ble en pipestemme på 620 Hz målt til 78 Hz, åtte
perioder ut. Lyder som fortsatt heter LYD 1, LYD 2 … fra før navnefunksjonen
kom, døpes om ved oppstart. Navn barnet har satt selv, røres aldri.

**Analysen måler ØKNING, ikke nivå.** Den brukes til å gi lydene navn, og det
gjelder både anslagsdeteksjonen og gjenkjenningen — begge steder var det
forskjellen på å virke og ikke virke:
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

En ny beat legges i `GRUNNBEATS` i `audio.js`: `id`, `navn`, `emoji`, `bpm`,
`hue` (fargen på knappen), `tema` (monsterstilen), `himmel` (fargene i
bakgrunnen) og en liste `lyder`. Hver lyd har sin egen `slag`-funksjon og sitt
eget `spor`: 16 tegn for én takt eller 32 for to (mellomrom leses bort), der
`x` er hardt slag, `o` mykt og `.` stille — andre bokstaver sendes videre til
lyden (bongoen bruker `h` og `l`). Tonale spor er notenavn med mellomrom
(`A1`, `C#4`, `Bb3`), akkorder med pluss (`E3+G3+B3`). `lengde` er hvor mange
steg en tone holder, eller `'legato'` for «til neste tone» med `maksSteg` som
tak. `start: true` gjør at monsteret står på første gang verdenen åpnes — hold
det til tre. Id-ene må være unike på tvers av alle beatene; feil i et spor
sies fra om i konsollen ved oppstart.

Pass på nivåene. Alle beatene er målt slik at de ligger rundt 0,17–0,22 i RMS
med alt på, og under 0,9 i topp. Kick, skarptromme og klapp bør ikke lande på
nøyaktig samme steg — de summerer seg til klipping. Slik måler du:

```js
async function maal() {
  const b = await new OfflineAudioContext(1, 1, 44100)
    .decodeAudioData(await (await Motor.eksporter(4)).arrayBuffer());
  const d = b.getChannelData(0);
  let topp = 0, sum = 0;
  for (const x of d) { topp = Math.max(topp, Math.abs(x)); sum += x * x; }
  return { topp: topp.toFixed(3), rms: Math.sqrt(sum / d.length).toFixed(3) };
}
Motor.settGrunnbeat('din-nye-beat'); byggBrett();
Motor.plasser.forEach(p => p.paa = p.kind === 'trommer');
console.log(await maal());
```

En ny effekt legges i `EFFEKTER`; den trenger enten en `rate`
(avspillingsfart), en `bygg`-funksjon som returnerer `{ inn, ut }`, eller begge.

En helt ny tegnestil legges i `STILER`: en funksjon `(rnd, hue, f, uid)` som
returnerer hele SVG-en. Bruk bare `rnd` til tilfeldighet, så samme monster
ser likt ut hver gang, og prefiks alle id-er med `uid`.

Et nytt monstertema legges i `TEMA` i `monsters.js`: lister over kropper,
pynt, øyne, munner og mønstre å velge mellom. En ny kroppsform må returnere
`deler` (SVG-tekst), ytterkantene `topp`/`bunn`/`halvbred`, og en `ansikt`-boks
som er garantert *inne i* silhuetten — mønster og ansikt plasseres etter den,
og for former som bobler eller pigger er ytterkanten delvis tom luft. Legg den
aldri i `FORMER`: det ville endret utseendet på alle barnas eksisterende lyder.

Tegneflaten er `0 0 100 100` og klipper alt utenfor. (`getBBox` regner ikke med
`clip-path`, så glassmaleriets ruter bak buen slår ut i sjekken under uten å
synes.) Alt som stikker opp må
respektere taket `HIMMEL`. Slik sjekker du at ingenting blir klippet:

```js
const d = document.createElement('div');
document.body.appendChild(d);
for (const tema of ['rom', 'jungel', 'hav', 'pixel', 'gross', 'drage', 'pirat',
                    'metall', 'godteri', 'dino', 'origami', 'tegneserie',
                    'glassmaleri', 'stjernebilde', 'frukt', 'akvarell', 'regnbue', null]) {
  for (let i = 0; i < 400; i++) {
    d.innerHTML = Monstre.tegn('t' + i, Monstre.nyHue(i), tema ? { tema } : null);
    const b = d.querySelector('svg').getBBox();
    if (b.x < -2 || b.y < -2 || b.x + b.width > 102 || b.y + b.height > 102) console.log(tema, i, b);
  }
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
