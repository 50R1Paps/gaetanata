# Contratto del template Word con segnaposto

La copia reale resta fuori dal repository (ADR 0003). Questo documento elenca solo il contratto dati, non i testi o il layout dell’istituto. `server/template-contract.ts` importa giorni e fonti da `src/schema.ts` ed esporta il validatore. I nomi sono ASCII, case-sensitive. Le unità appartengono al documento: i valori forniti dall’app non devono contenerle.

## Valori globali

| Tag | Significato | Unità |
| --- | --- | --- |
| `{data}` | Data di generazione, GG/MM/AAAA | testo |
| `{saluto}` | Saluto completo scelto dal sesso: Gent.mo Sig. / Gent.ma Sig.ra | testo |
| `{nome_paziente}` | Nome completo del paziente | testo |
| `{colazione_latte_ml}` | Latte: quantità scelta, oppure proposta 150 se è scelto yogurt | ml |
| `{colazione_yogurt_g}` | Yogurt: quantità scelta, oppure proposta 125 se è scelto latte | g |
| `{spuntino_frutta_secca_g}` | Frutta secca degli spuntini | g |
| `{spuntino_yogurt_g}` | Yogurt degli spuntini | g |
| `{pizza_pane_g}` | Pane del giorno pizza | g |
| `{pizza_olio_ml}` | Olio del giorno pizza | ml |
| `{pizza_olio_cucchiai}` | Cucchiai del giorno pizza: ml / 10, senza arrotondamento | numero |
| `{pizza_olio_cucchiaini}` | Cucchiaini del giorno pizza: ml / 5, senza arrotondamento | numero |
| `{pranzo_pasta_g}` | Pasta del pranzo e riferimento delle sostituzioni | g |
| `{cena_pane_g}` | Pane della cena e riferimento delle sostituzioni | g |
| `{pranzo_sost_pane_g}` | Pane alternativo a pranzo | g |
| `{pranzo_sost_patate_g}` | Patate alternative a pranzo | g |
| `{pranzo_sost_pasta_mista_g}` | Pasta nella sostituzione mista a pranzo | g |
| `{pranzo_sost_pane_misto_g}` | Pane nella sostituzione mista a pranzo | g |
| `{pranzo_sost_gnocchi_g}` | Gnocchi alternativi a pranzo | g |
| `{cena_sost_pasta_g}` | Pasta alternativa a cena | g |
| `{cena_sost_gallette_g}` | Gallette alternative al pane: stesso valore nei pasti e nella lista della cena | g |
| `{cena_sost_cracker_g}` | Cracker/grissini alternativi a cena | g |
| `{cena_sost_patate_g}` | Patate alternative a cena | g |
| `{conversione_pasta_cruda_g}` | Pasta cruda usata per la conversione | g |
| `{conversione_pasta_cotta_g}` | Pasta cotta (cruda ×2) | g |
| `{conversione_riso_crudo_g}` | Riso crudo usato per la conversione | g |
| `{conversione_riso_cotto_g}` | Riso cotto (crudo ×2,5) | g |

## Colazione e spuntini

Le quattro quantità sono obbligatorie, includono le correzioni manuali e accettano zero.
Per un template che mostra solo la scelta sono disponibili i booleani opzionali
`{#colazione_latte}` / `{/colazione_latte}` e
`{#colazione_yogurt}` / `{/colazione_yogurt}`: esattamente uno è vero.
La copia locale mantiene invece tutte le alternative e la frase originale:
si sostituiscono solo le quantità fisse di latte e yogurt con i rispettivi tag,
senza condizioni né riordino. La bevanda non scelta conserva la quantità proposta.
Lo yogurt usa g anche a colazione. Negli spuntini si sostituiscono le quantità
di frutta secca e yogurt; gli altri testi restano invariati.

## Fonti proteiche: tutti i giorni e pasti

Ogni riga seguente definisce un blocco booleano e il relativo valore numerico in grammi a crudo/al netto degli scarti; legumi e pesce in scatola sono pesati sgocciolati. Per ogni coppia giorno/pasto l’app passa esattamente un booleano `true` e gli altri `false`. Non passare array o oggetti come condizioni. Il valore `_g` è nello scope principale, non dentro un oggetto.

