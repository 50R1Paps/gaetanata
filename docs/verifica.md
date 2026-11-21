# Verifica automatica

- `npm run verify`: esegue check, test, build e smoke in sequenza, con output
  integrale; si ferma al primo errore e ne conserva il codice di uscita.
- `npm run check`: typecheck, Biome (anche plugin GritQL), regole import e privacy.
- `npm run check:imports`: vieta costruttori Promise e import dinamici in
  src/server/scripts; in server/scripts gli import relativi richiedono `.ts`
  oppure `.json` con `with { type: "json" }`. Vale anche per i re-export.
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
