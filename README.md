# Gaetanata

Web app che sostituisce il foglio Excel "DIETA GAETANATA": calcolo del metabolismo del paziente, piano dieta settimanale (7 giorni × 6 pasti), totali e media dei nutrienti, stampa per il paziente.

## Avvio

È sufficiente scaricare lo ZIP del progetto ed estrarlo, oppure clonarlo con Git. Per clonare serve Git; su macOS, se manca, il sistema propone l'installazione degli strumenti da riga di comando. Il download ZIP non richiede Git.

- **Windows:** fai doppio clic su `avvia.cmd`.
- **macOS:** fai doppio clic su `avvia.command`. Al primo avvio macOS potrebbe bloccarlo, specialmente se il progetto proviene da uno ZIP scaricato dal browser: fai clic destro → **Apri**, oppure usa **Impostazioni di Sistema → Privacy e sicurezza → Apri comunque**.
- **Linux:** esegui `./avvia.sh` dal terminale.

Al primo avvio, se necessario, viene scaricato Node portabile; vengono poi installate le dipendenze e compilata l'app. Da quel momento usa l'icona **Gaetanata** con la «G»: sul Desktop e nel menu Start di Windows, oppure in `~/Applications` sul Mac (puoi trascinarla nel Dock). Dall'icona non compare il terminale, salvo quando occorre installare o ricompilare dopo un aggiornamento. Se sposti la cartella, avvia una volta `avvia.*` dalla nuova posizione per correggere le icone. Linux continua a usare il terminale.

Chiudi la finestra dell'app per fermarla: il server termina dopo circa 10 secondi. Le modifiche non salvate a piano e schema restano nella **bozza**; alla riapertura scegli **Ripristina** o **Scarta**. Il ripristino non sostituisce Salva. La scheda paziente non è coperta: premi **Salva scheda** prima di chiudere.

Se l'avvio dall'icona fallisce, un dialogo indica il file `data/avvio.log` da consultare o inviare a chi ti aiuta.

I dati sono salvati sul computer in `data/gaetanata.db`. Per un backup, chiudi l'app e copia l'intera cartella `data/`.

Gli ultimi 50 errori del server e dell'interfaccia e i fallimenti degli
Aggiornamenti restano in `data/errori.json`, nella stessa cartella del database
anche quando è configurata una cartella dati diversa. Il registro sopravvive ai
riavvii e conserva data, origine, messaggio e le prime sei righe dello stack,
senza corpi o parametri delle richieste né dati dei pazienti. Gli errori di
validazione e le richieste dell'interfaccia fallite per assenza di rete non
vengono registrati; il controllo iniziale della Versione resta silenzioso.
Un Aggiornamento già avviato che fallisce viene invece registrato anche se la
causa è la rete.
Se il registro non può essere scritto sul disco, l'operazione in corso non si
interrompe: gli errori restano in memoria e vengono salvati alla successiva
registrazione riuscita. Se l'app si chiude prima, queste voci non persistono.

All'avvio Gaetanata controlla in silenzio se è disponibile una versione più
recente e ne mostra le note nella finestra attiva. Il controllo non impedisce
l'avvio anche se la rete non è disponibile.

## Segnala problema

Premi **Segnala problema**, a piè di pagina accanto alla Versione, anche in una
finestra non attiva. Scrivi cosa è successo o cosa ti serve, senza inserire nomi
o dati dei pazienti. L'anteprima mostra il testo esatto e i **Dati tecnici**:
Versione, sistema operativo, installazione clone o ZIP, schermata aperta e ultimi
cinque errori del registro.

Il tasto compare anche nei messaggi delle operazioni non riuscite: lettura,
salvataggio ed eliminazione delle schede, caricamento e salvataggio di piano e
schema, lettura/ripristino/scarto/scrittura della bozza, template, generazione e
download del Word, lettura e aggiornamento dello storico, server non disponibile
e aggiornamento dell'app. Apre la stessa schermata con quell'errore prima degli
errori del registro. Per un aggiornamento non riuscito riporta anche la Versione
installata e quella non riuscita, anche dopo il ripristino; un launcher precedente
può non conoscere la Versione tentata. I nomi dei file Word non entrano nell'errore.
Le indicazioni per correggere i dati inseriti non sono errori operativi e non
mostrano il tasto.

Scegli **Invia con Gmail** per aprire una composizione nel browser, **Invia con il
programma di posta** per usare la posta del computer, oppure **Copia il testo**
per incollarlo dove preferisci. L'app prepara il messaggio per
`gaetanata.qualify006@simplelogin.com`, ma sei tu a inviarlo: non spedisce email
automaticamente e non allega file. Copia funziona anche senza rete.

Gli errori vengono abbreviati per mantenere l'indirizzo di posta entro circa
2.000 caratteri; l'anteprima, Gmail e Copia usano lo stesso testo abbreviato.
Se necessario vengono omessi anche gli altri dati tecnici, mai la Versione o
la descrizione. Una descrizione molto lunga può superare comunque il limite
del programma di posta: in quel caso usa Gmail o Copia.

## Aggiornamento

Quando compare un aggiornamento, leggi le note e premi **Installa aggiornamento** nella finestra attiva. Salva prima la scheda paziente; le modifiche al piano e allo schema restano nella bozza. La finestra mostra i passi e si ricarica da sola; puoi chiuderla e riaprire l'icona durante l'operazione. Il database viene copiato in `data/prima-di-aggiornamento.db` (nella cartella dati configurata), sovrascrivendo la copia precedente.

Se la nuova versione richiede un Node più recente, durante il riavvio può comparire un terminale per scaricarlo e preparare l'app.

Se l'aggiornamento non riesce, Gaetanata ripristina la versione precedente e mostra un avviso. Se la nuova versione non si avvia, ripristina anche la copia del database.

L'aggiornamento funziona sia per chi ha installato dallo ZIP sia per i clone Git puliti: se hai modificato file tracciati nel clone, contatta chi ti aiuta. Il clone viene portato sul tag della Versione con HEAD staccato. Nelle installazioni ZIP, tutti i file e le cartelle nella radice diversi da `data/`, `.runtime/`, `node_modules/`, `dist/` e `.aggiornamento/` vengono spostati nella cartella `.aggiornamento/precedente/`, sovrascritta al prossimo aggiornamento: conserva altrove i file personali. La prima versione con questo pulsante va installata a mano; il launcher già in memoria gestisce il successivo riavvio, quindi eventuali modifiche al launcher hanno effetto dall'aggiornamento seguente.

Per pubblicare una Versione, consulta le [istruzioni di sviluppo](docs/funzioni/sviluppo.md#pubblicare-una-versione).

## Documentazione

- [Piano settimanale](docs/funzioni/piano-settimanale.md): editor, scorciatoie, salvataggio e media dei nutrienti.
- [Schede pazienti](docs/funzioni/schede-pazienti.md): gestione delle schede e formule del metabolismo.
- [Schema](docs/funzioni/schema.md): calcolo, correzioni e riempimento del piano.
- [Documento Word](docs/funzioni/word.md): template locale, generazione e storico.
- [Dati di riferimento](docs/funzioni/dati-di-riferimento.md): importazione, categorie e misure casalinghe.
- [Sviluppo](docs/funzioni/sviluppo.md): comandi, verifiche e confine dei dati pubblicabili.
- [Glossario](GLOSSARY.md) e [decisioni di dominio](docs/adr/).

