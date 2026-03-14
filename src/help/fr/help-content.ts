import type { HelpContent, HelpRouteKey } from '../help-types';

export const HELP_CONTENT_FR: Partial<Record<HelpRouteKey, HelpContent>> = {
  '/dashboard': {
    title: 'Aide · Tableau de bord',
    intro:
      'Cet écran est la photo rapide : il vous dit comment va l\'organisation aujourd\'hui. Tout ce que vous voyez ici sont des données dérivées des autres écrans.',
    steps: [
      'Consultez le solde général : il indique le solde actuel du compte.',
      'Regardez les éléments en attente : combien de mouvements sans contact, sans catégorie ou avec retour en attente.',
      'Jugez s\'il faut agir ou non : le tableau de bord signale, il n\'oblige pas.',
      'Accédez à l\'écran concerné si vous voulez traiter quelque chose.',
    ],
    tips: [
      'Le tableau de bord ne se modifie pas : c\'est le reflet d\'autres écrans.',
      'Pas besoin d\'avoir 0 en attente pour être "bien" : faites preuve de discernement.',
      'Les filtres rapides vous amènent au bon endroit si vous voulez approfondir.',
    ],
    extra: {
      order: {
        title: 'Ordre recommandé (2 minutes)',
        items: [
          'Consulter le solde.',
          'Évaluer les en attente.',
          'Si quelque chose demande attention, entrer dans l\'écran concerné.',
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Essayer de modifier ici (impossible : lecture seule).',
          'S\'obséder à avoir zéro en attente sans critère.',
          'Ignorer les avertissements de déséquilibre importants.',
        ],
      },
      whenNot: {
        title: 'Quand il n\'est pas nécessaire de s\'inquiéter',
        items: [
          'Quelques éléments en attente ne signifient pas le chaos : priorisez ce qui compte.',
          'Si vous venez de synchroniser, il est normal d\'avoir des choses à classer.',
        ],
      },
      manual: {
        label: 'Manuel utilisateur · Comprendre le tableau de bord',
        href: '/dashboard/manual#14-entendre-el-dashboard',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Lire le tableau de bord en 2 minutes et décider s\'il faut agir',
      },
    },
    keywords: ['tableau de bord', 'solde', 'en attente', 'résumé', 'contact', 'catégorie', 'retour'],
  },

  '/dashboard/movimientos': {
    title: 'Aide · Mouvements',
    intro:
      'Cet écran est le centre de contrôle du quotidien : vous y vérifiez les entrées/sorties bancaires, repérez les éléments en attente et évitez que les erreurs ne s\'amplifient.',
    steps: [
      'Commencez par les éléments en attente : filtrez "Sans contact", "Sans catégorie" et "Retours en attente" si disponibles.',
      'Assignez d\'abord le contact (donateur, fournisseur ou salarié) : cela donne du contexte au mouvement.',
      'Assignez ensuite la catégorie lorsque le contact est clair.',
      'Vérifiez les encaissements groupés (remises) : scindez-les avant de continuer si nécessaire.',
      'Ajoutez des justificatifs seulement quand ils apportent de la valeur (factures, preuves pertinentes).',
    ],
    tips: [
      'Ordre recommandé : contact → catégorie → document. Changer l\'ordre crée souvent des doutes ensuite.',
      'Si un mouvement vous pose question, laissez-le en attente et continuez avec le reste.',
      'Une revue régulière des éléments en attente évite les accumulations difficiles à traiter.',
    ],
    extra: {
      order: {
        title: 'Ordre de travail recommandé',
        items: [
          'Filtrer les éléments en attente (ce qui n\'est pas résolu).',
          'Assigner les contacts.',
          'Assigner les catégories.',
          'Vérifier remises et retours.',
          'Ajouter des documents quand cela apporte de la valeur.',
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Assigner une catégorie sans avoir défini le contact.',
          'Forcer une affectation juste pour "tout nettoyer".',
          'Scinder les remises trop tard, après avoir déjà modifié d\'autres champs.',
          'Générer des rapports sans avoir vérifié les retours.',
        ],
      },
      whenNot: {
        title: "Quand il n'est pas nécessaire d'agir",
        items: [
          "Inutile d'assigner un projet si vous ne faites que le suivi du quotidien.",
          "Inutile d'ajouter un document pour de petits mouvements évidents.",
          "Inutile de tout résoudre immédiatement : laisser des éléments en attente avec critère, c'est aussi du contrôle.",
        ],
      },
      returns: {
        title: 'Retours (contrôle rapide)',
        items: [
          "Priorité : affecter le bon donateur. Sans donateur, la déduction fiscale ne s'applique pas correctement.",
          "Pour les remises de retours, le mouvement parent n'a pas de contact : le donateur est sur les lignes filles.",
          "S'il reste des retours en attente, résolvez-les avant d'exporter 182/certificats (évite des totaux gonflés).",
          "En cas de doute, laissez en attente et continuez, mais ne l'oubliez pas avant la clôture.",
        ],
      },
      remittances: {
        title: 'Remises (cotisations et Stripe)',
        items: [
          "Remise = un mouvement qui regroupe plusieurs cotisations. Scindez-la avant d'assigner contact/catégorie à la main.",
          'Après scission, travaillez sur les lignes filles (ce sont elles qui comptent par donateur).',
          "Stripe : utilisez « Scinder la remise Stripe » et traitez les affectations en attente (matching par email).",
          "Si une remise est déjà traitée, ne la retravaillez pas : ouvrez le détail via le badge/modal.",
        ],
      },
      contacts: {
        title: 'Contacts (critère rapide)',
        items: [
          "Affectez d'abord le contact : cela donne du contexte et rend la catégorie plus fiable.",
          "Si c'est un salaire → Salarié. Si c'est une facture d'un tiers → Fournisseur. Si c'est un encaissement de cotisation/don → Donateur.",
          "Si le contact n'est pas clair, laissez en attente et cherchez des indices dans le libellé bancaire ou le document.",
          "Évitez de créer des contacts pour de petits cas ponctuels : créez surtout les récurrents ou significatifs.",
        ],
      },
      categories: {
        title: 'Catégories (critère rapide)',
        items: [
          "Affectez la catégorie après le contact : le contact suggère souvent la bonne catégorie (catégorie par défaut).",
          "En cas de doute, choisissez la catégorie la plus stable et cohérente avec l'historique (cohérence > fausse précision).",
          "Ne forcez pas une catégorie « pour nettoyer » : un élément en attente vaut mieux qu'une catégorie erronée.",
          "Pour de gros volumes, filtrez les éléments en attente et appliquez un critère répétable avant le détail.",
        ],
      },
      documents: {
        title: 'Documents (critère rapide)',
        items: [
          "Inutile d'ajouter un document à chaque mouvement : réservez-le aux factures, justificatifs importants ou exigences de subvention.",
          "Si vous ajoutez depuis la modale du mouvement, le document est lié automatiquement.",
          "Un nom de fichier clair (date + concept) aide à le retrouver sans chercher.",
          "Pour la justification de projets, le document peut être obligatoire : vérifiez avant de clôturer.",
        ],
      },
      bankAccounts: {
        title: 'Multi-compte bancaire (critère rapide)',
        items: [
          "Chaque compte se synchronise séparément : si vous en avez plusieurs, filtrez par compte lors de la revue des éléments en attente.",
          "Les soldes du tableau de bord totalisent tous les comptes : n'interprétez pas comme un problème un solde global différent de celui de la banque.",
          "Les virements internes apparaissent comme sortie d'un compte et entrée dans l'autre : affectez la même catégorie (ex. Virements internes) et ne les comptez pas deux fois comme dépense/recette réelle.",
          "Lors de la synchronisation d'un nouveau compte, vérifiez les données initiales (solde d'ouverture, date début) avant de continuer.",
        ],
      },
      ai: {
        title: "Catégorisation IA (quand l'utiliser)",
        items: [
          "Idéal : beaucoup de mouvements sans catégorie et des motifs répétitifs.",
          "Règle d'or : l'IA suggère, vous validez. N'assumez pas qu'elle a toujours raison.",
          "Si le contact est clair, affectez d'abord le contact : la catégorie sera souvent plus juste.",
          "Après l'IA, vérifiez un échantillon (5–10) avant de valider globalement.",
        ],
      },
      bulk: {
        title: 'Actions en masse (nettoyage rapide)',
        items: [
          "Filtrez d'abord (en attente) puis sélectionnez en bloc : évitez de toucher ce qui est déjà correct.",
          "Appliquez des changements répétables (même catégorie) à des groupes cohérents, pas à \"tout le mois\".",
          "En cas de doute, travaillez par petits lots : plus simple à corriger et à vérifier.",
          "Après une action en masse, vérifiez 3–5 lignes au hasard pour confirmer.",
        ],
      },
      importing: {
        title: 'Importer un extrait (sans surprises)',
        items: [
          "Téléchargez l'extrait bancaire en CSV/XLSX et chargez-le tel quel.",
          "Évitez d'ouvrir puis enregistrer le CSV avec Excel s'il modifie les formats : cela peut casser séparateurs et décimales.",
          "Avant d'importer, vérifiez l'aperçu : dates, montants, libellés.",
          "Si vous voyez des doublons ou des montants étranges, arrêtez et vérifiez le fichier avant de continuer.",
        ],
      },
      filters: {
        title: 'Filtres (travailler vite)',
        items: [
          "Règle : filtrer avant d'éditer. Trouvez d'abord les éléments en attente, puis agissez.",
          "Filtres clés : Sans contact, Sans catégorie, Retours en attente.",
          "Pour une tâche précise, combinez filtre + recherche (nom, montant, mot-clé).",
          "Avec beaucoup de volume, travaillez par petits lots (par semaine ou par type) puis validez.",
        ],
      },
      manual: {
        label: 'Manuel utilisateur · Gestion des mouvements',
        href: '/dashboard/manual#5-gestio-de-moviments',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Garder les mouvements sous contrôle en 10 minutes',
      },
    },
    keywords: [
      'contrôle',
      'en attente',
      'contact',
      'catégorie',
      'remise',
      'retours',
      'document',
      'quotidien',
      'ia',
      'masse',
      'importer',
      'filtres',
    ],
  },
  '/dashboard/movimientos/liquidacions': {
    title: 'Aide · Liquidations',
    intro:
      'Cet écran sert à préparer les liquidations de frais de déplacement : tickets, kilométrage et PDF final. Ce n\'est pas l\'écran des remises.',
    steps: [
      'Créez ou ouvrez une liquidation et vérifiez la période avant de continuer.',
      'Téléversez les tickets ou justificatifs et rattachez-les à la bonne liquidation.',
      'Ajoutez le kilométrage seulement si nécessaire et validez les montants avant toute génération.',
      'Vérifiez les éléments en attente avant de générer le PDF final.',
      'Générez le PDF uniquement lorsque la liquidation est complète et cohérente.',
    ],
    tips: [
      'Traitez une liquidation à la fois : mélanger les cas complique la revue.',
      'Un ticket non vérifié n\'est pas une clôture : c\'est du travail en attente.',
      'Si la question porte sur l\'affectation projet, continuez ensuite dans Affectation des dépenses.',
    ],
    extra: {
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Confondre les liquidations de voyage avec les remises ou le recouvrement de cotisations.',
          'Générer le PDF sans avoir vérifié tous les tickets.',
          'Mélanger kilométrage et autres frais sans valider les montants.',
        ],
      },
      manual: {
        label: 'Manuel utilisateur · Liquidations de frais de déplacement',
        href: '/dashboard/manual#6c-liquidacions-de-despeses-de-viatge',
      },
    },
    keywords: ['liquidations', 'voyage', 'tickets', 'kilométrage', 'pdf', 'frais'],
  },

  '/dashboard/donants': {
    title: 'Aide · Donateurs',
    intro:
      'Cet écran est la base fiscale de l\'entité : si DNI/CIF et Code postal sont corrects, le Modèle 182 et les certificats sortent propres.',
    steps: [
      'Priorisez DNI/CIF et Code postal : c\'est ce qui bloque ou dégrade le plus souvent le 182.',
      'Évitez les doublons : en cas d\'import, mettez à jour l\'existant plutôt que de créer du nouveau.',
      'Maintenez Actif/Inactif à jour pour une liste propre sans perdre l\'historique.',
      'Définissez une catégorie par défaut si cela aide à catégoriser de façon cohérente.',
      'Avant certificats ou 182, validez 2–3 donateurs représentatifs (avec et sans retours).',
    ],
    tips: [
      'Ordre opérationnel : DNI/CP → statut → (si pertinent) catégorie par défaut.',
      'Un retour mal affecté fausse le total net du certificat.',
      'Tous les donateurs n\'ont pas besoin d\'une fiche parfaite : minimum fiscal suffit.',
    ],
    extra: {
      order: {
        title: 'Ordre recommandé',
        items: [
          'Compléter DNI/CIF et Code postal.',
          'Vérifier le statut Actif/Inactif.',
          'Éviter les doublons (mettre à jour).',
          'Valider les retours s\'il y en a.',
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Laisser DNI ou Code postal vide en pensant que le 182 sortira correctement.',
          'Créer des doublons par manque de critère lors des imports.',
          'Ignorer les retours et gonfler les totaux nets.',
        ],
      },
      whenNot: {
        title: 'Quand il n\'est pas nécessaire de complexifier',
        items: [
          'Inutile de tout renseigner si cela n\'apporte pas de valeur (priorité au fiscal).',
          'Inutile de générer des certificats en masse tant que des données fiscales manquent.',
        ],
      },
      returns: {
        title: 'Retours (impact fiscal)',
        items: [
          'Un retour affecté au donateur se déduit du total net (certificat et Modèle 182).',
          'Si le retour n\'a pas de donateur affecté, il ne se déduit pour personne : le total est gonflé.',
          'Si un retour est affecté au mauvais donateur, il fausse deux donateurs à la fois.',
          'Avant de clôturer l\'année, vérifiez les retours en attente et les donateurs aux montants étranges.',
        ],
      },
      quality: {
        title: 'Qualité fiscale (check rapide)',
        items: [
          'DNI/CIF et Code postal complets : minimum pour 182.',
          'Éviter les doublons : un donateur par DNI (mettre à jour, ne pas dupliquer).',
          'Cohérence du statut : inactif quand il faut, actif s\'il contribue encore.',
          'Échantillon de validation : 2–3 donateurs représentatifs avant les exports en masse.',
        ],
      },
      manual: {
        label: 'Manuel utilisateur · Gestion des donateurs',
        href: '/dashboard/manual#3-gestio-de-donants',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Préparer les donateurs pour le Modèle 182 (10 minutes)',
      },
    },
    keywords: ['donateurs', 'adhérents', 'dni', 'cif', 'code postal', 'modèle 182', 'certificats', 'inactif', 'retours', 'qualité'],
  },
  '/dashboard/donants/remeses-cobrament': {
    title: 'Aide · Remises de prélèvement',
    intro:
      'Cet écran sert à générer la remise SEPA de prélèvement des cotisations. Vous y préparez le XML pain.008 ; ce n\'est pas l\'écran pour scinder des remises bancaires déjà importées.',
    steps: [
      'Vérifiez d\'abord que le compte bancaire a bien l\'ICS configuré dans Configuration.',
      'Sélectionnez le compte et la date de prélèvement avant de revoir les adhérents inclus.',
      'Vérifiez les adhérents exclus ou avec avertissements avant de générer la remise.',
      'Générez le XML uniquement lorsque le montant total et le nombre d\'adhérents sont cohérents.',
      'Déposez ensuite le fichier à la banque hors de Summa : l\'app le génère mais ne l\'envoie pas automatiquement.',
    ],
    tips: [
      'S\'il manque des adhérents, vérifiez IBAN, montant de cotisation et périodicité avant de forcer quoi que ce soit.',
      'Un XML bien généré ne remplace pas la revue préalable de la liste.',
      'Si le problème concerne une remise déjà traitée par la banque, ce n\'est pas cet écran.',
    ],
    extra: {
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Confondre cet écran avec le diviseur de remises des Mouvements.',
          'Générer la remise sans ICS configuré sur le compte bancaire.',
          'Ignorer les adhérents exclus et le découvrir seulement à la banque.',
        ],
      },
      manual: {
        label: 'Manuel utilisateur · Remises SEPA de prélèvement',
        href: '/dashboard/manual#6a-remeses-sepa-de-cobrament',
      },
    },
    keywords: ['remises', 'sepa', 'prélèvement', 'pain.008', 'cotisations', 'ics'],
  },

  '/dashboard/proveidors': {
    title: 'Aide · Fournisseurs',
    intro:
      'Cet écran organise les tiers qui vous facturent. Si le CIF et l\'identification sont corrects, le Modèle 347 sort sans nettoyage de dernière minute.',
    steps: [
      'Créez des fournisseurs pour les dépenses récurrentes ou significatives (pas pour tout).',
      'Renseignez nom + CIF : c\'est le champ critique pour le Modèle 347.',
      'Définissez une catégorie par défaut si c\'est presque toujours le même type de dépense.',
      'Utilisez actif/inactif pour nettoyer la liste sans perdre l\'historique.',
    ],
    tips: [
      'CIF correct > toute autre donnée.',
      'Si le nom commercial change mais pas le CIF, mettez à jour le même fournisseur.',
      'La catégorie par défaut accélère les Mouvements, mais vérifiez-la en cas d\'exception.',
    ],
    extra: {
      order: {
        title: 'Ordre recommandé',
        items: [
          'Créer seulement les récurrents.',
          'Valider le CIF.',
          'Définir la catégorie par défaut.',
          'Marquer inactifs ceux qui ne sont plus utilisés.',
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Créer des doublons du même fournisseur avec le même CIF.',
          'Laisser le CIF vide en pensant que le 347 sortira correctement.',
          'Mélanger fournisseurs et salariés (chaque type a une fonction).',
        ],
      },
      whenNot: {
        title: 'Quand ce n\'est pas nécessaire',
        items: [
          'Inutile de créer un fournisseur pour de petites dépenses ponctuelles.',
          'Inutile de remplir des champs supplémentaires si vous ne les utilisez pas.',
        ],
      },
      manual: {
        label: 'Manuel utilisateur · Fournisseurs et salariés',
        href: '/dashboard/manual#4-gestio-de-proveidors-i-treballadors',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Préparer les fournisseurs pour le Modèle 347 (8 minutes)',
      },
    },
    keywords: ['fournisseur', 'cif', 'modèle 347', 'tiers', 'catégorie par défaut', 'inactif', 'doublons'],
  },

  '/dashboard/treballadors': {
    title: 'Aide · Salariés',
    intro:
      'Cet écran sert à organiser les dépenses de personnel (salaires et paiements récurrents). Bien tenu, le quotidien est plus propre et cohérent.',
    steps: [
      'Créez un salarié lorsque vous avez des paiements récurrents (salaires, indemnités fixes, etc.).',
      'Renseignez nom et DNI : cela apporte de la traçabilité et évite les confusions.',
      'Définissez une catégorie par défaut (souvent Salaires) pour accélérer l\'affectation dans Mouvements.',
      'Maintenez le statut Actif/Inactif lors des entrées/sorties (inutile de supprimer).',
      'Lors de l\'affectation d\'un mouvement, vérifiez que contact + catégorie reflètent la réalité (salaire vs autre paiement).',
    ],
    tips: [
      'Objectif : cohérence. Ce n\'est pas un outil RH, c\'est une classification opérationnelle.',
      'Inactif > supprimer : vous gardez l\'historique et le contexte.',
      'Si les paiements sont mixtes, ne forcez pas la catégorie par défaut : ajustez au cas par cas.',
    ],
    extra: {
      order: {
        title: 'Ordre recommandé',
        items: [
          'Créer seulement les récurrents.',
          'Renseigner le DNI.',
          'Catégorie par défaut.',
          'Statut actif/inactif.',
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Mélanger salariés et fournisseurs (chaque type a une fonction).',
          'Supprimer des salariés et perdre l\'historique.',
          'Appliquer toujours la catégorie par défaut même si ce n\'est pas pertinent.',
        ],
      },
      whenNot: {
        title: 'Quand il n\'est pas nécessaire de complexifier',
        items: [
          'Inutile de créer des salariés pour des paiements ponctuels sans importance.',
          'Inutile de remplir des champs supplémentaires si vous ne les utilisez pas.',
        ],
      },
      manual: {
        label: 'Manuel utilisateur · Fournisseurs et salariés',
        href: '/dashboard/manual#4-gestio-de-proveidors-i-treballadors',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Organiser salaires et dépenses de personnel (8 minutes)',
      },
    },
    keywords: ['salariés', 'salaires', 'personnel', 'dni', 'catégorie par défaut', 'actif', 'inactif'],
  },

  '/dashboard/informes': {
    title: 'Aide · Rapports',
    intro:
      'Cet écran sert à générer les exports pour le cabinet : Modèle 182, Modèle 347 et certificats. Ici, on ne corrige pas les données ; on vérifie et on exporte.',
    steps: [
      'Choisissez l\'année fiscale et travaillez toujours sur une seule année à la fois.',
      'Modèle 182 : commencez par résoudre les alertes des donateurs (surtout DNI/CIF et Code postal).',
      'Vérifiez les retours affectés : ils impactent directement le total du 182 et des certificats.',
      'Générez le Modèle 182 et envoyez-le au cabinet.',
      'Modèle 347 : seuls les fournisseurs au-dessus du seuil annuel apparaissent ; vérifiez le CIF avant l\'export.',
      'Générez les certificats à l\'unité ou en lot selon le besoin.',
    ],
    tips: [
      'Si le 182 ne "colle" pas, c\'est presque toujours lié aux retours ou à des données donateurs incomplètes.',
      'Validez 2–3 cas représentatifs avant d\'envoyer des certificats en masse.',
      'Gardez une seule année "ouverte" à la fois pour éviter les confusions.',
    ],
    extra: {
      order: {
        title: 'Ordre recommandé quand il faut faire les rapports',
        items: [
          'Sélectionner l\'année fiscale.',
          'Résoudre les alertes donateurs (DNI/CP).',
          'Vérifier les retours.',
          'Générer le Modèle 182.',
          'Générer le Modèle 347.',
          'Générer les certificats.',
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Générer le 182 avec des donateurs sans DNI ou Code postal.',
          'Oublier des retours en attente et gonfler les totaux.',
          'Mélanger les années (corriger une année tout en exportant une autre).',
          'Générer des certificats en masse sans valider un cas au préalable.',
        ],
      },
      checks: {
        title: 'Vérifications finales avant d\'envoyer au cabinet',
        items: [
          '182 : aucune alerte critique en attente.',
          '182 : totaux cohérents avec ce qui est attendu.',
          '347 : fournisseurs avec CIF correct.',
          'Certificats : signature et fonction configurées.',
        ],
      },
      manual: {
        label: 'Manuel utilisateur · Rapports fiscaux',
        href: '/dashboard/manual#9-informes-fiscals',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Préparer le Modèle 182 et les certificats sans surprises (15 minutes)',
      },
    },
    keywords: [
      'modèle 182',
      'modèle 347',
      'certificats',
      'cabinet',
      'année fiscale',
      'retours',
      'alertes',
      'exporter',
    ],
  },

  '/dashboard/configuracion': {
    title: 'Aide · Paramètres',
    intro:
      'Ici, vous mettez l\'organisation "au propre" : données fiscales, logo et signature. Si tout est bon, certificats et rapports restent cohérents.',
    steps: [
      'Renseignez les données fiscales (nom, CIF, adresse) : elles apparaissent sur les exports.',
      'Ajoutez le logo et configurez signature + fonction : c\'est ce qui donne de la validité aux certificats.',
      'Vérifiez les catégories avec critère : ajoutez ce qui manque et évitez les changements agressifs.',
      'Gérez membres et rôles : l\'édition uniquement pour ceux qui en ont besoin.',
    ],
    tips: [
      'Priorité : fiscal + signature. Le reste est secondaire.',
      'Mieux vaut ajouter des catégories que les renommer si l\'historique existe.',
      'Les rôles lecture évitent les erreurs accidentelles.',
    ],
    extra: {
      order: {
        title: 'Ordre recommandé (10 minutes)',
        items: [
          'Données fiscales.',
          'Logo.',
          'Signature et fonction.',
          'Catégories et rôles.',
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Laisser signature/fonction incomplètes et générer des certificats.',
          'Renommer des catégories déjà utilisées et perdre la cohérence.',
          'Donner des droits d\'édition à quelqu\'un qui doit seulement consulter.',
        ],
      },
      whenNot: {
        title: 'Quand il n\'est pas nécessaire d\'y toucher',
        items: [
          'Si vous ne faites que le suivi des Mouvements, inutile de retoucher les Paramètres chaque jour.',
          'Inutile d\'avoir tout parfait pour démarrer (sauf fiscal/signature).',
        ],
      },
      manual: {
        label: 'Manuel utilisateur · Configuration initiale',
        href: '/dashboard/manual#2-configuracio-inicial',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Bien configurer Summa Social dès le départ (8 minutes)',
      },
    },
    keywords: ['paramètres', 'cif', 'adresse', 'logo', 'signature', 'fonction', 'catégories', 'membres', 'rôles'],
  },

  '/dashboard/ejes-de-actuacion': {
    title: "Aide · Axes d'action",
    intro:
      "Cet écran sert à classer en interne recettes et dépenses par axes de travail. Ce n'est pas le module Projets : c'est une étiquette de gestion interne.",
    steps: [
      'Créez un axe lorsque vous devez analyser des dépenses par lignes de travail (sensibilisation, plaidoyer, coopération…).',
      'Choisissez des noms stables et clairs : ils doivent durer dans le temps.',
      'Affectez des mouvements à des axes lorsque cela aide au budget interne ou au reporting au conseil.',
      'Évitez de multiplier les axes : peu et utiles vaut mieux que beaucoup et confus.',
      'En cas de doute, laissez sans axe et décidez quand le critère est clair.',
    ],
    tips: [
      'Un axe est une classification interne ; un projet du module Projets est autre chose.',
      'Ne forcez pas des axes pour "équilibrer" : ils doivent refléter une logique réelle.',
      "Si vous renommez un axe, pensez à l'historique (cohérence > esthétique).",
    ],
    extra: {
      order: {
        title: 'Ordre recommandé',
        items: [
          'Définir 4–8 axes stables.',
          'Affecter un axe seulement si cela apporte de la valeur.',
          'Revoir une fois par an et ajuster au minimum.',
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          "Confondre axes d'action et projets du module Projets.",
          "Créer un axe par activité et perdre la vue d'ensemble.",
          "Reclassifier trop souvent et casser l'historique.",
        ],
      },
      whenNot: {
        title: "Quand ce n'est pas nécessaire",
        items: [
          "Si l'analyse par axes n'est pas utilisée, inutile de les affecter par routine.",
          "Inutile d'affecter un axe à tout : seulement à ce que vous voulez analyser.",
        ],
      },
      manual: {
        label: "Manuel utilisateur · Projets / Axes d'action",
        href: '/dashboard/manual#8-projectes-eixos-dactuacio',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: "Définir des axes d'action utiles (6 minutes)",
      },
    },
    keywords: ['axes', 'classification', 'suivi', 'reporting', 'conseil', 'interne'],
  },

  '/dashboard/project-module/expenses': {
    title: 'Aide · Affectation des dépenses (Projets)',
    intro:
      'Cette boîte de réception regroupe les dépenses affectables : vous décidez ici à quel projet et à quelle ligne budgétaire rattacher chaque dépense, de façon rapide et réversible.',
    steps: [
      'Comprendre l\'écran : chaque ligne est une dépense (banque ou terrain) avec un statut 0% / partiel / 100%.',
      'Commencez par les en attente : filtrez "Non affectées" (0%) pour prioriser ce qui n\'est pas encore imputé.',
      'Quick Assign 100% : utilisez l\'action rapide pour affecter 100% de la dépense à un projet et (si besoin) à une ligne budgétaire.',
      'Split (affectation multiple) : si une dépense doit être répartie entre projets ou lignes, utilisez l\'affectation multiple et répartissez les montants jusqu\'à équilibre.',
      'Vérifiez le statut : le pourcentage doit refléter la réalité (100% si totalement imputée ; partiel si seulement une partie).',
      'Désaffecter : en cas d\'erreur, annulez l\'affectation pour revenir à 0% (ou ajustez la répartition).',
      'Affectation en masse : sélectionnez plusieurs dépenses et appliquez une affectation en bloc pour les cas répétitifs (même projet/ligne).',
      'Fin de revue : avant de valider un projet, vérifiez que les dépenses clés sont à 100% et que les splits ne laissent pas de montants "orphelins".',
    ],
    tips: [
      'Quand une ligne est sur-exécutée, le split partiel est la manière réaliste de rééquilibrer sans inventer des dépenses.',
      'Si une dépense ne correspond à aucun projet, mieux vaut la laisser à 0% que forcer une affectation incorrecte.',
      'Vous ne verrez pas automatiquement toutes les dépenses bancaires : seules celles déjà catégorisées dans Mouvements entrent ici.',
      'Les dépenses terrain sont souvent saisies d\'abord puis affectées ensuite : privilégiez la cohérence de l\'imputation plutôt que la vitesse.',
    ],
    extra: {
      manual: {
        label: 'Manuel utilisateur · Affectation des dépenses',
        href: '/dashboard/manual#6-assignacio-de-despeses',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Affecter des dépenses aux projets de façon agile (10 minutes)',
      },
    },
    keywords: [
      'affectation',
      'projet',
      'ligne budgétaire',
      'quick assign',
      'split',
      '100%',
      'partiel',
      'désaffecter',
      'en masse',
      'terrain',
    ],
  },

  '/dashboard/project-module/projects': {
    title: 'Aide · Gestion des projets',
    intro:
      'Ici, vous créez et gérez les projets du module Projets, que vous utiliserez ensuite pour y affecter des dépenses.',
    steps: [
      'Créez un projet lorsque vous devez regrouper des dépenses sous un même ensemble (ex. une subvention, un programme ou une période de travail).',
      'Choisissez un nom clair et identifiable : c\'est celui affiché dans la boîte d\'affectation des dépenses.',
      'Ajoutez un code ou une référence si vous travaillez avec des justificatifs externes (optionnel mais recommandé).',
      'Vérifiez le statut du projet : actif tant que des dépenses y sont affectées ; fermé lorsqu\'il ne doit plus être utilisé.',
      'Si le projet a un budget, saisissez-le ou gérez les lignes budgétaires depuis son écran économique.',
      'Le projet prend son sens lorsque vous y affectez des dépenses depuis « Affectation des dépenses ».',
      'Évitez les projets en double pour de petites variantes : mieux vaut peu de projets bien définis.',
      'Quand le projet est terminé, fermez-le pour garder de l\'ordre et éviter des affectations accidentelles.',
    ],
    tips: [
      'Si vous hésitez pour une dépense, laissez-la non affectée jusqu\'à décision.',
      'Un projet bien défini rend l\'affectation plus rapide et réduit les erreurs.',
      'Fermer les anciens projets réduit le bruit et évite les mauvais choix.',
    ],
    extra: {
      manual: {
        label: 'Manuel utilisateur · Gestion des projets',
        href: '/dashboard/manual#6-gestio-de-projectes',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Créer et gérer des projets de façon efficace (8 minutes)',
      },
    },
    keywords: ['projet', 'créer', 'éditer', 'fermer', 'code', 'budget', 'lignes budgétaires', 'affectation'],
  },

  '/dashboard/manual': {
    title: 'Aide · Manuel utilisateur',
    intro:
      'Cette page est la référence complète du produit : vous y trouvez l\'explication détaillée de chaque écran, flux et critère d\'utilisation.',
    steps: [
      'Naviguez depuis la table des matières (TOC) : c\'est le moyen le plus rapide d\'aller à une section.',
      'Utilisez Cmd/Ctrl+F pour chercher des mots-clés si vous ne trouvez pas.',
      'Quand un autre écran renvoie ici, vous arrivez directement à l\'ancre (ex. #5-gestio-de-moviments).',
      'Les ancres peuvent être partagées : copiez l\'URL pour envoyer un lien direct à quelqu\'un.',
    ],
    tips: [
      'Le manuel ne remplace pas l\'aide de l\'écran : ici plus de détails, là-bas du contexte immédiat.',
      'Si vous arrivez depuis un lien d\'aide, revenez avec le navigateur ; pas besoin de fermer.',
      'Les vidéos (quand elles seront disponibles) couvrent les mêmes sections que le manuel.',
    ],
    extra: {
      order: {
        title: 'Comment utiliser le manuel (rapide)',
        items: [
          'Utiliser la TOC pour sauter.',
          'Ctrl+F pour chercher.',
          'Enregistrer l\'ancre si utile.',
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          'Lire de haut en bas sans aller à l\'essentiel.',
          'Ignorer que les ancres permettent des liens directs.',
          'Confondre manuel et changelog (le changelog est dans Nouveautés).',
        ],
      },
      whenNot: {
        title: 'Quand ce n\'est pas nécessaire',
        items: [
          'Si vous avez une question ponctuelle, l\'aide de l\'écran suffit souvent.',
          'Si le produit vous est familier, pas besoin de relire le manuel chaque fois.',
        ],
      },
      manual: {
        label: 'Aller au début du manuel',
        href: '/dashboard/manual#top',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Comment trouver des réponses rapides dans le manuel (3 minutes)',
      },
    },
    keywords: ['manuel', 'toc', 'ancres', 'référence', 'documentation', 'recherche'],
  },

  '/redirect-to-org': {
    title: "Aide · Accès à l'organisation",
    intro:
      "Cet écran vous redirige vers votre organisation. Si vous avez accès à plusieurs, le système choisit selon vos droits.",
    steps: [
      'Attendez quelques secondes : la redirection est automatique.',
      'Si rien ne se passe, vérifiez que votre session est active.',
      "Si vous restez ici, il est possible que vous n'ayez accès à aucune organisation active.",
    ],
    tips: [
      "Sur un ordinateur partagé, déconnectez-vous en fin d'usage.",
      'Après un changement de rôle/organisation, il peut être nécessaire de se reconnecter.',
    ],
    extra: {
      order: {
        title: 'Que faire',
        items: [
          'Attendre',
          'Se reconnecter si besoin',
          "Contacter l'admin en cas d'accès manquant",
        ],
      },
      pitfalls: {
        title: 'Erreurs fréquentes',
        items: [
          "Croire à un bug alors que c'est un manque de droits",
          'Session expirée (browser session)',
        ],
      },
      whenNot: {
        title: "Quand ne pas s'inquiéter",
        items: ['Si en 5–10 secondes vous arrivez au Dashboard, tout va bien.'],
      },
      manual: {
        label: 'Manuel utilisateur · Premiers pas',
        href: '/dashboard/manual#1-primers-passos',
      },
      video: {
        label: 'Vidéo (bientôt)',
        note: 'Se connecter et comprendre la redirection (2 minutes)',
      },
    },
    keywords: ['accès', 'organisation', 'redirection', 'droits', 'session'],
  },
};
