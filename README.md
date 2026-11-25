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

All'avvio Gaetanata controlla in silenzio se è disponibile una versione più
recente e ne mostra le note nella finestra attiva. Il controllo non impedisce
l'avvio anche se la rete non è disponibile.

## Aggiornamento

Quando compare un aggiornamento, leggi le note e premi **Installa aggiornamento** nella finestra attiva. Salva prima la scheda paziente; le modifiche al piano e allo schema restano nella bozza. La finestra mostra i passi e si ricarica da sola; puoi chiuderla e riaprire l'icona durante l'operazione. Il database viene copiato in `data/prima-di-aggiornamento.db` (nella cartella dati configurata), sovrascrivendo la copia precedente.

Per ora l'installazione dall'app funziona sui clone Git puliti: se hai modificato file tracciati, contatta chi ti aiuta. Il clone viene portato sul tag della Versione con HEAD staccato. Per le installazioni ZIP l'aggiornamento dall'app non è ancora disponibile. La prima versione con questo pulsante va installata a mano; il launcher già in memoria gestisce il successivo riavvio, quindi eventuali modifiche al launcher hanno effetto dall'aggiornamento seguente.

## Pubblicare una Versione

Aggiorna `version` in `package.json` e `package-lock.json`, poi crea e pubblica un tag `vX.Y.Z` che coincida con quella versione (per esempio `v0.1.0` per `0.1.0`). Attendi il successo della CI sul tag: il controllo fallisce se tag e package non coincidono. Pubblica quindi una Release GitHub per quel tag, con note in italiano che descrivano le novità per chi usa l'app. I soli merge su `main` non costituiscono una Versione pubblicata.

## Documentazione

- [Piano settimanale](docs/funzioni/piano-settimanale.md): editor, scorciatoie, salvataggio e media dei nutrienti.
- [Schede pazienti](docs/funzioni/schede-pazienti.md): gestione delle schede e formule del metabolismo.
- [Schema](docs/funzioni/schema.md): calcolo, correzioni e riempimento del piano.
- [Documento Word](docs/funzioni/word.md): template locale, generazione e storico.
- [Dati di riferimento](docs/funzioni/dati-di-riferimento.md): importazione, categorie e misure casalinghe.
- [Sviluppo](docs/funzioni/sviluppo.md): comandi, verifiche e confine dei dati pubblicabili.
- [Glossario](GLOSSARY.md) e [decisioni di dominio](docs/adr/).

