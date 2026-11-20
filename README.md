# Gaetanata

Web app che sostituisce il foglio Excel "DIETA GAETANATA": calcolo del metabolismo del paziente, piano dieta settimanale (7 giorni × 6 pasti), totali e media dei nutrienti, stampa per il paziente.

## Avvio

È sufficiente scaricare lo ZIP del progetto ed estrarlo, oppure clonarlo con Git. Per clonare serve Git; su macOS, se manca, il sistema propone l'installazione degli strumenti da riga di comando. Il download ZIP non richiede Git.

- **Windows:** fai doppio clic su `avvia.cmd`.
- **macOS:** fai doppio clic su `avvia.command`. Al primo avvio macOS potrebbe bloccarlo, specialmente se il progetto proviene da uno ZIP scaricato dal browser: fai clic destro → **Apri**, oppure usa **Impostazioni di Sistema → Privacy e sicurezza → Apri comunque**.
- **Linux:** esegui `./avvia.sh` dal terminale.

Al primo avvio, se necessario, viene scaricato Node portabile; vengono poi installate le dipendenze e compilata l'app. Gli avvii successivi riutilizzano quanto già installato e ricompilano solo se necessario. Lascia aperta la finestra per usare l'app; chiudila per fermarla.

I dati sono salvati sul computer in `data/gaetanata.db`. Per un backup, chiudi l'app e copia l'intera cartella `data/`.

Per sviluppare, con Node 22.13 o successivo installato:

```sh
npm install
npm run dev      # server di sviluppo
npm run check    # typecheck + lint
npm test         # test
```

## Dati

Il foglio originale contiene dati di pazienti reali. Il repository è pubblico: non committare mai file Excel/CSV (sono esclusi in `.gitignore`) né dati che identificano una persona. Tabelle di riferimento (alimenti, attività MET) possono entrare nel repo; i dati dei pazienti no.

## Dati di riferimento

I file `src/data/foods.json` e `src/data/met.json` provengono esclusivamente dai fogli «Elenco Alimenti» e «MET» del file Excel originale. I valori nutrizionali sono riferiti a 100 g; valori mancanti, errori e valori testuali incerti sono importati come `null` e trattati come zero nei totali, come nel foglio.

Per rigenerarli senza includere dati dei pazienti:

```sh
npm run import:tables -- "percorso/al/file.xlsx"
```

## Formule del metabolismo

Decisioni prese (issue #1):

- **Scelta automatica della formula** in base al BMI: BMI ≤ 25 → Harris-Benedict, 25 < BMI ≤ 30 → Mifflin, BMI > 30 → Bernstein.
- **"Eq. Giuseppe"**: tolta, non viene implementata.
- **Unità in stampa**: latte e olio in ml, tutto il resto in g.

Ancora da confermare con il nutrizionista:

1. **Bernstein, maschio**: in "Calcolo metabolismo" è `11.02·peso − 0.47·altezza − 4.3·età + 889`, in "Elenco pz" è `11.02·peso + 10.23·altezza − 5.8·età − 1032`. Quale è corretta?
2. **Coefficienti arrotondati o completi**: Harris-Benedict è `66.5 + 13.75·peso …` in un foglio e `66.473 + 13.7516·peso …` nell'altro; Mifflin è `10·peso + 6.25·altezza − 5·età` in un foglio e `9.99·peso + 6.25·altezza − 4.92·età` nell'altro. Quali usare?
