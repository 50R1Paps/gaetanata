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
I sette giorni dello schema di un paziente (`WeekPlan`).
_Avoid_: Dieta, schema (lo "schema" è il documento Word stampato)

**Media settimanale**:
Media dei nutrienti sui soli giorni compilati e non esclusi (`weekAverage`).

### Quantità

**Sostituzione**:
Alimento alternativo a un altro con le stesse kcal, con quantità arrotondata a multipli di 10 g. Se foglio Excel e schema Word differiscono, vale il Word.
_Avoid_: Equivalenza, scambio

**Porzione fissa**:
Quantità che non segue la regola delle sostituzioni: formaggio 100 g, uova 120 g, tonno in scatola 52 g, legumi secchi 50 g, affettati 80 g. Se valga per qualsiasi apporto calorico è da confermare (issue #4).

**Porzione variabile**:
Quantità decisa caso per caso: carne rossa, carne bianca, pesce, spuntini. Le regole di dimensionamento non sono ancora note (issue #4, #5).

### Metabolismo

**Metabolismo basale**:
Kcal al giorno a riposo, calcolate con la formula scelta in base al BMI (`basalMetabolism`, vedi ADR 0002).
_Avoid_: BMR (solo nel codice)

**MET**:
Costo energetico di un'attività, moltiplicato per peso e durata dà le kcal dell'attività (`activityCalories`).

**LAF** (livello di attività fisica):
Kcal totali delle attività diviso metabolismo basale (`activityLevel`).
_Avoid_: livello di attività
