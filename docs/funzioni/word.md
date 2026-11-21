# Documento Word

[Indice della documentazione](../../README.md#documentazione)

Il riquadro «Documento Word», sotto le impostazioni, indica se il template è
caricato e lo carica o sostituisce («Carica template…» / «Sostituisci
template…»); un file rifiutato mostra l'errore del server con i segnaposto
mancanti e lascia il template precedente. «Genera Word» resta disattivato, con
il motivo accanto, finché il template manca o lo schema ha modifiche non
salvate, perché il Word usa lo schema salvato. Se mancano dati compare l'elenco
di cosa completare; altrimenti il browser scarica il file con il nome dato dal
server. Lo «Storico» elenca i Word generati del paziente, dal più recente, con
data, ora, nome del file e «Scarica»; si aggiorna dopo ogni generazione.

## Word dallo Schema: API locale

La generazione è disponibile sul server e nel riquadro «Documento Word» della
schermata Schema. Salvare prima lo Schema del paziente.

- `GET /api/template` restituisce `{ available: boolean }`.
- `PUT /api/template` riceve direttamente i byte del `.docx` (non multipart),
  verifica il [contratto dei segnaposto](../template-segnaposto.md) e salva
  `template.docx` accanto al database, normalmente in `data/`. Ripetere la
  richiesta sostituisce il template; un file rifiutato non modifica il precedente.
  Un template non valido produce 422; i segnaposto mancanti sono elencati.
- `POST /api/patients/:id/document` genera dallo Schema salvato e dai dati
  attuali del paziente. Restituisce il Word come allegato, con nome
  `<Nome paziente> <aaaa-mm-gg>.docx`, caratteri non consentiti sostituiti e
  data locale del computer. Template assente, kcal mancanti, dati paziente
  incompleti o quantità mancanti di una fonte scelta producono 422; gli input
  incompleti hanno `issues: [{ field, message }]`. Un pasto senza fonte non
  stampa blocchi proteici. La polenta non disponibile resta nascosta.
  Tutte le quantità nel Word usano la virgola decimale italiana (237,5),
  senza separatori delle migliaia né decimali aggiunti agli interi.

### Storico dei Word generati

Ogni generazione riuscita salva nel database locale una voce immutabile:
identificativo, paziente, istante ISO UTC, nome file, snapshot JSON dello Schema
usato e byte DOCX. La quarta migrazione aggiunge `generated_documents` e il suo
indice senza modificare dati esistenti. Le generazioni rifiutate non creano voci.
Modificare Schema, paziente o template non modifica i documenti già generati.
Eliminare la scheda elimina anche tutto lo storico (`ON DELETE CASCADE`).

- `GET /api/patients/:id/documents` restituisce
  `{ documents: [{ id, date, filename }] }`, dal più recente al più vecchio
  (a parità di istante, identificativo decrescente), senza snapshot né byte.
  `date` è l'istante ISO UTC, distinto dalla data locale nel nome del file.
- `GET /api/patients/:id/documents/:documentId` riscarica i byte originali
  con gli stessi intestazioni e nome allegato della generazione, senza
  richiedere template o dati correnti validi. Documento assente o appartenente
  a un altro paziente: 404. Paziente assente: 404. Solo lettura: altri metodi 405.

`src/documentsApi.ts` offre `loadTemplateStatus`, `uploadTemplate`,
`generatePatientDocument`, `listPatientDocuments` (metadati `GeneratedDocument`)
e `downloadPatientDocument` (Blob e nome file), con `DocumentApiError.issues`.
`server/generate-document.ts` espone la sola funzione di generazione senza I/O,
con byte template, paziente, Schema e data esplicita: restituisce byte e nome file.

Template e documenti non vengono inviati a servizi esterni né committati.
Template e storico restano dopo il riavvio ed entrano nel backup della cartella `data/`.
La firma e tutti i testi descrittivi restano nel template locale: la generazione
non aggiunge nomi professionali. I test usano soltanto il template sintetico.

### Verifica esplicita del template locale

`npm run verify:template -- "<percorso.docx>"` verifica il contratto e la
generazione con tutte le fonti proteiche e i due saluti. Non modifica il file
e non stampa i suoi testi; l'impaginazione va controllata in Word.
La suite automatica non cerca né legge mai template reali, anche se presenti.
Colazione e spuntini includono le quantità salvate; nella copia locale con
tutte le alternative, la bevanda non scelta conserva la proposta (latte 150 ml,
yogurt 125 g). Le condizioni di scelta sono disponibili per altri layout.

Le richieste JSON (schede, piani, schemi) sono limitate a 1 MiB e il template
a 10 MiB: oltre il limite il server risponde 413 senza trattenere il resto
del corpo. Un DOCX con più di 40 MiB complessivi decompressi è rifiutato con
422 prima della compilazione; il template precedente resta intatto.
