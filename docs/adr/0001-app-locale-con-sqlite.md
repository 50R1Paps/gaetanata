# 1. App locale con SQLite

## Contesto

L'app deve avviarsi con un solo comando, senza server remoto, mantenendo i dati dei pazienti sul computer dell'utente.

## Decisione

Un server Node locale, in ascolto solo su `127.0.0.1`, serve l'interfaccia e le API e usa SQLite integrato tramite `node:sqlite`. I launcher scaricano Node portabile se manca una versione di sistema adatta.

## Conseguenze

La connessione a Internet è necessaria solo al primo avvio, per scaricare ciò che manca, e successivamente per eventuali aggiornamenti. `node:sqlite` è sperimentale in Node 22; fissiamo la versione maggiore scaricata in `.nvmrc`. Il backup consiste nel copiare la cartella `data/` ad applicazione chiusa.
