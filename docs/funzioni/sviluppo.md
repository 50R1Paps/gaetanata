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

## Dati

Il foglio originale contiene dati di pazienti reali. Il repository è pubblico: non committare mai file Excel/CSV (sono esclusi in `.gitignore`) né dati che identificano una persona. Tabelle di riferimento (alimenti, attività MET) possono entrare nel repo; i dati dei pazienti no.

## Verifiche

Per la procedura completa, consulta [Verifica](../verifica.md).

