# 6. Schema guidato dal Word

## Contesto

Il piano settimanale libero (porzioni inserite una per una) non rispecchia come lavora la nutrizionista: lei parte dalle kcal della dieta, le ripartisce tra macronutrienti e pasti e ne ricava le quantità, che finiscono nel Word stampato. L'issue #12 proponeva di aggiungere le alternative all'editor libero tramite categorie di alimenti.

## Decisione

L'app ha una schermata «Schema» che segue la struttura del Word: kcal della dieta, ripartizione (macro e percentuali per pasto), quantità calcolate, Word. L'app calcola le quantità, la nutrizionista le corregge, e il Word si genera dallo schema. Ogni schema generato si conserva con la sua data.

L'editor settimanale libero resta, per controllare i totali dei nutrienti.

## Alternative considerate

- Solo l'editor libero con le categorie di alimenti (issue #12): costringe a ricostruire a mano la logica del foglio e non produce direttamente il Word.

## Conseguenze

L'issue #12 si chiude come non pianificata. Le categorie di alimenti si limitano a quelle che servono allo schema, assegnate dallo sviluppatore e riviste dalla nutrizionista; le misure casalinghe sono solo quelle usate nel Word.