Sintassi: `{#blocco}` apre la sezione, `{/blocco}` la chiude, `{blocco_g}` stampa la quantità. I testi descrittivi sono solo nel Word. Le sezioni sono inline nello stesso paragrafo per non lasciare nove paragrafi vuoti per pasto nel risultato.

Giorni: `lunedi`, `martedi`, `mercoledi`, `giovedi`, `venerdi`, `sabato`, `domenica`.
Pasti: `pranzo`, `cena`.
Fonti: `uova`, `pesce`, `carne_bianca`, `carne_rossa`, `legumi_secchi`, `legumi_scatola`, `formaggio_fresco`, `formaggio_stagionato`, `affettati`, `pesce_scatola`.

| Blocco booleano (apertura / chiusura) | Quantità (g) |
| --- | --- |
| `{#lunedi_pranzo_uova}` / `{/lunedi_pranzo_uova}` | `{lunedi_pranzo_uova_g}` |
| `{#lunedi_pranzo_pesce}` / `{/lunedi_pranzo_pesce}` | `{lunedi_pranzo_pesce_g}` |
| `{#lunedi_pranzo_carne_bianca}` / `{/lunedi_pranzo_carne_bianca}` | `{lunedi_pranzo_carne_bianca_g}` |
| `{#lunedi_pranzo_carne_rossa}` / `{/lunedi_pranzo_carne_rossa}` | `{lunedi_pranzo_carne_rossa_g}` |
| `{#lunedi_pranzo_legumi_secchi}` / `{/lunedi_pranzo_legumi_secchi}` | `{lunedi_pranzo_legumi_secchi_g}` |
| `{#lunedi_pranzo_legumi_scatola}` / `{/lunedi_pranzo_legumi_scatola}` | `{lunedi_pranzo_legumi_scatola_g}` |
| `{#lunedi_pranzo_formaggio_fresco}` / `{/lunedi_pranzo_formaggio_fresco}` | `{lunedi_pranzo_formaggio_fresco_g}` |
| `{#lunedi_pranzo_formaggio_stagionato}` / `{/lunedi_pranzo_formaggio_stagionato}` | `{lunedi_pranzo_formaggio_stagionato_g}` |
| `{#lunedi_pranzo_affettati}` / `{/lunedi_pranzo_affettati}` | `{lunedi_pranzo_affettati_g}` |
| `{#lunedi_pranzo_pesce_scatola}` / `{/lunedi_pranzo_pesce_scatola}` | `{lunedi_pranzo_pesce_scatola_g}` |
| `{#lunedi_cena_uova}` / `{/lunedi_cena_uova}` | `{lunedi_cena_uova_g}` |
| `{#lunedi_cena_pesce}` / `{/lunedi_cena_pesce}` | `{lunedi_cena_pesce_g}` |
| `{#lunedi_cena_carne_bianca}` / `{/lunedi_cena_carne_bianca}` | `{lunedi_cena_carne_bianca_g}` |
| `{#lunedi_cena_carne_rossa}` / `{/lunedi_cena_carne_rossa}` | `{lunedi_cena_carne_rossa_g}` |
| `{#lunedi_cena_legumi_secchi}` / `{/lunedi_cena_legumi_secchi}` | `{lunedi_cena_legumi_secchi_g}` |
| `{#lunedi_cena_legumi_scatola}` / `{/lunedi_cena_legumi_scatola}` | `{lunedi_cena_legumi_scatola_g}` |
| `{#lunedi_cena_formaggio_fresco}` / `{/lunedi_cena_formaggio_fresco}` | `{lunedi_cena_formaggio_fresco_g}` |
| `{#lunedi_cena_formaggio_stagionato}` / `{/lunedi_cena_formaggio_stagionato}` | `{lunedi_cena_formaggio_stagionato_g}` |
| `{#lunedi_cena_affettati}` / `{/lunedi_cena_affettati}` | `{lunedi_cena_affettati_g}` |
| `{#lunedi_cena_pesce_scatola}` / `{/lunedi_cena_pesce_scatola}` | `{lunedi_cena_pesce_scatola_g}` |
| `{#martedi_pranzo_uova}` / `{/martedi_pranzo_uova}` | `{martedi_pranzo_uova_g}` |
| `{#martedi_pranzo_pesce}` / `{/martedi_pranzo_pesce}` | `{martedi_pranzo_pesce_g}` |
| `{#martedi_pranzo_carne_bianca}` / `{/martedi_pranzo_carne_bianca}` | `{martedi_pranzo_carne_bianca_g}` |
| `{#martedi_pranzo_carne_rossa}` / `{/martedi_pranzo_carne_rossa}` | `{martedi_pranzo_carne_rossa_g}` |
| `{#martedi_pranzo_legumi_secchi}` / `{/martedi_pranzo_legumi_secchi}` | `{martedi_pranzo_legumi_secchi_g}` |
| `{#martedi_pranzo_legumi_scatola}` / `{/martedi_pranzo_legumi_scatola}` | `{martedi_pranzo_legumi_scatola_g}` |
| `{#martedi_pranzo_formaggio_fresco}` / `{/martedi_pranzo_formaggio_fresco}` | `{martedi_pranzo_formaggio_fresco_g}` |
| `{#martedi_pranzo_formaggio_stagionato}` / `{/martedi_pranzo_formaggio_stagionato}` | `{martedi_pranzo_formaggio_stagionato_g}` |
| `{#martedi_pranzo_affettati}` / `{/martedi_pranzo_affettati}` | `{martedi_pranzo_affettati_g}` |
| `{#martedi_pranzo_pesce_scatola}` / `{/martedi_pranzo_pesce_scatola}` | `{martedi_pranzo_pesce_scatola_g}` |
| `{#martedi_cena_uova}` / `{/martedi_cena_uova}` | `{martedi_cena_uova_g}` |
| `{#martedi_cena_pesce}` / `{/martedi_cena_pesce}` | `{martedi_cena_pesce_g}` |
| `{#martedi_cena_carne_bianca}` / `{/martedi_cena_carne_bianca}` | `{martedi_cena_carne_bianca_g}` |
| `{#martedi_cena_carne_rossa}` / `{/martedi_cena_carne_rossa}` | `{martedi_cena_carne_rossa_g}` |
| `{#martedi_cena_legumi_secchi}` / `{/martedi_cena_legumi_secchi}` | `{martedi_cena_legumi_secchi_g}` |
| `{#martedi_cena_legumi_scatola}` / `{/martedi_cena_legumi_scatola}` | `{martedi_cena_legumi_scatola_g}` |
| `{#martedi_cena_formaggio_fresco}` / `{/martedi_cena_formaggio_fresco}` | `{martedi_cena_formaggio_fresco_g}` |
| `{#martedi_cena_formaggio_stagionato}` / `{/martedi_cena_formaggio_stagionato}` | `{martedi_cena_formaggio_stagionato_g}` |
| `{#martedi_cena_affettati}` / `{/martedi_cena_affettati}` | `{martedi_cena_affettati_g}` |
| `{#martedi_cena_pesce_scatola}` / `{/martedi_cena_pesce_scatola}` | `{martedi_cena_pesce_scatola_g}` |
| `{#mercoledi_pranzo_uova}` / `{/mercoledi_pranzo_uova}` | `{mercoledi_pranzo_uova_g}` |
| `{#mercoledi_pranzo_pesce}` / `{/mercoledi_pranzo_pesce}` | `{mercoledi_pranzo_pesce_g}` |
| `{#mercoledi_pranzo_carne_bianca}` / `{/mercoledi_pranzo_carne_bianca}` | `{mercoledi_pranzo_carne_bianca_g}` |
| `{#mercoledi_pranzo_carne_rossa}` / `{/mercoledi_pranzo_carne_rossa}` | `{mercoledi_pranzo_carne_rossa_g}` |
| `{#mercoledi_pranzo_legumi_secchi}` / `{/mercoledi_pranzo_legumi_secchi}` | `{mercoledi_pranzo_legumi_secchi_g}` |
| `{#mercoledi_pranzo_legumi_scatola}` / `{/mercoledi_pranzo_legumi_scatola}` | `{mercoledi_pranzo_legumi_scatola_g}` |
| `{#mercoledi_pranzo_formaggio_fresco}` / `{/mercoledi_pranzo_formaggio_fresco}` | `{mercoledi_pranzo_formaggio_fresco_g}` |
| `{#mercoledi_pranzo_formaggio_stagionato}` / `{/mercoledi_pranzo_formaggio_stagionato}` | `{mercoledi_pranzo_formaggio_stagionato_g}` |
| `{#mercoledi_pranzo_affettati}` / `{/mercoledi_pranzo_affettati}` | `{mercoledi_pranzo_affettati_g}` |
| `{#mercoledi_pranzo_pesce_scatola}` / `{/mercoledi_pranzo_pesce_scatola}` | `{mercoledi_pranzo_pesce_scatola_g}` |
| `{#mercoledi_cena_uova}` / `{/mercoledi_cena_uova}` | `{mercoledi_cena_uova_g}` |
| `{#mercoledi_cena_pesce}` / `{/mercoledi_cena_pesce}` | `{mercoledi_cena_pesce_g}` |
| `{#mercoledi_cena_carne_bianca}` / `{/mercoledi_cena_carne_bianca}` | `{mercoledi_cena_carne_bianca_g}` |
| `{#mercoledi_cena_carne_rossa}` / `{/mercoledi_cena_carne_rossa}` | `{mercoledi_cena_carne_rossa_g}` |
| `{#mercoledi_cena_legumi_secchi}` / `{/mercoledi_cena_legumi_secchi}` | `{mercoledi_cena_legumi_secchi_g}` |
| `{#mercoledi_cena_legumi_scatola}` / `{/mercoledi_cena_legumi_scatola}` | `{mercoledi_cena_legumi_scatola_g}` |
| `{#mercoledi_cena_formaggio_fresco}` / `{/mercoledi_cena_formaggio_fresco}` | `{mercoledi_cena_formaggio_fresco_g}` |
| `{#mercoledi_cena_formaggio_stagionato}` / `{/mercoledi_cena_formaggio_stagionato}` | `{mercoledi_cena_formaggio_stagionato_g}` |
| `{#mercoledi_cena_affettati}` / `{/mercoledi_cena_affettati}` | `{mercoledi_cena_affettati_g}` |
| `{#mercoledi_cena_pesce_scatola}` / `{/mercoledi_cena_pesce_scatola}` | `{mercoledi_cena_pesce_scatola_g}` |
| `{#giovedi_pranzo_uova}` / `{/giovedi_pranzo_uova}` | `{giovedi_pranzo_uova_g}` |
| `{#giovedi_pranzo_pesce}` / `{/giovedi_pranzo_pesce}` | `{giovedi_pranzo_pesce_g}` |
| `{#giovedi_pranzo_carne_bianca}` / `{/giovedi_pranzo_carne_bianca}` | `{giovedi_pranzo_carne_bianca_g}` |
| `{#giovedi_pranzo_carne_rossa}` / `{/giovedi_pranzo_carne_rossa}` | `{giovedi_pranzo_carne_rossa_g}` |
| `{#giovedi_pranzo_legumi_secchi}` / `{/giovedi_pranzo_legumi_secchi}` | `{giovedi_pranzo_legumi_secchi_g}` |
| `{#giovedi_pranzo_legumi_scatola}` / `{/giovedi_pranzo_legumi_scatola}` | `{giovedi_pranzo_legumi_scatola_g}` |
| `{#giovedi_pranzo_formaggio_fresco}` / `{/giovedi_pranzo_formaggio_fresco}` | `{giovedi_pranzo_formaggio_fresco_g}` |
| `{#giovedi_pranzo_formaggio_stagionato}` / `{/giovedi_pranzo_formaggio_stagionato}` | `{giovedi_pranzo_formaggio_stagionato_g}` |
| `{#giovedi_pranzo_affettati}` / `{/giovedi_pranzo_affettati}` | `{giovedi_pranzo_affettati_g}` |
| `{#giovedi_pranzo_pesce_scatola}` / `{/giovedi_pranzo_pesce_scatola}` | `{giovedi_pranzo_pesce_scatola_g}` |
| `{#giovedi_cena_uova}` / `{/giovedi_cena_uova}` | `{giovedi_cena_uova_g}` |
| `{#giovedi_cena_pesce}` / `{/giovedi_cena_pesce}` | `{giovedi_cena_pesce_g}` |
| `{#giovedi_cena_carne_bianca}` / `{/giovedi_cena_carne_bianca}` | `{giovedi_cena_carne_bianca_g}` |
| `{#giovedi_cena_carne_rossa}` / `{/giovedi_cena_carne_rossa}` | `{giovedi_cena_carne_rossa_g}` |
| `{#giovedi_cena_legumi_secchi}` / `{/giovedi_cena_legumi_secchi}` | `{giovedi_cena_legumi_secchi_g}` |
| `{#giovedi_cena_legumi_scatola}` / `{/giovedi_cena_legumi_scatola}` | `{giovedi_cena_legumi_scatola_g}` |
| `{#giovedi_cena_formaggio_fresco}` / `{/giovedi_cena_formaggio_fresco}` | `{giovedi_cena_formaggio_fresco_g}` |
| `{#giovedi_cena_formaggio_stagionato}` / `{/giovedi_cena_formaggio_stagionato}` | `{giovedi_cena_formaggio_stagionato_g}` |
| `{#giovedi_cena_affettati}` / `{/giovedi_cena_affettati}` | `{giovedi_cena_affettati_g}` |
| `{#giovedi_cena_pesce_scatola}` / `{/giovedi_cena_pesce_scatola}` | `{giovedi_cena_pesce_scatola_g}` |
| `{#venerdi_pranzo_uova}` / `{/venerdi_pranzo_uova}` | `{venerdi_pranzo_uova_g}` |
| `{#venerdi_pranzo_pesce}` / `{/venerdi_pranzo_pesce}` | `{venerdi_pranzo_pesce_g}` |
| `{#venerdi_pranzo_carne_bianca}` / `{/venerdi_pranzo_carne_bianca}` | `{venerdi_pranzo_carne_bianca_g}` |
| `{#venerdi_pranzo_carne_rossa}` / `{/venerdi_pranzo_carne_rossa}` | `{venerdi_pranzo_carne_rossa_g}` |
| `{#venerdi_pranzo_legumi_secchi}` / `{/venerdi_pranzo_legumi_secchi}` | `{venerdi_pranzo_legumi_secchi_g}` |
| `{#venerdi_pranzo_legumi_scatola}` / `{/venerdi_pranzo_legumi_scatola}` | `{venerdi_pranzo_legumi_scatola_g}` |
| `{#venerdi_pranzo_formaggio_fresco}` / `{/venerdi_pranzo_formaggio_fresco}` | `{venerdi_pranzo_formaggio_fresco_g}` |
| `{#venerdi_pranzo_formaggio_stagionato}` / `{/venerdi_pranzo_formaggio_stagionato}` | `{venerdi_pranzo_formaggio_stagionato_g}` |
| `{#venerdi_pranzo_affettati}` / `{/venerdi_pranzo_affettati}` | `{venerdi_pranzo_affettati_g}` |
| `{#venerdi_pranzo_pesce_scatola}` / `{/venerdi_pranzo_pesce_scatola}` | `{venerdi_pranzo_pesce_scatola_g}` |
| `{#venerdi_cena_uova}` / `{/venerdi_cena_uova}` | `{venerdi_cena_uova_g}` |
| `{#venerdi_cena_pesce}` / `{/venerdi_cena_pesce}` | `{venerdi_cena_pesce_g}` |
| `{#venerdi_cena_carne_bianca}` / `{/venerdi_cena_carne_bianca}` | `{venerdi_cena_carne_bianca_g}` |
| `{#venerdi_cena_carne_rossa}` / `{/venerdi_cena_carne_rossa}` | `{venerdi_cena_carne_rossa_g}` |
| `{#venerdi_cena_legumi_secchi}` / `{/venerdi_cena_legumi_secchi}` | `{venerdi_cena_legumi_secchi_g}` |
| `{#venerdi_cena_legumi_scatola}` / `{/venerdi_cena_legumi_scatola}` | `{venerdi_cena_legumi_scatola_g}` |
| `{#venerdi_cena_formaggio_fresco}` / `{/venerdi_cena_formaggio_fresco}` | `{venerdi_cena_formaggio_fresco_g}` |
| `{#venerdi_cena_formaggio_stagionato}` / `{/venerdi_cena_formaggio_stagionato}` | `{venerdi_cena_formaggio_stagionato_g}` |
| `{#venerdi_cena_affettati}` / `{/venerdi_cena_affettati}` | `{venerdi_cena_affettati_g}` |
| `{#venerdi_cena_pesce_scatola}` / `{/venerdi_cena_pesce_scatola}` | `{venerdi_cena_pesce_scatola_g}` |
| `{#sabato_pranzo_uova}` / `{/sabato_pranzo_uova}` | `{sabato_pranzo_uova_g}` |
| `{#sabato_pranzo_pesce}` / `{/sabato_pranzo_pesce}` | `{sabato_pranzo_pesce_g}` |
| `{#sabato_pranzo_carne_bianca}` / `{/sabato_pranzo_carne_bianca}` | `{sabato_pranzo_carne_bianca_g}` |
| `{#sabato_pranzo_carne_rossa}` / `{/sabato_pranzo_carne_rossa}` | `{sabato_pranzo_carne_rossa_g}` |
| `{#sabato_pranzo_legumi_secchi}` / `{/sabato_pranzo_legumi_secchi}` | `{sabato_pranzo_legumi_secchi_g}` |
| `{#sabato_pranzo_legumi_scatola}` / `{/sabato_pranzo_legumi_scatola}` | `{sabato_pranzo_legumi_scatola_g}` |
| `{#sabato_pranzo_formaggio_fresco}` / `{/sabato_pranzo_formaggio_fresco}` | `{sabato_pranzo_formaggio_fresco_g}` |
| `{#sabato_pranzo_formaggio_stagionato}` / `{/sabato_pranzo_formaggio_stagionato}` | `{sabato_pranzo_formaggio_stagionato_g}` |
| `{#sabato_pranzo_affettati}` / `{/sabato_pranzo_affettati}` | `{sabato_pranzo_affettati_g}` |
| `{#sabato_pranzo_pesce_scatola}` / `{/sabato_pranzo_pesce_scatola}` | `{sabato_pranzo_pesce_scatola_g}` |
| `{#sabato_cena_uova}` / `{/sabato_cena_uova}` | `{sabato_cena_uova_g}` |
| `{#sabato_cena_pesce}` / `{/sabato_cena_pesce}` | `{sabato_cena_pesce_g}` |
| `{#sabato_cena_carne_bianca}` / `{/sabato_cena_carne_bianca}` | `{sabato_cena_carne_bianca_g}` |
| `{#sabato_cena_carne_rossa}` / `{/sabato_cena_carne_rossa}` | `{sabato_cena_carne_rossa_g}` |
| `{#sabato_cena_legumi_secchi}` / `{/sabato_cena_legumi_secchi}` | `{sabato_cena_legumi_secchi_g}` |
| `{#sabato_cena_legumi_scatola}` / `{/sabato_cena_legumi_scatola}` | `{sabato_cena_legumi_scatola_g}` |
| `{#sabato_cena_formaggio_fresco}` / `{/sabato_cena_formaggio_fresco}` | `{sabato_cena_formaggio_fresco_g}` |
| `{#sabato_cena_formaggio_stagionato}` / `{/sabato_cena_formaggio_stagionato}` | `{sabato_cena_formaggio_stagionato_g}` |
| `{#sabato_cena_affettati}` / `{/sabato_cena_affettati}` | `{sabato_cena_affettati_g}` |
| `{#sabato_cena_pesce_scatola}` / `{/sabato_cena_pesce_scatola}` | `{sabato_cena_pesce_scatola_g}` |
| `{#domenica_pranzo_uova}` / `{/domenica_pranzo_uova}` | `{domenica_pranzo_uova_g}` |
| `{#domenica_pranzo_pesce}` / `{/domenica_pranzo_pesce}` | `{domenica_pranzo_pesce_g}` |
| `{#domenica_pranzo_carne_bianca}` / `{/domenica_pranzo_carne_bianca}` | `{domenica_pranzo_carne_bianca_g}` |
| `{#domenica_pranzo_carne_rossa}` / `{/domenica_pranzo_carne_rossa}` | `{domenica_pranzo_carne_rossa_g}` |
| `{#domenica_pranzo_legumi_secchi}` / `{/domenica_pranzo_legumi_secchi}` | `{domenica_pranzo_legumi_secchi_g}` |
| `{#domenica_pranzo_legumi_scatola}` / `{/domenica_pranzo_legumi_scatola}` | `{domenica_pranzo_legumi_scatola_g}` |
| `{#domenica_pranzo_formaggio_fresco}` / `{/domenica_pranzo_formaggio_fresco}` | `{domenica_pranzo_formaggio_fresco_g}` |
| `{#domenica_pranzo_formaggio_stagionato}` / `{/domenica_pranzo_formaggio_stagionato}` | `{domenica_pranzo_formaggio_stagionato_g}` |
| `{#domenica_pranzo_affettati}` / `{/domenica_pranzo_affettati}` | `{domenica_pranzo_affettati_g}` |
| `{#domenica_pranzo_pesce_scatola}` / `{/domenica_pranzo_pesce_scatola}` | `{domenica_pranzo_pesce_scatola_g}` |
| `{#domenica_cena_uova}` / `{/domenica_cena_uova}` | `{domenica_cena_uova_g}` |
| `{#domenica_cena_pesce}` / `{/domenica_cena_pesce}` | `{domenica_cena_pesce_g}` |
| `{#domenica_cena_carne_bianca}` / `{/domenica_cena_carne_bianca}` | `{domenica_cena_carne_bianca_g}` |
| `{#domenica_cena_carne_rossa}` / `{/domenica_cena_carne_rossa}` | `{domenica_cena_carne_rossa_g}` |
| `{#domenica_cena_legumi_secchi}` / `{/domenica_cena_legumi_secchi}` | `{domenica_cena_legumi_secchi_g}` |
| `{#domenica_cena_legumi_scatola}` / `{/domenica_cena_legumi_scatola}` | `{domenica_cena_legumi_scatola_g}` |
| `{#domenica_cena_formaggio_fresco}` / `{/domenica_cena_formaggio_fresco}` | `{domenica_cena_formaggio_fresco_g}` |
| `{#domenica_cena_formaggio_stagionato}` / `{/domenica_cena_formaggio_stagionato}` | `{domenica_cena_formaggio_stagionato_g}` |
| `{#domenica_cena_affettati}` / `{/domenica_cena_affettati}` | `{domenica_cena_affettati_g}` |
| `{#domenica_cena_pesce_scatola}` / `{/domenica_cena_pesce_scatola}` | `{domenica_cena_pesce_scatola_g}` |

