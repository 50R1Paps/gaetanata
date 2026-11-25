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

## Pubblicare una Versione

Aggiorna `version` in `package.json` e `package-lock.json`, poi crea e pubblica un tag `vX.Y.Z` che coincida con quella versione (per esempio `v0.1.0` per `0.1.0`). Attendi il successo della CI sul tag: il controllo fallisce se tag e package non coincidono. Pubblica quindi una Release GitHub per quel tag, con note in italiano che descrivano le novità per chi usa l'app. I soli merge su `main` non costituiscono una Versione pubblicata.

Il campo `engines.node` deve essere un minimo nel formato `>=X.Y.Z`; `.nvmrc` sceglie la versione portabile da scaricare.

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
L'aspetto della finestra dedicata e dei dialoghi d'errore si verifica a mano
su Windows e macOS; i test automatici della scelta del browser verificano
la politica (browser disponibili e ripiego), non le chiamate a `spawn`.

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

Dopo la chiusura esplicita della finestra attiva, se non restano altre finestre
con presenza recente, il server attende 10 secondi: una registrazione nel
frattempo annulla lo spegnimento, permettendo di ricaricare la pagina.
`startServer` espone `idleGraceMs` per accorciare
l'attesa nei test e la callback facoltativa `onIdle`. `scripts/serve.ts` usa
`onIdle` per chiudere il server e terminare il processo; sviluppo e test che
non la passano restano accesi. Il timer viene cancellato alla chiusura del server.

Per sviluppo e CI, `GAETANATA_DATA_DIR` seleziona una cartella dati alternativa
in `scripts/serve.ts` (e per il log del launcher), senza cambiare il percorso
predefinito `data/`. `PORT` sceglie la porta e `GAETANATA_NO_BROWSER=1`
evita l'apertura del browser. Usare una cartella temporanea e dati sintetici;
questa opzione serve agli avvii isolati, non alla configurazione ordinaria.

## Dati

Il foglio originale contiene dati di pazienti reali. Il repository è pubblico: non committare mai file Excel/CSV (sono esclusi in `.gitignore`) né dati che identificano una persona. Tabelle di riferimento (alimenti, attività MET) possono entrare nel repo; i dati dei pazienti no.

## Verifiche

Per la procedura completa, consulta [Verifica](../verifica.md).

