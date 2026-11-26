# Verifica automatica

- `npm run verify`: esegue check, test, build e smoke in sequenza, con output
  integrale; si ferma al primo errore e ne conserva il codice di uscita.
- `npm run check`: typecheck, Biome (anche plugin GritQL), regole import e privacy.
- `npm run check:imports`: vieta costruttori Promise e import dinamici in
  src/server/scripts; in server/scripts gli import relativi richiedono `.ts`
  oppure `.json` con `with { type: "json" }`. Vale anche per i re-export.
  `scripts/start.ts` può importare soltanto moduli `node:`, così l'avvio da
  clone pulito non carica dipendenze prima di `npm ci`.
- `npm run check:public`: controlla file tracciati, estensioni sensibili,
  percorsi personali e accessi alla home nei test. Nessuna allowlist.
- `.private-patterns` è facoltativo, locale e ignorato da Git: una parola o frase
  letterale per riga, senza distinzione maiuscole/minuscole, con confini Unicode;
  righe vuote e commenti iniziali `#` sono ignorati. Non usare dati reali nei test.
  Se manca, il controllo privato viene saltato con avviso. Gli errori riportano
  solo file, riga e testo trovato, non l'elenco privato.
- `npm run prepare`: installa il pre-commit senza dipendenze aggiuntive;
  salta CI e installazioni ZIP senza Git. L'hook controlla i byte nell'indice,
  anche quando la copia di lavoro differisce.
- `npm run smoke`: Node nativo con type stripping, server reale su porta libera,
  paziente/schema fittizi, template sintetico e generazione DOCX. Database e
  documenti restano in una directory temporanea, rimossa all'uscita; mai in `data/`.

I test dei gate creano fixture temporanee, provano violazioni intenzionali e le
rimuovono. La CI esegue verify dopo un'installazione pulita: stderr npm resta
visibile e un avviso di dipendenza deprecata rende rosso il job, senza mascherare
un eventuale codice d'errore npm. La privacy automatica non sostituisce la
revisione dei dati da pubblicare.

I test delle finestre avanzano esplicitamente Date e timer fittizi, con HTTP reale,
e attendono `onIdle` tramite promise, senza ritardi reali contro limiti brevi.
I test CLI hanno 15 s locali per avviare processi reali, senza aumentare il timeout globale.

## Isolamento dei test dell'interfaccia

Vitest esegue prima i test Node (fino a quattro worker), poi quelli `.test.tsx`
in un solo worker jsdom, mantenendo l'isolamento fra file. Non eseguire i due
gruppi contemporaneamente: query sul DOM e rendering React competono per la CPU
con gli altri DOM e con i sottoprocessi CLI. I timeout restano a 5 s.

Diagnosi #51: la suite iniziale ha prodotto cinque timeout in `SchemaScreen`;
lo stesso file isolato è passato, con test da 0,3–1,1 s. Un profilo CPU del file
ha attribuito circa 4,4 s su 10,9 s alle query per etichetta e 3,4 s al rendering
React (tempi inclusivi, non sommabili): lavoro CPU, non attese di rete.

Un timeout di Vitest non cancella la promise del test. Se avviene dentro un
`act` asincrono, React conserva la coda aperta: anche dopo `cleanup()` il test
successivo può trovare soltanto `<body><div /></body>`. La regressione
`src/testIsolation.test.tsx` forza questa condizione e verifica che il test
seguente riesca ancora a montare e modificare un campo.

Nei test usare `asyncAct` da `src/testSetup.ts` per gli scope `act` asincroni.
Il setup traccia anche il wrapper di user-event e delle query asincrone:
attende gli scope già iniziati e interrompe la continuazione del test scaduto,
prima di smontare componenti, ripristinare timer o rimuovere stub. Per questo
gli hook dell'interfaccia sono in ordine di registrazione (`hooks: "list"`).
Il drain ha il limite degli hook di Vitest: non rende risolvibile una promise
che non termina mai.
