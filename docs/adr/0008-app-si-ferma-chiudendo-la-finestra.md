# 8. L'app si ferma chiudendo la sua finestra

## Contesto

L'app si avviava da un terminale da lasciare aperto: chiudendolo si fermava il server. Chi la usa vuole un'icona sul Desktop o tra le Applicazioni, una finestra propria e nessun terminale.

## Decisione

L'icona avvia il server senza terminale e apre l'app in una finestra in modalità app di Edge o Chrome, altrimenti nel browser predefinito. Il terminale compare solo quando c'è da installare o compilare; un errore d'avvio è mostrato in una finestra di dialogo del sistema. Chiudendo, la finestra manda al server un segnale esplicito; il server si ferma se entro circa 10 secondi nessuna finestra si riapre, così un ricaricamento non lo ferma. Una sola finestra alla volta può modificare: le altre lo dicono e diventano attive quando la prima si chiude.

## Alternative considerate

- Fermare il server quando la finestra smette di dare segni di vita per un certo tempo: un portatile in stop smette di mandarli, e al risveglio il server si sarebbe fermato con la finestra ancora aperta.

## Conseguenze

Se il browser va in crash il server resta acceso; il doppio clic successivo lo riusa. Se il server si ferma con la finestra aperta, la finestra blocca le modifiche e rimanda all'icona: il lavoro fino a quel momento è nella bozza (ADR 0007). Le icone si ricreano a ogni avvio, quindi seguono la cartella del progetto se viene spostata; cancellando la cartella vanno tolte a mano.
