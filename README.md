# Gaetanata

Web app che sostituisce il foglio Excel "DIETA GAETANATA": calcolo del metabolismo del paziente, piano dieta settimanale (7 giorni × 6 pasti), totali e media dei nutrienti, stampa per il paziente.

## Avvio

È sufficiente scaricare lo ZIP del progetto ed estrarlo, oppure clonarlo con Git. Per clonare serve Git; su macOS, se manca, il sistema propone l'installazione degli strumenti da riga di comando. Il download ZIP non richiede Git.

- **Windows:** fai doppio clic su `avvia.cmd`.
- **macOS:** fai doppio clic su `avvia.command`. Al primo avvio macOS potrebbe bloccarlo, specialmente se il progetto proviene da uno ZIP scaricato dal browser: fai clic destro → **Apri**, oppure usa **Impostazioni di Sistema → Privacy e sicurezza → Apri comunque**.
- **Linux:** esegui `./avvia.sh` dal terminale.

Al primo avvio, se necessario, viene scaricato Node portabile; vengono poi installate le dipendenze e compilata l'app. Gli avvii successivi riutilizzano quanto già installato e ricompilano solo se necessario. Lascia aperta la finestra per usare l'app; chiudila per fermarla.

I dati sono salvati sul computer in `data/gaetanata.db`. Per un backup, chiudi l'app e copia l'intera cartella `data/`.

## Documentazione

- [Piano settimanale](docs/funzioni/piano-settimanale.md): editor, scorciatoie, salvataggio e media dei nutrienti.
- [Schede pazienti](docs/funzioni/schede-pazienti.md): gestione delle schede e formule del metabolismo.
- [Schema](docs/funzioni/schema.md): calcolo, correzioni e riempimento del piano.
- [Documento Word](docs/funzioni/word.md): template locale, generazione e storico.
- [Dati di riferimento](docs/funzioni/dati-di-riferimento.md): importazione, categorie e misure casalinghe.
- [Sviluppo](docs/funzioni/sviluppo.md): comandi, verifiche e confine dei dati pubblicabili.
- [Glossario](GLOSSARY.md) e [decisioni di dominio](docs/adr/).

