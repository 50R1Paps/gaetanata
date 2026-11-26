# Schema

[Indice della documentazione](../../README.md#documentazione)

## Schema: modulo di calcolo e salvataggio

`src/schemaCalc.ts` espone `calculateSchema(paziente, schema, oggi)`; l'interfaccia
è documentata in testa al modulo. Calcola fabbisogno, ripartizione per 3–6 pasti,
grammature ai 5 g, sostituzioni e proteine/kg sul solo peso di riferimento:
il minore tra peso reale e 25 × altezza² in metri (ADR 0012). Normopeso e
sottopeso usano il peso reale; a BMI 25 si indica ancora il peso reale.
`protein` espone `grams` e `reference: { weightKg, gramsPerKg, basis }`,
con `basis` pari a `real` o `bmi25`; gli avvisi riguardano solo questo rapporto.
I dati mancanti producono indicazioni da completare, senza risultati numerici.
Ogni quantità distingue calcolo e correzione manuale; eliminare la correzione
ripristina il calcolo. Le correzioni dei macro sono in grammi.

Pasta, pane e patate seguono ADR 0005; la combinazione pasta+pane assegna metà
carboidrati a ciascuno. Gnocchi, gallette di riso e cracker usano invece i
carboidrati degli alimenti generici in `src/data/foods.json`, non coefficienti
del foglio. La farina di mais non è presente: la polenta resta non disponibile,
con avviso esplicito, senza inventare un coefficiente.

`src/schema.ts` definisce gli input JSON (kcal inizialmente da inserire, LAF 1,4,
5 pasti, macro 50/30/20) e le sole correzioni. `src/schemasApi.ts` offre
`loadSchema`/`saveSchema`: `GET`/`PUT /api/patients/:id/schema`. Ogni paziente ha
uno schema corrente, separato dal piano libero; la terza migrazione lo aggiunge
senza alterare schede e piani. Resta dopo il riavvio e viene eliminato insieme
alla scheda. I risultati calcolati non vengono salvati. La versione 1 accetta
le sezioni opzionali seguenti; anche i salvataggi precedenti restano validi.
La schermata e l'API per generare il Word sono descritte in [Documento Word](word.md).

- `proteinWeek: { redMeatGrams?, days? }`: `days` usa `lunedi`…`domenica`,
  ciascuno con `lunch`/`dinner` opzionali: `{ source, grams?, exception? }`.
  Le dieci chiavi `source` sono esportate da `schemaProteinSources` e verificate
  contro il contratto Word. Un pasto assente non ha una fonte preassegnata.
  Le porzioni proposte sono uova 120 g (eccezione 180), pesce in scatola 52 g
  (eccezione 78), legumi secchi 50 g/in scatola 150 g, formaggio fresco 100 g/
  stagionato 50 g, affettati 80 g. La base carne rossa si inserisce a mano;
  carne bianca ×1,3 e pesce ×1,5 vengono arrotondati ai 5 g e ricalcolati quando
  cambia la base. `grams` prevale sul calcolo (anche zero); eliminarlo ripristina
  la proposta. Senza base, la quantità calcolata delle carni/pesce è `null`,
  non zero; un inserimento manuale resta utilizzabile.
- Il risultato `proteinWeek` espone sette `days`, `counts` per ciascuna fonte e
  `frequencies` con `sources`, `count`, `min`, `max`, `outOfRange`. I formaggi
  si contano insieme (1–2), come i legumi (2–4); carne bianca 2–4, carne rossa
  0–1, pesce 2–4, pesce in scatola 1–2, affettati 0–1, uova 1–2. I limiti sono
  inclusivi; si contano le scelte, non i grammi né le eccezioni come pasti extra.
- `pizza: { breadGrams?, oilMl?, whiteMeatGrams?, fishGrams? }`: sempre presente
  nel risultato con pane 50 g e olio 10 ml iniziali. `whiteMeat` e `fish`
  seguono la base carne rossa ×1,3 e ×1,5, arrotondata ai 5 g come nei giorni
  feriali: senza base sono `null`, salvo correzione manuale (anche zero).
  Eliminare la correzione ripristina il calcolo. È un ottavo giorno intercambiabile con un giorno della
  settimana, al massimo una volta: non è assegnato a un giorno fisso e non
  modifica le sette scelte o i conteggi delle fonti proteiche.
- `breakfast: { choice?, quantity? }`: `latte` (150 ml, predefinito) oppure
  `yogurt` (125 g). `snacks: { nutsGrams?, yogurtGrams? }`: frutta secca 20 g
  e yogurt 125 g. Quantità manuali, modificabili anche a zero; non cambiano
  automaticamente con kcal o numero di pasti. Eliminare le quantità ripristina
  i valori proposti; latte e olio restano in ml, senza conversioni in grammi.

### Schermata Schema

Nell'intestazione il selettore «Piano settimanale | Schema» cambia vista senza
perdere le modifiche. Lo Schema del paziente selezionato mostra metabolismo
basale e fabbisogno appena i dati della scheda sono completi, anche prima delle
kcal dieta; poi LAF, kcal dieta, numero di pasti (3–6) e ripartizione dei macro,
che deve sommare a 100 %. Con dati mancanti elenca cosa completare e non mostra
numeri. Le tabelle riportano kcal e grammi di macro per pasto, pasta a pranzo e
pane a cena con tutte le sostituzioni (la polenta resta «Non disponibile» con
avviso) e le proteine in g/kg sul solo peso di riferimento, con i kg e
l'indicazione «peso reale» o «peso ideale BMI 25», evidenziando il rapporto
fuori da 1,2–1,4.

Ogni grammatura si corregge scrivendo nel campo: la correzione è evidenziata in
giallo e il pulsante ↺ accanto mostra il valore calcolato e lo ripristina.
Svuotare il campo non annulla la correzione. «Salva schema» salva input e
correzioni con lo stesso stato, gli stessi errori e lo stesso avviso di modifiche
non salvate del piano: cambiando paziente si può salvare o scartare il piano, lo
schema o entrambi, e se uno dei due non si carica resta il paziente precedente.

Sotto le tabelle (e come queste solo quando lo schema si può calcolare),
«Colazione e spuntini» propone latte 150 ml (o yogurt 125 g:
cambiando scelta la quantità riparte dalla proposta), frutta secca 20 g e
yogurt 125 g negli spuntini. «Fonti proteiche» ha la base della carne rossa e,
per ognuno dei sette giorni, la fonte di pranzo e cena («Nessuna» lascia il
pasto vuoto) con la quantità proposta; una nuova fonte riparte dalla sua
proposta. Uova e pesce in scatola hanno la casella dell'eccezione (3 uova
180 g, tonno 78 g); carne bianca e pesce senza base restano vuoti con
l'indicazione di inserirla. Accanto, le frequenze settimanali contano le scelte
per fonte (formaggi e legumi insieme, con il dettaglio) e segnalano quelle
sotto o sopra il consigliato. Il giorno pizza, con pane, olio, carne bianca e pesce, è un riquadro
separato «in più», non uno dei sette giorni. Tutte le quantità seguono le
stesse regole di correzione evidenziata e ↺; sotto i 600 px la griglia diventa
un elenco per giorno. Le sezioni vengono salvate solo con i valori scelti o
corretti, così le proposte restano quelle del calcolo.

«Riempi il piano settimanale», nel riquadro «Piano settimanale» dello Schema, è
attivo solo quando lo schema si può calcolare. Se il piano ha già alimenti
chiede conferma («Sostituisci il piano» / «Annulla»); poi sostituisce il piano
dell'editor con gli alimenti rappresentativi (`src/schemaToPlan.ts`). Il piano
resta da salvare come ogni altra modifica, e i pasti non riempiti sono elencati
con il motivo (alimento rappresentativo assente o base carne rossa mancante).

