# 3. Template Word letto da file locale, mai versionato

## Contesto

L'esportazione del piano settimanale compila il template Word dell'istituto (issue #10). Il repository è pubblico: il template contiene il layout e il nome dell'istituto, e i file Excel di partenza contengono dati di pazienti reali.

## Decisione

Il template non fa parte del progetto. L'utente lo sceglie dal proprio computer e l'app lo legge a runtime, ne compila una copia e la restituisce per il download, senza inviarlo a servizi esterni. Lo stesso principio vale per i fogli Excel e per qualsiasi dato di pazienti: restano sul computer dell'utente, sotto `data/` o in file scelti a mano, e non entrano mai nel repository. Il `.gitignore` esclude le estensioni `.docx`, `.doc`, `.dotx`, `.odt`, `.pdf`, `.xlsx`, `.xlsm`, `.xls` e `.csv`, oltre a `data/` e ai database.

I dati di test sono sempre finti e anonimi; per i test dell'esportazione si genera un template sintetico invece di copiare quello reale.

## Conseguenze

Chi clona il repository non ottiene un template di esempio e deve procurarsi il proprio. L'esclusione per estensione nel `.gitignore` è una protezione contro errori, non un'alternativa alla regola: nessun file di questi tipi va aggiunto forzando `git add -f`. Una volta pubblicato, un file committato per sbaglio resta nella cronologia anche se poi viene rimosso.
