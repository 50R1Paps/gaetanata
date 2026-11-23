# Piano settimanale

[Indice della documentazione](../../README.md#documentazione)

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
salvato senza un paziente.

Mentre lavori, le modifiche non salvate a piano e schema vengono scritte in
una **bozza** locale, circa un secondo dopo l'ultima modifica. La bozza contiene
solo i documenti modificati, anche per un piano senza paziente, non scade e non
sostituisce mai il salvataggio esplicito. Salvando entrambi i documenti oppure
scartando le modifiche, la bozza viene eliminata.

Alla riapertura un riquadro indica paziente (oppure «piano senza paziente»),
documenti contenuti, data e ora dell'ultima modifica. Finché non scegli
**Ripristina** o **Scarta**, il resto dell'interfaccia è bloccato.
**Ripristina** apre il paziente e rimette le modifiche sopra i documenti salvati:
restano «modificato, non salvato» fino a **Salva piano** o **Salva schema**.
La bozza continua ad aggiornarsi mentre lavori. Se il caricamento fallisce,
il riquadro mostra il motivo e permette di riprovare senza perdere la bozza.
**Scarta** elimina la bozza e avvia l'app vuota, senza selezionare un paziente.

La **scheda paziente non è coperta dalla bozza**: premi **Salva scheda** prima
di chiudere per conservare le sue modifiche.

I piani restano nello stesso database locale delle schede, anche dopo il
riavvio. La seconda migrazione aggiunge i piani senza modificare le schede
esistenti. Eliminare una scheda elimina anche il suo piano, come avvisa la
conferma: non rimangono piani senza paziente e non è possibile recuperarli.
I nomi alimento non più riconosciuti vengono conservati e segnalati nell'editor
per la sostituzione, senza impedire di caricare o salvare il resto del piano.

## Media settimanale

La media dei nutrienti conta soltanto i giorni che contengono almeno una porzione in uno dei sei pasti e che non sono stati esclusi a mano con la casella "Giorni inclusi nella media". Un giorno senza porzioni è indicato come vuoto e non conteggiato (non conta il valore zero delle calorie); torna a contribuire appena viene ricompilato. L'esclusione manuale è una scelta separata e resta anche quando si aggiungono o tolgono porzioni. Se nessun giorno è compilato e incluso, compare un messaggio al posto della media. Il pannello mostra su quanti giorni è calcolata la media.

