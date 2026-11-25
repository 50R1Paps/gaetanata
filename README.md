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

