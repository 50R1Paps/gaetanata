# 9. Copia del database prima di ogni aggiornamento

## Contesto

Chi usa l'app installa da sola le nuove versioni, e un aggiornamento non riuscito deve lasciarle la versione di prima funzionante. Le modifiche allo schema del database si applicano all'avvio della nuova versione, e una versione precedente si rifiuta di aprire un database già portato avanti: tornare al codice di prima non basta.

## Decisione

Prima di ogni aggiornamento l'app copia `data/gaetanata.db` in `data/prima-di-aggiornamento.db`, sovrascrivendo la copia precedente. Se la nuova versione non parte, l'app torna alla versione di prima e ripristina quella copia.

## Alternative considerate

- Nessuna copia: il ripristino funziona solo se l'aggiornamento fallisce prima che la nuova versione apra il database.
- Modifiche al database reversibili, con un passo inverso per ciascuna: più lavoro per ogni modifica e un rischio in più di sbagliare proprio nel caso raro.
- Tenere tutte le copie: la cartella `data/` cresce a ogni versione senza che nessuno le pulisca.

## Conseguenze

Il ripristino riporta il database a com'era subito prima dell'aggiornamento. Durante l'aggiornamento non si lavora, quindi non si perde nulla. La copia resta in `data/` e finisce nel backup che si fa copiando la cartella.
