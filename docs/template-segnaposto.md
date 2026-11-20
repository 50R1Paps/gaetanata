# Contratto del template Word con segnaposto

La copia reale resta fuori dal repository (ADR 0003). Questo documento elenca solo il contratto dati, non i testi o il layout dell’istituto. `server/template-contract.ts` esporta gli elenchi condivisi e il validatore. I nomi sono ASCII, case-sensitive. Le unità appartengono al documento: i valori forniti dall’app non devono contenerle.

## Valori globali

| Tag | Significato | Unità |
| --- | --- | --- |
| `{data}` | Data di generazione, GG/MM/AAAA | testo |
| `{saluto}` | Saluto scelto dal sesso: Gent.mo / Gent.ma | testo |
| `{nome_paziente}` | Nome completo del paziente | testo |
| `{olio_ml}` | Olio giornaliero escluso il giorno pizza | ml |
| `{pizza_pane_g}` | Pane del giorno pizza | g |
| `{pizza_olio_ml}` | Olio del giorno pizza | ml |
| `{pranzo_pasta_g}` | Pasta del pranzo e riferimento delle sostituzioni | g |
| `{cena_pane_g}` | Pane della cena e riferimento delle sostituzioni | g |
| `{cena_gallette_g}` | Gallette alternative al pane nei pasti della settimana | g |
| `{pranzo_sost_pane_g}` | Pane alternativo a pranzo | g |
| `{pranzo_sost_patate_g}` | Patate alternative a pranzo | g |
| `{pranzo_sost_pasta_mista_g}` | Pasta nella sostituzione mista a pranzo | g |
| `{pranzo_sost_pane_misto_g}` | Pane nella sostituzione mista a pranzo | g |
| `{pranzo_sost_gnocchi_g}` | Gnocchi alternativi a pranzo | g |
| `{pranzo_sost_farina_mais_g}` | Farina di mais alternativa a pranzo | g |
| `{cena_sost_pasta_g}` | Pasta alternativa a cena | g |
| `{cena_sost_gallette_g}` | Gallette alternative nella lista della cena | g |
| `{cena_sost_cracker_g}` | Cracker/grissini alternativi a cena | g |
| `{cena_sost_patate_g}` | Patate alternative a cena | g |
| `{conversione_pasta_cruda_g}` | Pasta cruda usata per la conversione | g |
| `{conversione_pasta_cotta_g}` | Pasta cotta (cruda ×2) | g |
| `{conversione_riso_crudo_g}` | Riso crudo usato per la conversione | g |
| `{conversione_riso_cotto_g}` | Riso cotto (crudo ×2,5) | g |

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

I 140 blocchi coprono tutte le dieci fonti in tutti i quattordici pasti. Con i 140 valori delle quantità e i 23 valori globali, il contratto contiene 303 nomi distinti (le chiusure ripetono il nome del blocco). Le quantità delle uova sono in grammi, non in numero di uova; quelle del pesce in scatola supportano anche l’eccezione da 78 g.

## Verifica automatica

`buildSyntheticTemplate()` produce in memoria un DOCX minimo e anonimo con tutti questi tag. Non legge né incorpora il documento reale. `validateTemplate(bytes)` compila con docxtemplater e verifica tutti i valori globali e la presenza della quantità dentro ciascuna sezione. Word può spezzare un segnaposto tra più run: la verifica usa il parser di docxtemplater, non una ricerca nel solo XML grezzo. `lodash` è una dipendenza esplicita dell’inspector di docxtemplater.

Eseguire `npx vitest run server/template-contract.test.ts`. Il test locale cerca la copia con suffisso `(segnaposto).docx` nella cartella Downloads dell’utente; `GAETANATA_TEMPLATE_PATH` consente un percorso diverso. In assenza del file salta esclusivamente il test locale. Nessun testo del documento reale viene scritto nei test o nei messaggi di successo.

## Controllo umano in Word

Aprire la copia con segnaposto e, quando disponibile la generazione dell’app, anche un risultato compilato. Confermare margini, intestazioni, immagini, tabelle, stili, interruzioni di pagina e numero di pagine del risultato; il sorgente con tutti i blocchi è inevitabilmente più lungo. Verificare tutti i giorni, entrambi i pasti, entrambe le formule di saluto, le dieci fonti e le eccezioni uova/tonno, le sostituzioni, la conversione crudo-cotto e il giorno pizza. Controllare che non rimangano segnaposto stampati, spazi dei carboidrati a colazione o la nota sulle grammature uguali; firma della professionista solo Dr.ssa e spazio libero.

La fonte legumi in scatola non aveva una propria descrizione: è stata aggiunta una riga neutra con alimento, grammi e indicazione del peso sgocciolato. Le due categorie di formaggi sono separate nei rispettivi blocchi; i riferimenti fissi a due uova/una scatoletta piccola sono resi indipendenti dal numero per non contraddire le porzioni d’eccezione. Le alternative descrittive già presenti restano nel documento locale. Gli esempi di ricette nei titoli dei pasti sono quelli originali: controllarne la pertinenza rispetto alla fonte selezionata. Le misure casalinghe dell’olio sono omesse nei due paragrafi variabili per non contraddire la quantità in ml modificabile.

La conferma di impaginazione e testi è una verifica umana: i test del contratto non la sostituiscono.
