# SUMMA SOCIAL - Manuel d'utilisateur

**Version**: 1.46
**Dernière mise à jour**: 16 mars 2026

---

## Note de cette itération

Ce manuel runtime aligne déjà les 8 microflux actifs d'aide en français.

Flux alignés dans cette itération:
- Importar extracte bancari
- Detectar duplicats en importar
- Editar dades d'un donant
- Canviar quota d'un soci
- Dividir remesa
- Desfer remesa
- Importar devolucions del banc
- Generar Model 182

Hors de cette itération, certaines sections restent brèves pour conserver les anchors et la navigation sans redessiner le produit.

---

## 14. Comprendre le tableau de bord [id:14-entendre-el-dashboard]

Section conservée pour la navigation.

Dans cette itération, son contenu n'est pas étendu. Utilisez le `?` du tableau de bord pour l'aide immédiate.

---

## 2. Configuration initiale [id:2-configuracio-inicial]

Section conservée pour la navigation.

Dans cette itération, elle n'est pas étendue. Vérifiez seulement que l'organisation et les comptes bancaires sont correctement renseignés avant de travailler les flux actifs.

---

## 3. Gestion des donateurs [id:3-gestio-de-donants]

### 3.6 Modifier un donateur et changer la cotisation d'un adhérent

#### Qu'est-ce que c'est

La fiche du donateur est l'endroit où vous maintenez à jour les données qui impactent l'opérationnel, les remises et la fiscalité. Depuis cette fiche, vous modifiez les données et, si c'est un adhérent, sa cotisation.

#### Quand l'utiliser

- quand une donnée du donateur a changé
- quand un adhérent change la cotisation ou la périodicité
- quand vous devez corriger une donnée avant une remise ou le Modèle 182

#### Pas à pas

1. Allez dans **Donants** et ouvrez la fiche du donateur.
2. Cliquez sur **"Editar"**.
3. Mettez à jour uniquement les données qui ont changé: nom, DNI/CIF, code postal, email, téléphone ou IBAN.
4. Si c'est un adhérent, vérifiez **Import de quota (per cobrament)** et **Periodicitat**.
5. Cliquez sur **"Guardar Donant"**.

#### Erreurs fréquentes

- créer un nouveau donateur alors qu'il fallait modifier la fiche existante
- changer la cotisation sans vérifier l'IBAN ou les données fiscales avant les remises ou le Modèle 182

#### Où le trouver dans Summa

**Donants > Fiche du donateur > Editar**

---

## 4. Gestion des fournisseurs et salariés [id:4-gestio-de-proveidors-i-treballadors]

Section conservée pour la navigation.

Dans cette itération, elle n'est pas étendue.

---

## 5. Gestion des mouvements [id:5-gestio-de-moviments]

### 5.1 Importer un extrait bancaire

#### Qu'est-ce que c'est

C'est le flux pour charger de nouveaux mouvements bancaires dans Summa sans créer de doublons ni mélanger les comptes.

#### Quand l'utiliser

- quand vous téléchargez un CSV ou un Excel de la banque
- quand vous devez charger une nouvelle période dans **Mouvements**
- quand vous voulez vérifier si un fichier a déjà été importé

#### Pas à pas

1. Téléchargez l'extrait bancaire en **CSV** ou **Excel**.
2. Allez dans **Mouvements** puis cliquez sur **"Importar"**.
3. Sélectionnez le bon compte bancaire avant d'envoyer le fichier.
4. Vérifiez l'aperçu et le bloc de **duplicats segurs** avant de confirmer.
5. Importez seulement si dates, montants et libellés sont cohérents.

#### Erreurs fréquentes

- confirmer l'import sans vérifier le compte, l'aperçu ou les doublons
- ouvrir puis enregistrer le CSV avec Excel si cela change séparateurs ou décimales

#### Où le trouver dans Summa

**Mouvements > Importar extracte bancari**

### Détecter les doublons à l'import

Utilisez le même flux d'import. Avant de confirmer, vérifiez le bloc **Duplicats segurs** et, si besoin, **Veure per què**. Ne confirmez pas tant que vous n'avez pas identifié ce qui est nouveau et ce qui existe déjà.

---

## 6. Diviseur de remises [id:6-divisor-de-remeses]

### 6.3 Dividir remesa

#### Qu'est-ce que c'est

C'est le flux post-banque pour séparer une remise opérationnelle en lignes individuelles dans **Mouvements**.

#### Quand l'utiliser

- quand vous avez importé une entrée groupée de cotisations ou reçus
- quand vous devez identifier chaque ligne avant de continuer
- quand la remise n'a pas encore été traitée

#### Pas à pas

1. Allez dans **Mouvements** et ouvrez le détail de la remise.
2. Cliquez sur **"Dividir remesa"**.
3. Envoyez le fichier détaillé de la banque si nécessaire et vérifiez le mappage.
4. Vérifiez le matching avant de traiter.
5. Confirmez seulement quand vous savez quelles lignes iront dans chaque remise.