## Valori aggiuntivi delle fonti

`proteinQuantityTemplateValues(blocco, grammi)` restituisce `_g` e, dove richiesto, il conteggio uova (grammi / 60: 2 per 120 g, 3 per 180 g) o l’alternativa stagionata del formaggio fresco (grammi / 2). Tutti i valori sono nello scope principale; i tag sono collocati dentro il rispettivo blocco.

| Tag | Significato | Unità |
| --- | --- | --- |
| `{lunedi_pranzo_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{lunedi_pranzo_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{lunedi_cena_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{lunedi_cena_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{martedi_pranzo_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{martedi_pranzo_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{martedi_cena_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{martedi_cena_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{mercoledi_pranzo_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{mercoledi_pranzo_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{mercoledi_cena_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{mercoledi_cena_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{giovedi_pranzo_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{giovedi_pranzo_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{giovedi_cena_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{giovedi_cena_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{venerdi_pranzo_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{venerdi_pranzo_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{venerdi_cena_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{venerdi_cena_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{sabato_pranzo_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{sabato_pranzo_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{sabato_cena_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{sabato_cena_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{domenica_pranzo_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{domenica_pranzo_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |
| `{domenica_cena_uova_n}` | Conteggio uova, grammi / 60 | numero |
| `{domenica_cena_formaggio_fresco_alt_stagionato_g}` | Alternativa stagionata nel blocco fresco, grammi / 2 | g |

## Polenta opzionale e misure dell’olio

`{#pranzo_sost_polenta}` apre e `{/pranzo_sost_polenta}` chiude l’intera sostituzione polenta. I due tag devono stare ciascuno da solo in un paragrafo non puntato, prima e dopo il paragrafo della sostituzione: con `paragraphLoop: true` vengono rimossi sia i paragrafi dei tag sia, quando la condizione è falsa, l’intero paragrafo puntato, senza lasciare un punto elenco vuoto. Non inserire entrambi i tag nel paragrafo della sostituzione. La condizione è un booleano: `false` se il calcolo non è disponibile (comportamento corrente), `true` solo quando viene fornita una quantità valida. Dentro il blocco `{pranzo_sost_farina_mais_g}` indica i grammi di farina di mais. Il tag resta obbligatorio nel template anche quando la sezione non viene stampata.

`pizzaOilTemplateValues(ml)` restituisce `{pizza_olio_ml}`, `{pizza_olio_cucchiai}` (ml / 10) e `{pizza_olio_cucchiaini}` (ml / 5), senza arrotondare; ad esempio 10 ml → 1 e 2, 15 ml → 1,5 e 3. Il testo e le posizioni delle misure casalinghe restano nel documento locale.


I 140 blocchi proteici coprono tutte le dieci fonti in tutti i quattordici pasti. A questi si aggiunge il blocco opzionale della polenta. L’olio giornaliero fuori dal giorno pizza resta fisso a 30 ml con le misure casalinghe originali: non ha un tag.

## Verifica automatica

`buildSyntheticTemplate()` produce in memoria un DOCX minimo e anonimo con tutti questi tag. Non legge né incorpora il documento reale. `validateTemplate(bytes)` compila con docxtemplater e verifica tutti i valori globali e tutti i valori richiesti dentro ciascuna sezione, inclusi conteggio uova, alternativa stagionata e polenta. `templateBlockValueTags` esporta questa relazione. Word può spezzare un segnaposto tra più run: la verifica usa il parser di docxtemplater, non una ricerca nel solo XML grezzo. `lodash` è una dipendenza esplicita dell’inspector di docxtemplater.

La suite usa esclusivamente il template sintetico. La verifica della copia locale è un comando esplicito separato: `npm run verify:template -- "<percorso.docx>"`. Controlla il contratto e genera in memoria con tutte le fonti e i due saluti, senza salvare documenti o stampare testi del template. Non cerca file in Downloads né usa variabili d’ambiente.

## Controllo umano in Word

Aprire la copia con segnaposto e, quando disponibile la generazione dell’app, anche un risultato compilato. Confermare margini, intestazioni, immagini, tabelle, stili, interruzioni di pagina e numero di pagine del risultato; il sorgente con tutti i blocchi è inevitabilmente più lungo. Verificare tutti i giorni, entrambi i pasti, entrambe le formule di saluto, le dieci fonti e le eccezioni uova/tonno, le sostituzioni, la conversione crudo-cotto e il giorno pizza. Controllare che non rimangano segnaposto stampati, spazi dei carboidrati a colazione o la nota sulle grammature uguali; firma della professionista solo Dr.ssa e spazio libero.

La fonte legumi in scatola non aveva una propria descrizione: è stata aggiunta una riga neutra con alimento, grammi e indicazione del peso sgocciolato. Il blocco formaggio fresco conserva tutte le alternative originali, compresa quella stagionata con quantità derivata; resta anche il blocco separato formaggio stagionato. Il conteggio delle uova è variabile; la descrizione del tonno, i titoli con esempi di ricette e la frase dei condimenti quotidiani sono quelli originali. Nel giorno pizza sono conservate le misure casalinghe, con valori derivati dai ml. Gli indicatori dei blocchi sono in run separati per non alterare il grassetto del prefisso delle fonti.

La conferma di impaginazione e testi è una verifica umana: i test del contratto non la sostituiscono.
