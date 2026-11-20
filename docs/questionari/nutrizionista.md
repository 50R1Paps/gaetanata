# Regole di sostituzione, porzioni e formule dello schema alimentare

**Scopo:** capire con precisione come funziona oggi il foglio Excel e come viene compilato lo schema Word, così che l'app produca le stesse quantità che userebbe lei. Dalle risposte dipende se l'app calcola le quantità con una formula (e come le arrotonda) oppure se deve usare tabelle di valori fissi decise da lei.

**Da:** lo sviluppatore dell'app, **A:** la nutrizionista, **Come verranno usate le risposte:** diventeranno le regole di calcolo dell'app (equivalenze tra alimenti, arrotondamenti, porzioni di proteine e spuntini, formula del metabolismo) e determineranno come viene compilato automaticamente lo schema Word da stampare.

## Contesto

L'app sostituisce il foglio Excel che lei usa per costruire gli schemi. Alcune regole non sono scritte nel foglio, oppure il foglio e lo schema Word stampato danno numeri leggermente diversi. Per non indovinare, le chiediamo di dirci come ragiona lei.

## Come rispondere

Nessuna scadenza. Servono circa 15 minuti. Anche risposte parziali e "non lo so" sono utili: se ha un dubbio lo segnali, non lo salti. Può rispondere scrivendo sotto ogni domanda, dopo il simbolo `>`.

## Sostituzioni tra alimenti

Esempio usato in tutta questa sezione: 80 g di pasta di semola. Lo schema Word indica **100 g di pane** e **300 g di patate**. Il foglio Excel indica circa **110 g di pane** e **355 g di patate**. Con i valori nutrizionali che abbiamo nell'app, a parità di kcal verrebbe circa 102 g di pane bianco e 354 g di patate; a parità di carboidrati circa 98 g di pane e 333 g di patate.

### Su quale criterio si basa l'equivalenza tra due alimenti?

_Perché è importante: "uguali kcal" e "uguali carboidrati" danno quantità diverse, soprattutto per le patate._

- Uguali kcal
- Uguali carboidrati
- Nessuno dei due: uso valori presi da una tabella di equivalenze
- Altro (specificare)

>

### Come si arrotondano le quantità di sostituzione mostrate al paziente?

_Perché è importante: l'arrotondamento spiega perché lo schema Word riporta valori "tondi" (100 g, 300 g) mentre il calcolo darebbe 102 g, 354 g._

- A multipli di 10 g
- A multipli di 50 g
- Non si arrotonda in modo regolare, decido caso per caso
- Altro (specificare)

>

### Per l'esempio dei 80 g di pasta, perché lo schema Word indica 100 g di pane e 300 g di patate?

_Perché è importante: vogliamo capire se quei numeri nascono da un calcolo (con quale arrotondamento) o sono scelti a mano._

>

### Nel foglio Excel, la sostituzione del pane usa un coefficiente proprio?

_Perché è importante: con i valori nutrizionali che abbiamo, nessuna voce "pane" dà i circa 110 g del foglio (il pane bianco darebbe circa 102 g). Per le patate invece il foglio torna con il criterio delle kcal._

Se sì, quale coefficiente o quale criterio usa il foglio per il pane?

>

### Il foglio e lo schema Word devono dare gli stessi numeri, oppure è normale che differiscano?

Se differiscono volutamente, quale dei due vale per il paziente?

>

### Esiste una tabella di equivalenze dell'istituto con valori già fissati?

Se sì, può mandarcela? L'app potrebbe usare direttamente quella invece di calcolare.

>

## Porzioni: gnocchi e polenta

### Le quantità di gnocchi e polenta si calcolano con la stessa equivalenza degli altri carboidrati (pasta, pane, patate)?

_Perché è importante: nello schema stampato compaiono come alternativa ai carboidrati principali, ma non sappiamo se cambiano al variare della quantità di pasta._

- Sì, con la stessa regola e lo stesso arrotondamento delle altre sostituzioni
- No, sono fisse (una porzione standard), indipendenti dalla pasta
- Sono fisse ma con qualche variante in base alle kcal giornaliere
- Altro (specificare)

>

### Se sono fisse, quanti grammi sono per gnocchi e per polenta?

>

### Se hanno varianti in base alle kcal giornaliere, quali sono?

>

## Porzioni: proteine

### Le porzioni di carne, pesce, uova, legumi e formaggi sono sempre le stesse o cambiano con le kcal giornaliere del paziente?

_Perché è importante: per i carboidrati le quantità scalano con le kcal; vogliamo sapere se vale anche per le proteine._

- Fisse per ogni alimento
- Proporzionali alle kcal giornaliere totali
- Fisse per fasce di kcal
- Diverse per categoria: alcune fisse e altre variabili
- Altro (specificare)

>

### Se sono fisse, quali sono le quantità per ogni alimento?

Grammi, oppure unità dove ha senso (es. numero di uova).

>

### Se dipendono da fasce di kcal, quali sono le fasce e le quantità per ciascuna?

>

### Se alcune categorie sono fisse e altre variabili, quali sono le une e le altre?

>

## Porzioni: spuntini

### Gli spuntini (mattina e pomeriggio) sono uguali per tutti i pazienti o si scelgono caso per caso?

- Fissi: stesso spuntino standard per tutti, in quantità fissa
- Scelti da un elenco di alternative, ma con quantità fisse
- Variabili: scelti e dimensionati in base alle kcal del paziente
- Altro (specificare)

>

### Se esiste un elenco standard di spuntini, quali sono e con quali quantità?

>

## Formule

### Per le donne con BMI superiore a 30 (formula di Bernstein), il coefficiente del peso è 7,48?

_Perché è importante: il foglio Excel usa 7,48, ma una fonte secondaria riporta 7,47. La differenza sul risultato è minima (circa 0,1 kcal ogni 10 kg), ma preferiamo esserne certi._

- 7,48 (come nel foglio Excel)
- 7,47

>

### Esiste un riferimento ufficiale che indica 7,47 oppure 7,48?

Se sì, può indicarcelo?

>

## Altro?

### C'è qualcosa che non abbiamo chiesto e che dovremmo sapere?

>
