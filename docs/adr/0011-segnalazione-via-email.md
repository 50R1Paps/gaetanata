# 11. Segnalazione via email

## Contesto

Chi usa l'app deve poter segnalare un problema o chiedere qualcosa a chi la sviluppa, senza terminale né account tecnici, allegando i dati tecnici che servono a capire l'errore. Il repo è pubblico e l'app tratta dati sanitari dei pazienti.

## Decisione

La segnalazione è un'email che l'app prepara e chi usa l'app invia: con Gmail nel browser, con il programma di posta (`mailto:`) oppure copiando il testo. Il testo contiene la descrizione scritta da chi segnala e i dati tecnici (versione, sistema, tipo di installazione, schermata, ultimi errori), tutti visibili prima dell'invio. Non contiene mai dati dei pazienti, né allegati. Il destinatario è un alias email dedicato, scritto nel codice e quindi pubblico.

## Alternative considerate

- Issue GitHub: il repo è pubblico, chi usa l'app non ha un account, e una descrizione libera può contenere dati di un paziente.
- Servizio proprio che riceve le segnalazioni: nessun passaggio per chi segnala, ma richiede infrastruttura da mantenere e una credenziale dentro un'app pubblica.
- File di segnalazione da inviare a mano: resta disponibile come "Copia il testo", ma da solo chiede troppi passaggi.

## Conseguenze

La segnalazione richiede che chi usa l'app abbia una casella email e, per Gmail, la rete. La lunghezza degli indirizzi precompilati limita i dati tecnici agli ultimi errori. Se l'alias riceve spam si sostituisce con una nuova versione.
