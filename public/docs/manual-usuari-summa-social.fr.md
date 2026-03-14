# SUMMA SOCIAL - Manuel d'utilisateur

**Version**: 1.17
**Derniere mise a jour**: Decembre 2025

---

## Note sur la langue

Le manuel d'utilisateur complet est actuellement disponible en catalan. Nous travaillons sur la version en francais.

En attendant, vous pouvez:
- Utiliser le traducteur de votre navigateur pour traduire la version en catalan
- Consulter l'aide contextuelle (`?` sur chaque ecran), disponible en francais
- Utiliser le bot d'aide pour les doutes operationnels courts
- Ouvrir le manuel quand vous avez besoin du flux complet

---

## Sections principales

1. **Premiers Pas**: Comment acceder et naviguer dans l'application
2. **Configuration Initiale**: Donnees de l'organisation, comptes bancaires, categories
3. **Gestion des Donateurs**: Creation, edition, certificats de don
4. **Gestion des Fournisseurs et Employes**: Creation et gestion des contacts
5. **Gestion des Mouvements**: Importer extraits, categoriser, concilier
6. **Diviseur de Virements**: Separer les paiements groupes
7. **Retours Bancaires**: Gestion des impayes
8. **Dons via Stripe**: Conciliation avec paiements en ligne
9. **Rapports Fiscaux**: Modele 182, certificats, exports
10. **Projets et Justification de Subventions**: Module projets
11. **Resolution de Problemes**: FAQ et solutions communes
12. **Glossaire**: Definitions des termes

---

## Aide dans Summa

Les trois points d'aide reels sont:

1. **Aide contextuelle (`?`)** pour l'ecran ou vous etes.
2. **Manuel** pour les processus longs ou sensibles.
3. **Bot** pour les questions operationnelles courtes et pour vous envoyer au bon endroit.

---

## Remises SEPA de prelevement [id:6a-remeses-sepa-de-cobrament]

1. Allez a **Donateurs > Remises de prelevement**
2. Verifiez que le compte bancaire a bien l'ICS configure
3. Controlez la date et les adherents inclus
4. Générez le XML `pain.008`
5. Deposez-le a la banque hors de Summa

---

## Liquidations de frais de deplacement [id:6c-liquidacions-de-despeses-de-viatge]

1. Allez a **Mouvements > Liquidations**
2. Creez ou ouvrez une liquidation
3. Telechargez les tickets et completez le kilometrage si besoin
4. Verifiez les elements en attente avant de generer le PDF
5. Générez le PDF final seulement quand tout est coherent

---

## Diviser un payout Stripe [id:stripe]

1. Allez à **Mouvements** et cherchez l'entrée Stripe
2. Menu **⋮** → **"Diviser virement Stripe"**
3. Téléchargez le CSV exporté de Stripe (Paiements → export)
4. Vérifiez que le net correspond à la banque
5. Traitez: des dons (enfants) + commissions (dépense) sont créés

---

## Capture de tickets en déplacement [id:capture]

1. Ouvrez **Capture de tickets** depuis le menu (idéal sur mobile)
2. Téléchargez la photo du ticket — un par reçu
3. Le document reste "en attente de révision"
4. À votre retour: allez à **Affectation des dépenses** et révisez les en attente
5. Affectez projet/poste selon vos besoins

---

Pour consulter le manuel complet en catalan, changez la langue dans les parametres.
