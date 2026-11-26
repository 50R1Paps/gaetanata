# Criteri per il REVIEW agent

Applica questi criteri a ogni comportamento modificato. Per le regole meccaniche,
usa i [controlli automatici](docs/verifica.md) e la configurazione del progetto.

## Comportamento osservabile

Verifica i test alla giunzione più alta che esercita il comportamento reale:
interazione utente, risposta API o documento generato. Gli assert devono
rilevare un risultato errato per l'utente, non ripetere l'implementazione.
Escludi test echo/wiring e confronti costante-con-la-stessa-costante: una chiamata
inoltrata correttamente non dimostra che il risultato sia corretto.

## Percorso completo degli input

Per ogni input salvato dall'utente, segui il dato fino a tutti gli output
pertinenti: schermata, piano settimanale e Word. Controlla anche riapertura e
correzioni manuali; un valore accettato e persistito ma ignorato a valle è un bug.

## Decisioni di dominio

Ogni regola di dominio introdotta o cambiata deve citare una decisione confermata
in un ADR o in un'issue. Mantieni esplicite le contraddizioni tra fonti e i punti
aperti: formule, valori predefiniti e convenzioni non diventano decisioni solo
perché compaiono in un documento o nel codice.

## Confine pubblico

Applica [ADR 0003](docs/adr/0003-template-word-letto-da-file-locale.md) anche dove
il gate non può riconoscere il contenuto: testi copiati, fixture, screenshot,
log e descrizioni delle modifiche possono rivelare identità o dati clinici.
Usa dati fittizi e template sintetici; nessun estratto riconoscibile di pazienti,
professionisti o istituti deve entrare nel repository o nei servizi esterni.
Controlla il significato dei dati, non soltanto l'estensione dei file.

I messaggi d'errore di operazioni fallite finiscono nel registro degli errori e
nelle segnalazioni ([ADR 0011](docs/adr/0011-segnalazione-via-email.md)): citano
al massimo id numerici, mai nomi, misure o contenuti di piano e schema. Gli errori
di validazione mostrati per correggere un campo possono nominare giorno, pasto e
alimento, perché non escono dall'app.

## Pattern esistenti

Riusa i pattern già presenti per lo stesso problema. Una nuova convenzione o
astrazione deve risolvere un limite concreto che quella esistente non copre;
valuta il costo di mantenere due modi diversi di fare la stessa cosa.
