# Gaetanata

Web app che sostituisce il foglio Excel "DIETA GAETANATA": calcolo del metabolismo del paziente, piano dieta settimanale (7 giorni × 6 pasti), totali e media dei nutrienti, stampa per il paziente.

## Avvio

È sufficiente scaricare lo ZIP del progetto ed estrarlo, oppure clonarlo con Git. Per clonare serve Git; su macOS, se manca, il sistema propone l'installazione degli strumenti da riga di comando. Il download ZIP non richiede Git.

- **Windows:** fai doppio clic su `avvia.cmd`.
- **macOS:** fai doppio clic su `avvia.command`. Al primo avvio macOS potrebbe bloccarlo, specialmente se il progetto proviene da uno ZIP scaricato dal browser: fai clic destro → **Apri**, oppure usa **Impostazioni di Sistema → Privacy e sicurezza → Apri comunque**.
- **Linux:** esegui `./avvia.sh` dal terminale.

Al primo avvio, se necessario, viene scaricato Node portabile; vengono poi installate le dipendenze e compilata l'app. Gli avvii successivi riutilizzano quanto già installato e ricompilano solo se necessario. Lascia aperta la finestra per usare l'app; chiudila per fermarla.

I dati sono salvati sul computer in `data/gaetanata.db`. Per un backup, chiudi l'app e copia l'intera cartella `data/`.

Per sviluppare, con Node 22.13 o successivo installato:

```sh
npm install
npm run dev      # server di sviluppo
npm run check    # typecheck + lint
npm test         # test
```

## Recupero di alimenti non riconosciuti

Un piano ripristinato può contenere nomi non più presenti nell'elenco. La riga
resta visibile con nome e grammi originali: scegli un alimento nel campo
«Sostituisci» oppure rimuovi esplicitamente la riga con ×. La sostituzione
mantiene quantità e identità della riga, senza modificare le altre porzioni.
Non vengono proposte correzioni automatiche per somiglianza del nome.

Finché ci sono righe da correggere, i totali dei pasti e dei giorni coinvolti
sono indicati come incompleti, non come zero. Anche la media è incompleta se
include uno di questi giorni; puoi escluderlo manualmente dalla media.
Gli altri pasti e giorni restano consultabili con i loro valori.

Il formato `WeekPlan` conserva solo i dati originali serializzabili, comprese
le righe irrisolte. `resolvePlan(plan, lookupFood)` produce separatamente gli
esiti di validazione e i calcoli: il salvataggio conserva il piano
originale; un'esportazione deve essere impedita e spiegata se `issues` non è
vuoto. Al momento non è presente un comando di esportazione.

## Scorciatoie da tastiera

Schede dei giorni (come le schede standard WAI-ARIA):

- **Tab** entra nel gruppo sul giorno selezionato; un altro **Tab** esce dal gruppo.
- **Freccia destra / sinistra** seleziona il giorno successivo / precedente (da domenica si torna a lunedì e viceversa).
- **Home** seleziona lunedì, **Fine** (End) seleziona domenica.

Le frecce scritte nei campi di ricerca alimento o dei grammi non cambiano giorno.

## Interfaccia

L'editor si adatta alla larghezza della finestra, anche con lo zoom del browser:

- **Da 1280 px:** tre colonne affiancate, ricerca alimenti, giorni e pasti, riepilogo. Se la finestra è alta almeno 600 px l'app occupa lo schermo e ogni colonna scorre per conto suo; altrimenti scorre la pagina e ricerca e riepilogo restano visibili ai lati.
- **Da 960 a 1279 px:** la ricerca resta a sinistra, sempre visibile; il riepilogo va sotto i pasti.
- **Sotto 960 px:** i pannelli si dispongono in sequenza, ricerca, giorni e pasti, riepilogo. La ricerca indica sempre giorno e pasto a cui aggiunge l'alimento; ogni pasto ha comunque il proprio campo «Aggiungi alimento».

I pulsanti dei giorni restano in cima mentre si scorrono i pasti e su schermi stretti vanno a capo. Quando la tabella di un pasto non entra in larghezza scorre orizzontalmente dentro il pasto, con il nome dell'alimento sempre visibile; la pagina non scorre mai di lato.

## Schede pazienti

Il pulsante **Paziente** in alto apre l'elenco delle schede, in ordine alfabetico.

- **Nuova scheda**: compila i campi e premi **Salva scheda**. Solo il nome è obbligatorio; data di nascita, sesso (usato dalle formule del metabolismo), peso in kg e altezza in cm si possono aggiungere in seguito. Per i decimali va bene sia la virgola sia il punto (`72,5`).
- **Aprire o modificare**: fai clic su un nome nell'elenco, cambia i campi e premi **Salva scheda**. Il paziente selezionato è quello attivo nell'editor. Due persone con lo stesso nome restano schede distinte; la data di nascita accanto al nome aiuta a riconoscerle.
- **Eliminare**: con la scheda aperta premi **Elimina scheda**, poi **Conferma eliminazione**. Cambiare selezione annulla la richiesta; l'eliminazione non si può annullare.

Nome vuoto, data di nascita futura o non valida, peso o altezza non numerici o non positivi vengono segnalati accanto al campo e nulla viene salvato. «Scheda salvata» compare solo dopo che i dati sono stati scritti nel database; se il salvataggio o la lettura non riescono, compare il motivo.

Le schede restano in `data/gaetanata.db` anche dopo la chiusura. Al primo avvio di questa versione il database viene aggiornato automaticamente, senza perdere dati.