#### Erreurs fréquentes

- affecter un contact ou une catégorie au mouvement parent avant de diviser la remise
- traiter toute la remise sans vérifier le matching

#### Où le trouver dans Summa

**Mouvements > Détail de remise > Dividir remesa**

### 6.7 Desfer remesa

#### Qu'est-ce que c'est

C'est le flux d'annulation pour remettre une remise traitée à l'état précédent avant un nouveau traitement correct.

#### Quand l'utiliser

- quand la remise a été traitée avec le mauvais fichier
- quand le matching ou la séparation sont incorrects
- quand vous devez revenir à l'état initial avant de recommencer

#### Pas à pas

1. Allez dans **Mouvements** et localisez la remise traitée.
2. Ouvrez son détail depuis le mouvement parent ou le badge.
3. Cliquez sur **"Desfer remesa"**.
4. Vérifiez les informations affichées puis confirmez.
5. Une fois revenue à l'état initial, vous pourrez la retraiter correctement.

#### Erreurs fréquentes

- retraiter la remise sans avoir fait **Desfer remesa** avant
- essayer de corriger la remise en supprimant des lignes à la main

#### Où le trouver dans Summa

**Mouvements > Détail de remise > Desfer remesa**

---

## 6.a Remises SEPA de prélèvement [id:6a-remeses-sepa-de-cobrament]

Section conservée pour la navigation.

Elle ne fait pas partie de cette itération. Ici, on ne mélange pas les remises SEPA de prélèvement avec les remises opérationnelles de **Mouvements**.

---

## 6b. Documents en attente et SEPA OUT [id:6b-documents-pendents]

Section conservée pour la navigation.

Elle ne fait pas partie de cette itération.

---

## 6c. Liquidations de frais de déplacement [id:6c-liquidacions-de-despeses-de-viatge]

Section conservée pour la navigation.

Elle ne fait pas partie de cette itération.

---

## 7. Retours bancaires [id:7-gestio-de-devolucions]

### 7.4 Importar devolucions del banc

#### Qu'est-ce que c'est

C'est le flux pour charger le fichier détaillé des retours et affecter chaque retour au bon donateur.

#### Quand l'utiliser

- quand la banque a retourné des reçus et que vous avez le fichier détaillé
- quand il y a trop de retours pour les traiter un par un
- quand vous voulez laisser la partie fiscale propre avant les rapports

#### Pas à pas

1. Allez dans **Mouvements** et ouvrez **"Importar devolucions del banc"**.
2. Envoyez le fichier CSV ou Excel fourni par la banque.
3. Vérifiez le matching avant de confirmer chaque affectation.
4. Traitez seulement quand les retours résolus ont le bon donateur.
5. Laissez les non résolus comme pendants conscients pour les revoir ensuite.

#### Erreurs fréquentes

- confirmer sans vérifier le matching
- affecter le retour au parent de la remise au lieu du bon donateur

#### Où le trouver dans Summa

**Mouvements > Importar devolucions del banc**

---

## 8. Dons via Stripe [id:8-donacions-via-stripe]

Section conservée pour la navigation.

Elle ne fait pas partie de cette itération.

---

## 9. Rapports fiscaux [id:9-informes-fiscals]

### 9.1 Generar Model 182

#### Qu'est-ce que c'est

C'est le flux pour générer le fichier du **Modèle 182** à partir de données fiscales correctes et de mouvements déjà revus.

#### Quand l'utiliser

- quand vous préparez la clôture fiscale annuelle
- quand le cabinet vous demande le fichier du 182
- quand vous voulez vérifier que le total net par donateur est correct

#### Pas à pas

1. Allez dans **Informes > Model 182** et sélectionnez l'année fiscale.
2. Vérifiez les alertes avant l'export, surtout les donateurs sans données fiscales et les retours en attente.
3. Corrigez ce qui manque dans **Donants** ou **Mouvements** puis revenez à **Informes**.
4. Générez le fichier seulement quand les totaux sont cohérents.
5. Téléchargez-le et envoyez-le au cabinet.

#### Erreurs fréquentes

- générer le Modèle 182 avec des donateurs sans **DNI/CIF** ou **code postal**
- exporter alors que vous êtes encore en train de revoir une autre année ou qu'il reste des retours en attente

#### Où le trouver dans Summa

**Informes > Model 182**

---

## 10. Projets et justification de subventions [id:10-projectes]

### Gestion de projets [id:6-gestio-de-projectes]

Section conservée pour la navigation. Elle ne fait pas partie de cette itération.

### Affectation des dépenses [id:6-assignacio-de-despeses]

Section conservée pour la navigation. Elle ne fait pas partie de cette itération.

---

## 11. Résolution de problèmes [id:11-resolucio-de-problemes]

Si une tâche de cette itération ne colle pas:
- revenez à l'écran de base du flux
- vérifiez d'abord alertes et éléments en attente
- utilisez le `?` pour le résumé court
- utilisez le bot pour ouvrir la card exacte du microflux
