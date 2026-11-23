# 7. Bozza di recupero invece del salvataggio automatico

## Contesto

Chiudendo per sbaglio la finestra dell'app si perdevano le modifiche non salvate a piano settimanale e schema: l'unica protezione era l'avviso del browser, che contrasta con un'app che si ferma chiudendo la finestra (ADR 0008).

## Decisione

Il salvataggio resta esplicito. Mentre si lavora, l'app scrive una sola bozza nel database locale, separata dal piano e dallo schema salvati, con i soli documenti modificati. Alla riapertura propone **Ripristina** o **Scarta**; ciò che è ripristinato resta non salvato finché non si preme Salva. La bozza sparisce quando non c'è più niente da salvare e non scade mai. L'avviso del browser alla chiusura viene tolto.

## Alternative considerate

- Salvataggio automatico di ogni modifica: toglie la possibilità di scartare le modifiche e non copre il piano compilato prima di scegliere il paziente.
- Bozza nel browser (localStorage): resta fuori da `data/`, quindi sfugge al backup, e si perde cambiando browser o profilo.

## Conseguenze

Il modulo della scheda paziente non è coperto dalla bozza: ha pochi campi e una propria conferma. La bozza riguarda il paziente aperto, quindi due finestre non possono modificare insieme (ADR 0008).
