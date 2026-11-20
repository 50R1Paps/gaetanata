# 4. Sostituzioni calcolate e arrotondate per difetto

## Contesto

Nello schema Word ogni alimento ha alternative con le stesse kcal. Le quantità del Word sono scritte a mano e a volte si discostano dal calcolo per comodità di pesata: 300 g di patate invece di 350 g. La nutrizionista ha chiarito di persona (issue #2, #4) che la regola è il calcolo e che lei corregge il Word solo se glielo si segnala.

## Decisione

L'app calcola le sostituzioni a parità di kcal e arrotonda per difetto ai 10 g, compresa la porzione di partenza (per esempio la pasta). Il risultato può differire dai valori scritti a mano nel Word (350 g contro 300 g di patate): vale il calcolo.

Carne bianca e pesce non sono sostituzioni per kcal: derivano dalla quantità di carne rossa con rapporto fisso, 1,3 per la carne bianca e 1,5 per il pesce (100 g : 130 g : 150 g, a crudo). La quantità base di carne rossa la inserisce la nutrizionista.

## Alternative considerate

- Valori standard scritti a mano per ogni alimento: rispecchiano il Word, ma vanno mantenuti uno per uno e non seguono le kcal del paziente.
- Una tabella di quantità fisse per alimento: stesso difetto, e nasconde la regola che la nutrizionista dichiara di seguire.

## Conseguenze

Le quantità dell'app e quelle del Word possono non coincidere; se la nutrizionista segnala una differenza, la correzione si fa a mano nel piano e non cambia la regola. Restano fuori da questa regola i grassi (olio), il cui arrotondamento è ancora da chiarire (issue #18).
