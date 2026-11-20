# Gaetanata

Web app che sostituisce il foglio Excel "DIETA GAETANATA": calcolo del metabolismo del paziente, piano dieta settimanale (7 giorni × 6 pasti), totali e media dei nutrienti, stampa per il paziente.

## Avvio

Serve Node 22.12 o successivo (la CI usa la versione in `.nvmrc`).

```sh
npm install
npm run dev      # server di sviluppo
npm run check    # typecheck + lint
npm test         # test
npm run build    # build di produzione in dist/
```

## Dati

Il foglio originale contiene dati di pazienti reali. Il repository è pubblico: non committare mai file Excel/CSV (sono esclusi in `.gitignore`) né dati che identificano una persona. Tabelle di riferimento (alimenti, attività MET) possono entrare nel repo; i dati dei pazienti no.

## Domande aperte per il nutrizionista

Il foglio Excel ha formule in conflitto o con buchi. Vanno confermate prima di portarle nel codice:

1. **Bernstein, maschio**: in "Calcolo metabolismo" è `11.02·peso − 0.47·altezza − 4.3·età + 889`, in "Elenco pz" è `11.02·peso + 10.23·altezza − 5.8·età − 1032`. Quale è corretta?
2. **Harris-Benedict**: coefficienti arrotondati (`66.5 + 13.75·peso …`) in un foglio, completi (`66.473 + 13.7516·peso …`) nell'altro. Quali usare?
3. **Scelta automatica della formula** in base al BMI: con BMI tra 25,1 e 25,2 o tra 30,1 e 30,2 non viene scelta nessuna formula. I limiti giusti sono BMI ≤ 25 → Harris-Benedict, 25–30 → Mifflin, > 30 → Bernstein?
4. **"Eq. Giuseppe"**: da dove viene questa formula, ed è da tenere?
5. **Unità in stampa**: latte e olio vanno in ml, il resto in g? Altri alimenti in ml?
