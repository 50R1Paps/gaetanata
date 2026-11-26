# 12. Obiettivo proteico sul peso di riferimento

## Contesto

Lo Schema calcolava i grammi di proteine per kg sul peso reale e sui tre pesi ideali del foglio (BMI 22,5, BMI 25, Lorenz), e avvisava per ciascuno quando il valore usciva da 1,2–1,4 g/kg. Con quattro risultati e fino a quattro avvisi, l'app non diceva quale contasse. La nutrizionista ha risposto nell'issue #18 (domande 5 e 6).

## Decisione

L'obiettivo di 1,2–1,4 g/kg si calcola su un solo peso, il **peso di riferimento**:

- paziente normopeso: peso reale;
- paziente in sovrappeso od obeso (BMI sopra 25): peso ideale con BMI 25, cioè 25 × altezza².

Le due regole coincidono a BMI 25, quindi il peso di riferimento è il minore tra il peso reale e il peso a BMI 25. Il paziente sottopeso usa il peso reale, in attesa di conferma (`docs/questionari/nutrizionista-3.md`, domanda 4).

## Conseguenze

Lo Schema mostra i g/kg e l'avviso fuori intervallo solo sul peso di riferimento, indicando quale dei due è. I g/kg sui pesi ideali BMI 22,5 e Lorenz non si mostrano più.
