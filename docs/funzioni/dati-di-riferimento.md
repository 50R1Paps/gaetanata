# Dati di riferimento

[Indice della documentazione](../../README.md#documentazione)

## Dati di riferimento

I file `src/data/foods.json` e `src/data/met.json` provengono esclusivamente dai fogli «Elenco Alimenti» e «MET» del file Excel originale. I valori nutrizionali sono riferiti a 100 g; valori mancanti, errori e valori testuali incerti sono importati come `null` e trattati come zero nei totali, come nel foglio.

Per rigenerarli senza includere dati dei pazienti:

```sh
npm run import:tables -- "percorso/al/file.xlsx"
```

L'importazione legge direttamente l'archivio XLSX con PizZip e il relativo XML,
senza ExcelJS. Le formule usano il risultato salvato nel file: ricalcolare e
salvare il foglio in Excel prima di importarlo se le formule sono cambiate.

### Categorie dello Schema e misure casalinghe

`src/data/food-schema.json` estende i dati di riferimento senza cambiare il
formato nutrizionale di `foods.json`: contiene le categorie, le sette misure
casalinghe e un'assegnazione per ogni nome alimento esatto. Il nome è già
l'identificativo usato dal Piano settimanale. `import:tables` non tocca questo
file: le assegnazioni non vengono perse rigenerando gli alimenti dall'Excel.
I test confrontano entrambi gli elenchi e segnalano alimenti nuovi, rinominati
o eliminati, così l'importazione richiede una revisione esplicita.

Ogni assegnazione ha `categoryId` (oppure `null`, senza categoria),
`uncertain` (dubbio esplicito), `note` e `measureIds`. Le dieci fonti proteiche
sono distinte; latte e yogurt hanno categorie separate. Non risultano alimenti
inequivocabilmente in scatola nella categoria legumi: «Ceci» resta senza
categoria finché non si chiarisce la preparazione.

Tutte le assegnazioni sono proposte da revisionare, non approvazioni cliniche.
Le preparazioni ambigue, i prodotti speciali e gli alimenti composti non sono
assimilati automaticamente alle porzioni dello Schema. Le misure sono
convenzioni del Word, non pesi effettivi delle confezioni; i ml restano ml,
senza conversione implicita in grammi.

L'[elenco di revisione](../revisione-alimenti-schema.md) contiene tutti gli
alimenti, le misure e i dubbi. Dopo una modifica dei dati rigenerarlo con:

```sh
npm run export:food-review --silent > docs/revisione-alimenti-schema.md
```

Il comando scrive Markdown su stdout, esportabile anche in un altro file.
In Windows PowerShell 5 usare `cmd /c "npm run export:food-review --silent > docs/revisione-alimenti-schema.md"`
per conservare UTF-8. Il test del generatore segnala un elenco non aggiornato.

