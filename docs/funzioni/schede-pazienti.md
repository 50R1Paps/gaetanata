# Schede pazienti

[Indice della documentazione](../../README.md#documentazione)

## Schede pazienti

Il pulsante **Paziente** in alto apre l'elenco delle schede, in ordine alfabetico.

- **Nuova scheda**: compila i campi e premi **Salva scheda**. Solo il nome è obbligatorio; data di nascita, sesso (usato dalle formule del metabolismo), peso in kg e altezza in cm si possono aggiungere in seguito. Per i decimali va bene sia la virgola sia il punto (`72,5`).
- **Aprire o modificare**: fai clic su un nome nell'elenco, cambia i campi e premi **Salva scheda**. Il paziente selezionato è quello attivo nell'editor. Due persone con lo stesso nome restano schede distinte; la data di nascita accanto al nome aiuta a riconoscerle.
- **Eliminare**: con la scheda aperta premi **Elimina scheda**, poi **Conferma eliminazione**. Cambiare selezione annulla la richiesta; l'eliminazione non si può annullare.

Nome vuoto, data di nascita futura o non valida, peso o altezza non numerici o non positivi vengono segnalati accanto al campo e nulla viene salvato. «Scheda salvata» compare solo dopo che i dati sono stati scritti nel database; se il salvataggio o la lettura non riescono, compare il motivo.

Le schede restano in `data/gaetanata.db` anche dopo la chiusura. Al primo avvio di questa versione il database viene aggiornato automaticamente, senza perdere dati.

### Metabolismo basale nella scheda

Sotto i campi della scheda il riquadro **Metabolismo basale** mostra affiancati i risultati di Harris-Benedict, Mifflin-St Jeor e Bernstein in kcal/giorno, con la fascia di BMI di ciascuna formula. La formula usata automaticamente è evidenziata («In uso») e il suo valore è ripetuto in grassetto; non esiste una scelta manuale (vedi [Formule del metabolismo](#formule-del-metabolismo) e ADR 0002). La scelta segue il BMI non arrotondato: fino a 25 incluso Harris-Benedict, oltre 25 fino a 30 incluso Mifflin-St Jeor, oltre 30 Bernstein. Il BMI è mostrato con due decimali.

Sono indicati anche l'età, calcolata alla data di oggi del computer (scritta accanto, «Età al GG/MM/AAAA»), e il BMI usati nel calcolo. Il metabolismo basale è la spesa a riposo: non è automaticamente la quantità di calorie da prescrivere nella dieta.

I risultati si aggiornano mentre si modificano i campi, anche prima di salvare; nel database restano solo i dati della scheda e il metabolismo viene ricalcolato ogni volta che la scheda si riapre. Se manca la data di nascita, il sesso, il peso o l'altezza, il riquadro dice cosa completare; se un valore non è valido dice cosa correggere; se i dati danno un risultato nullo o negativo per qualche formula chiede di controllarli. In questi casi non compare nessun numero.

## Formule del metabolismo

Decisioni prese (issue #1). P = peso in kg, H = altezza in cm, A = età in anni.

| Formula | Maschio | Femmina | Fonte |
|---|---|---|---|
| Harris-Benedict | `66.4730 + 13.7516·P + 5.0033·H − 6.7550·A` | `655.0955 + 9.5634·P + 1.8496·H − 4.6756·A` | Harris & Benedict, 1918 |
| Mifflin-St Jeor | `9.99·P + 6.25·H − 4.92·A + 5` | `9.99·P + 6.25·H − 4.92·A − 161` | Mifflin et al., 1990 |
| Bernstein | `11.02·P + 10.23·H − 5.8·A − 1032` | `7.48·P − 0.42·H − 3.0·A + 844` | Bernstein et al., 1983 |

- **Scelta automatica della formula** in base al BMI: BMI ≤ 25 → Harris-Benedict, 25 < BMI ≤ 30 → Mifflin, BMI > 30 → Bernstein.
- **"Eq. Giuseppe"**: tolta, non viene implementata.
- **Unità in stampa**: latte e olio in ml, tutto il resto in g.

