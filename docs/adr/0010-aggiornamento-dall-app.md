# 10. Aggiornamento dall'app

## Contesto

Chi usa l'app non sa usare git né il terminale, ma deve poter installare da sola le nuove versioni e vedere che l'aggiornamento è in corso. Gaetanata si installa in due modi: clonando il repo, come la nutrizionista, oppure scaricando lo ZIP da GitHub, senza Git (README). Il tasto deve funzionare in entrambi i casi.

## Decisione

- Si aggiorna solo a una versione pubblicata come Release GitHub, il cui tag coincide con `version` in `package.json`. La CI verifica che coincidano. I merge su `main` non arrivano a chi usa l'app.
- A ogni avvio l'app controlla l'ultima Release. Se è più recente mostra "Aggiornamento disponibile" con le note della Release e il tasto "Installa aggiornamento", solo nella finestra che può modificare. Senza rete il controllo viene saltato in silenzio.
- Il tasto si rifiuta di partire se la scheda paziente ha modifiche non salvate. Piano e schema restano coperti dalla bozza (ADR 0007).
- Il passo "metti i file nuovi al loro posto" ha due strade:
  - nei clone fa `git checkout` del tag e si rifiuta di partire se ci sono file tracciati modificati;
  - negli ZIP scarica l'archivio della Release, sposta i file dell'app in `.aggiornamento/precedente/` e copia quelli nuovi.
- Tutto il resto è comune: copia del database (ADR 0009), installazione delle dipendenze, preparazione dell'interfaccia, riavvio. La finestra mostra i passi, poi si ricarica sulla nuova versione. Durante l'aggiornamento il server non si ferma alla chiusura della finestra (eccezione all'ADR 0008).
- Se la nuova versione non parte, l'app torna alla versione e al database di prima e lo dice.
- Se la nuova versione richiede un Node più recente, il riavvio passa dal launcher completo, e per quella volta può comparire il terminale.

## Alternative considerate

- `git pull` per tutti: non funziona per chi ha scaricato lo ZIP, che il README presenta come installazione senza Git.
- Archivio per tutti: un solo meccanismo da scrivere, ma i clone restano con i file cambiati rispetto al commit, e un `git pull` successivo fa conflitto.
- Aggiornare all'ultimo commit di `main`: farebbe arrivare a chi usa l'app modifiche non ancora pronte.
- Tasto sempre visibile, con controllo solo su richiesta: lei non saprebbe mai che c'è qualcosa da installare.

## Conseguenze

Ogni versione da distribuire richiede una Release con note scritte per chi usa l'app. La prima versione con il tasto va portata a mano: `git pull` sui clone, nuovo download per gli ZIP. Ci sono due strade di sostituzione dei file da testare.
