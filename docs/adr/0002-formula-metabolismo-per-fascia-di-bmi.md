# 2. Formula del metabolismo basale scelta per fascia di BMI

## Contesto

Il foglio Excel di partenza sceglieva già la formula del metabolismo basale in base al BMI, ma con limiti che lasciavano scoperti alcuni valori (BMI tra 25,1 e 25,2 o tra 30,1 e 30,2: nessuna formula), con coefficienti diversi tra un foglio e l'altro per Harris-Benedict e Bernstein, e con una formula in più, la "Eq. Giuseppe", di origine non documentata. Le scelte sono state confermate nella issue #1.

## Decisione

La formula è scelta automaticamente in base al BMI del paziente:

- BMI ≤ 25: Harris-Benedict (Harris & Benedict, 1918);
- 25 < BMI ≤ 30: Mifflin-St Jeor (Mifflin et al., 1990);
- BMI > 30: Bernstein (Bernstein et al., 1983).

Si usano i coefficienti completi delle pubblicazioni originali, non le versioni arrotondate (per Mifflin-St Jeor `9.99·P + 6.25·H − 4.92·A`, non `10·P + 6.25·H − 5·A`). La "Eq. Giuseppe" non viene implementata. Il calcolo vive in `src/calc/`; le formule complete sono nella sezione "Formule del metabolismo" del README.

## Conseguenze

Non esiste una scelta manuale della formula: chi vuole un risultato diverso deve cambiare le fasce, non un'opzione nell'interfaccia. Quando il BMI attraversa una soglia (25 o 30) il metabolismo basale può cambiare in modo discontinuo; è un effetto voluto della scelta per fasce.

Il coefficiente Bernstein femmina, `7.48·P − 0.42·H − 3.0·A + 844`, è quello del foglio originale ed è stato confermato dalla nutrizionista (issue #6); non è stato indicato un riferimento ufficiale ulteriore.
