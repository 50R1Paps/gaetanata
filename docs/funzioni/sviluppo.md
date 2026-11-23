# Sviluppo

[Indice della documentazione](../../README.md#documentazione)

Per sviluppare, con Node 22.13 o successivo installato:

```sh
npm install
npm run dev      # server di sviluppo
npm run check    # typecheck + lint
npm test         # test
```

L'avvio con `npm start` o `avvia.*` usa `scripts/start.ts`, che carica solo
moduli nativi, installa le dipendenze e prepara l'interfaccia. Solo dopo avvia
`scripts/serve.ts` con lo stesso Node e gli stessi flag: il server eredita
ambiente e console, segnala quando è pronto e si ferma anche se il launcher
viene chiuso. Il browser si apre dopo la risposta di `/api/health`.

## Icone e avvio senza terminale

`avvia.cmd` rigenera i collegamenti usando le cartelle Desktop e Programs del
sistema (anche con OneDrive). Il collegamento esegue `wscript.exe` con
`scripts/avvia.vbs`: un host grafico avvia PowerShell con stile finestra 0,
prima della creazione della console, evitando il flash di `-WindowStyle Hidden`.
Su macOS `avvia.sh` rigenera `~/Applications/Gaetanata.app`; Linux non crea icone.

Il bootstrap controlla Node; `scripts/start.ts --check-setup` restituisce 10
se dipendenze o build non corrispondono ai timbri, 0 se sono pronte. Condivide
hash e criteri con l'avvio normale, includendo gli asset pubblici. Se serve
preparazione, l'icona riapre `avvia.*` in un terminale visibile; altrimenti
registra l'output in `GAETANATA_DATA_DIR/avvio.log` (predefinito `data/`) e
mostra gli errori in un dialogo del sistema.

`node --experimental-strip-types scripts/generate-icons.ts` rigenera PNG,
ICO, ICNS e favicon senza dipendenze aggiuntive. Il workflow dei launcher
verifica i file generati, avvia collegamenti/bundle e registra e chiude una
finestra sintetica via API, aspettando la fine del launcher e del server.

## Finestre e spegnimento

Una sola finestra può modificare i documenti e scrivere o cancellare la bozza;
le altre attendono e propongono il ripristino solo quando diventano attive.
Ogni finestra segnala la presenza ogni 5 secondi. Dopo circa 15 secondi senza
presenza un'altra finestra può diventare attiva, ma il server non si spegne:
stop del portatile e crash del browser non sono segnali di chiusura (ADR 0008).
Le registrazioni scadute vengono rimosse quando arriva una presenza o una
chiusura esplicita: una finestra andata in crash non impedisce lo spegnimento
quando si chiude quella riaperta. La sola pulizia non avvia mai l'attesa.

Su `pagehide` la finestra invia `POST /api/window/close` con `fetch` e
`keepalive`, allegando l'ultima bozza senza aspettare il ritardo di un secondo.
Il server la scrive prima di liberare il posto. `draft: null` elimina una
bozza ormai senza modifiche; senza `draft` lascia intatta la copia esistente,
anche mentre il ripristino attende una scelta. Non c'è un avviso `beforeunload`.

Dopo la chiusura esplicita dell'ultima finestra registrata, il server attende
10 secondi: una registrazione nel frattempo annulla lo spegnimento, permettendo
di ricaricare la pagina. `startServer` espone `idleGraceMs` per accorciare
l'attesa nei test e la callback facoltativa `onIdle`. `scripts/serve.ts` usa
`onIdle` per chiudere il server e terminare il processo; sviluppo e test che
non la passano restano accesi. Il timer viene cancellato alla chiusura del server.

Per avvii isolati, `GAETANATA_DATA_DIR` seleziona una cartella dati alternativa
in `scripts/serve.ts`; `PORT` sceglie la porta e `GAETANATA_NO_BROWSER=1`
evita l'apertura del browser. Usare una cartella temporanea e dati sintetici.

## Dati

Il foglio originale contiene dati di pazienti reali. Il repository è pubblico: non committare mai file Excel/CSV (sono esclusi in `.gitignore`) né dati che identificano una persona. Tabelle di riferimento (alimenti, attività MET) possono entrare nel repo; i dati dei pazienti no.

## Verifiche

Per la procedura completa, consulta [Verifica](../verifica.md).

