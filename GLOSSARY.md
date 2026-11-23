# Gaetanata

App locale che sostituisce il foglio Excel con cui una nutrizionista costruisce lo schema alimentare settimanale di un paziente e ne calcola nutrienti e metabolismo.

## Language

### Piano

**Porzione**:
Un alimento con una quantità in grammi dentro un pasto (`Portion`, `PlannedPortion`). Ogni porzione si somma alle altre del pasto.
_Avoid_: Voce, riga, dose

**Pasto**:
Uno dei sei momenti della giornata: Colazione, Spuntini, Pranzo, Merenda, Cena, Dopocena (`mealSlots`).
_Avoid_: Slot

**Giorno**:
I sei pasti di una giornata. Può essere escluso a mano dalla media; un giorno senza porzioni non conta (`PlannedDay`).

**Piano settimanale**:
I sette giorni inseriti a mano nell'editor libero, utile per controllare i totali (`WeekPlan`).
_Avoid_: Dieta, schema (lo Schema è un'altra cosa)

**Media settimanale**:
Media dei nutrienti sui soli giorni compilati e non esclusi (`weekAverage`).

### Quantità

**Sostituzione**:
Alimento alternativo a un altro, con quantità calcolata dai carboidrati del pasto e arrotondata ai 5 g più vicini. Se il valore calcolato differisce da quello scritto a mano nel Word, prevale il calcolo (ADR 0005).
_Avoid_: Equivalenza, scambio

**Alternativa**:
Alimento che il template Word propone al posto di un altro. Compaiono sempre tutte.

**Porzione fissa**:
Quantità uguale per tutti i pazienti, che non segue la regola delle sostituzioni: formaggio fresco 100 g e stagionato 50 g, uova 120 g, tonno in scatola 52 g (sgocciolato), legumi 50 g secchi o 150 g in scatola, affettati 80 g, frutta 150 g (2 al giorno), verdure almeno 200 g. Eccezioni scelte dalla nutrizionista: uova 180 g, tonno 78 g.

**Porzione variabile**:
Quantità decisa caso per caso. Carne rossa, carne bianca e pesce: la base la sceglie la nutrizionista, le altre seguono il rapporto fisso 100 : 130 : 150 g a crudo. Spuntini: dimensionati a mano. Olio: 30 ml al giorno fissi.

**Anamnesi alimentare**:
Abitudini alimentari del paziente; se lo richiede, cambiano gli alimenti dello schema (di solito cambiano solo le quantità).

### Schema

**Schema**:
Il piano settimanale nella forma del Word stampato, generato dall'app a partire da kcal, ripartizione e quantità, e poi corretto dalla nutrizionista (ADR 0006). Non è il Piano settimanale libero.

**Kcal dieta**:
Kcal giornaliere della dieta, scelte caso per caso partendo dal fabbisogno e inserite a mano.

**Fabbisogno**:
Metabolismo basale moltiplicato per il LAF; il LAF di partenza è 1,4, più alto per pazienti attivi o con lavoro manuale.

**Ripartizione**:
Divisione delle kcal dieta in macronutrienti (di solito 50/30/20 carboidrati, lipidi, proteine) e in percentuali per pasto, che dipendono dal numero di pasti (da 3 a 6).

**Giorno pizza**:
Giorno sempre presente nello schema, con pane 50 g e olio 10 ml come valori di partenza, raramente modificati.

**Fonte proteica**:
Alimento proteico (carne rossa, carne bianca, pesce, uova...) scelto per paziente per ogni giorno e pasto, senza rotazione fissa.

### Metabolismo

**Metabolismo basale**:
Kcal al giorno a riposo, calcolate con la formula scelta in base al BMI (`basalMetabolism`, vedi ADR 0002).
_Avoid_: BMR (solo nel codice)

**MET**:
Costo energetico di un'attività, moltiplicato per peso e durata dà le kcal dell'attività (`activityCalories`).

**LAF** (livello di attività fisica):
Kcal totali delle attività diviso metabolismo basale (`activityLevel`).
_Avoid_: livello di attività

### Salvataggio

**Bozza**:
Copia automatica delle modifiche non salvate a piano settimanale e schema, separata da ciò che è salvato; ce n'è al massimo una, del paziente aperto o di nessun paziente. Non diventa mai il piano o lo schema del paziente finché non si preme Salva.
_Avoid_: Autosalvataggio, backup, copia di sicurezza