### Metabolismo basale nella scheda

Sotto i campi della scheda il riquadro **Metabolismo basale** mostra affiancati i risultati di Harris-Benedict, Mifflin-St Jeor e Bernstein in kcal/giorno, con la fascia di BMI di ciascuna formula. La formula usata automaticamente è evidenziata («In uso») e il suo valore è ripetuto in grassetto; non esiste una scelta manuale (vedi [Formule del metabolismo](#formule-del-metabolismo) e ADR 0002). La scelta segue il BMI non arrotondato: fino a 25 incluso Harris-Benedict, oltre 25 fino a 30 incluso Mifflin-St Jeor, oltre 30 Bernstein. Il BMI è mostrato con due decimali.

Sono indicati anche l'età, calcolata alla data di oggi del computer (scritta accanto, «Età al GG/MM/AAAA»), e il BMI usati nel calcolo. Il metabolismo basale è la spesa a riposo: non è automaticamente la quantità di calorie da prescrivere nella dieta.

I risultati si aggiornano mentre si modificano i campi, anche prima di salvare; nel database restano solo i dati della scheda e il metabolismo viene ricalcolato ogni volta che la scheda si riapre. Se manca la data di nascita, il sesso, il peso o l'altezza, il riquadro dice cosa completare; se un valore non è valido dice cosa correggere; se i dati danno un risultato nullo o negativo per qualche formula chiede di controllarli. In questi casi non compare nessun numero.

## Salvare e riaprire il piano

Apri una scheda dal pulsante **Paziente**: l'editor carica il piano di quella
persona oppure una settimana vuota se non è ancora stato salvato. **Salva piano**
scrive l'intera settimana sul computer: sette giorni, sei pasti, porzioni
nell'ordine originale, quantità e giorni esclusi dalla media. Ogni paziente ha
un solo piano corrente: salvare lo aggiorna, senza creare uno storico.

Lo stato distingue modifiche non salvate, caricamento, salvataggio in corso,
conferma e errore. In caso di errore il lavoro resta nell'editor: ripremi
**Salva piano**; se il caricamento fallisce, riseleziona la scheda per riprovare.
Prima di cambiare paziente puoi **Salva e cambia**, **Scarta e cambia** oppure
**Annulla cambio**. Prima di selezionare il primo paziente, un piano compilato
senza scheda può essere scartato oppure mantenuto annullando il cambio, ma non
salvato senza un paziente. La chiusura o ricarica della pagina avvisa se restano
modifiche non salvate; riaprendo l'app, seleziona nuovamente la scheda.

I piani restano nello stesso database locale delle schede, anche dopo il
riavvio. La seconda migrazione aggiunge i piani senza modificare le schede
esistenti. Eliminare una scheda elimina anche il suo piano, come avvisa la
conferma: non rimangono piani senza paziente e non è possibile recuperarli.
I nomi alimento non più riconosciuti vengono conservati e segnalati nell'editor
per la sostituzione, senza impedire di caricare o salvare il resto del piano.

## Dati

Il foglio originale contiene dati di pazienti reali. Il repository è pubblico: non committare mai file Excel/CSV (sono esclusi in `.gitignore`) né dati che identificano una persona. Tabelle di riferimento (alimenti, attività MET) possono entrare nel repo; i dati dei pazienti no.

## Dati di riferimento

I file `src/data/foods.json` e `src/data/met.json` provengono esclusivamente dai fogli «Elenco Alimenti» e «MET» del file Excel originale. I valori nutrizionali sono riferiti a 100 g; valori mancanti, errori e valori testuali incerti sono importati come `null` e trattati come zero nei totali, come nel foglio.

Per rigenerarli senza includere dati dei pazienti:

```sh
npm run import:tables -- "percorso/al/file.xlsx"
```

## Media settimanale

La media dei nutrienti conta soltanto i giorni che contengono almeno una porzione in uno dei sei pasti e che non sono stati esclusi a mano con la casella "Giorni inclusi nella media". Un giorno senza porzioni è indicato come vuoto e non conteggiato (non conta il valore zero delle calorie); torna a contribuire appena viene ricompilato. L'esclusione manuale è una scelta separata e resta anche quando si aggiungono o tolgono porzioni. Se nessun giorno è compilato e incluso, compare un messaggio al posto della media. Il pannello mostra su quanti giorni è calcolata la media.

## Formule del metabolismo

Decisioni prese (issue #1). P = peso in kg, H = altezza in cm, A = età in anni.

| Formula | Maschio | Femmina | Fonte |
|---|---|---|---|
| Harris-Benedict | `66.4730 + 13.7516·P + 5.0033·H − 6.7550·A` | `655.0955 + 9.5634·P + 1.8496·H − 4.6756·A` | Harris & Benedict, 1918 |
| Mifflin-St Jeor | `9.99·P + 6.25·H − 4.92·A + 5` | `9.99·P + 6.25·H − 4.92·A − 161` | Mifflin et al., 1990 |
| Bernstein | `11.02·P + 10.23·H − 5.8·A − 1032` | `7.48·P − 0.42·H − 3.0·A + 844` | Bernstein et al., 1983 |

- **Scelta automatica della formula** in base al BMI: BMI ≤ 25 → Harris-Benedict, 25 < BMI ≤ 30 → Mifflin, BMI > 30 → Bernstein.
- **"Eq. Giuseppe"**: tolta, non viene implementata.
- **Unità in stampa**: latte e olio in ml, tutto il resto in g.
