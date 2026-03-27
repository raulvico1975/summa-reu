import caMessages from '@/i18n/locales/ca.json'
import esMessages from '@/i18n/locales/es.json'
import frMessages from '@/i18n/locales/fr.json'
import ptMessages from '@/i18n/locales/pt.json'
import type { PublicLocale } from '@/lib/public-locale'
import { trFactory } from '@/i18n/json-runtime'

const TR_BY_LOCALE = {
  ca: trFactory(caMessages),
  es: trFactory(esMessages),
  fr: trFactory(frMessages),
  pt: trFactory(ptMessages),
} as const

const EXTRA_COPY: Record<
  PublicLocale,
  {
    description: string
    backToHome: string
    readArticle: string
    browseBlog: string
    browseUpdates: string
    discoverFeatures: string
    panelTitle: string
    panelPoints: string[]
    detailAside: string
    emptyTitle: string
    emptyDescription: string
    continueTitle: string
    continueDescription: string
  }
> = {
  ca: {
    description:
      'Articles i criteri operatiu sobre tresoreria, quotes, donacions i fiscalitat per a entitats.',
    backToHome: "Tornar a l'inici",
    readArticle: 'Llegir article',
    browseBlog: 'Veure tots els articles',
    browseUpdates: 'Veure novetats',
    discoverFeatures: 'Veure funcionalitats',
    panelTitle: 'Què hi trobaràs',
    panelPoints: [
      'Criteri operatiu per ordenar tresoreria i administració.',
      'Context fiscal perquè els tancaments arribin amb la base preparada.',
      'Novetats que afecten la manera de treballar amb Summa.',
    ],
    detailAside:
      'Aquest article baixa a un cas concret de gestió econòmica i l’explica amb context operatiu.',
    emptyTitle: 'Encara no hi ha articles publicats',
    emptyDescription:
      'Quan activem noves peces editorials, apareixeran aquí amb el mateix criteri visual que la resta del web.',
    continueTitle: 'Continueu explorant',
    continueDescription:
      'Si voleu entendre el producte abans d’entrar al detall, a la home hi trobareu una visió més clara del nucli de Summa.',
  },
  es: {
    description:
      'Artículos y criterio operativo sobre tesorería, cuotas, donaciones y fiscalidad para entidades.',
    backToHome: 'Volver al inicio',
    readArticle: 'Leer artículo',
    browseBlog: 'Ver todos los artículos',
    browseUpdates: 'Ver novedades',
    discoverFeatures: 'Ver funcionalidades',
    panelTitle: 'Qué encontrarás',
    panelPoints: [
      'Criterio operativo para ordenar tesorería y administración.',
      'Contexto fiscal para que los cierres lleguen con la base preparada.',
      'Novedades que afectan a la forma de trabajar con Summa.',
    ],
    detailAside:
      'Este artículo baja a un caso concreto de gestión económica y lo explica con contexto operativo.',
    emptyTitle: 'Todavía no hay artículos publicados',
    emptyDescription:
      'Cuando activemos nuevas piezas editoriales, aparecerán aquí con el mismo criterio visual que el resto de la web.',
    continueTitle: 'Sigue explorando',
    continueDescription:
      'Si quieres entender el producto antes de entrar en detalle, en la home encontrarás una visión más clara del núcleo de Summa.',
  },
  fr: {
    description:
      'Articles et critères opérationnels sur la trésorerie, les cotisations, les dons et la fiscalité pour les entités.',
    backToHome: "Retour à l'accueil",
    readArticle: "Lire l'article",
    browseBlog: 'Voir tous les articles',
    browseUpdates: 'Voir les nouveautés',
    discoverFeatures: 'Voir les fonctionnalités',
    panelTitle: 'Ce que vous y trouverez',
    panelPoints: [
      'Des critères opérationnels pour mettre de l’ordre dans la trésorerie et l’administration.',
      'Du contexte fiscal pour préparer les clôtures avec une base claire.',
      'Des nouveautés qui touchent la manière de travailler avec Summa.',
    ],
    detailAside:
      'Cet article descend dans un cas concret de gestion économique et l’explique avec un contexte opérationnel.',
    emptyTitle: 'Aucun article publié pour le moment',
    emptyDescription:
      'Quand nous activerons de nouvelles pièces éditoriales, elles apparaîtront ici avec le même langage visuel que le reste du site.',
    continueTitle: 'Continuez à explorer',
    continueDescription:
      'Si vous voulez comprendre le produit avant d’entrer dans le détail, la page d’accueil vous donne une vision plus claire du cœur de Summa.',
  },
  pt: {
    description:
      'Artigos e critério operacional sobre tesouraria, quotas, doações e fiscalidade para entidades.',
    backToHome: 'Voltar ao início',
    readArticle: 'Ler artigo',
    browseBlog: 'Ver todos os artigos',
    browseUpdates: 'Ver novidades',
    discoverFeatures: 'Ver funcionalidades',
    panelTitle: 'O que vais encontrar',
    panelPoints: [
      'Critério operacional para organizar tesouraria e administração.',
      'Contexto fiscal para que os fechos cheguem com a base preparada.',
      'Novidades que afetam a forma de trabalhar com a Summa.',
    ],
    detailAside:
      'Este artigo desce a um caso concreto de gestão económica e explica-o com contexto operacional.',
    emptyTitle: 'Ainda não há artigos publicados',
    emptyDescription:
      'Quando ativarmos novas peças editoriais, elas aparecerão aqui com o mesmo critério visual do resto do site.',
    continueTitle: 'Continua a explorar',
    continueDescription:
      'Se quiseres perceber o produto antes de entrar no detalhe, na home encontrarás uma visão mais clara do núcleo da Summa.',
  },
}

export function getBlogCopy(locale: PublicLocale = 'ca') {
  const tr = TR_BY_LOCALE[locale]
  const extra = EXTRA_COPY[locale]

  return {
    eyebrow: tr('blog.eyebrow', 'Blog'),
    metaDescription: tr('blog.metaDescription', 'Articles i novetats de Summa Social.'),
    metaTitle: tr('blog.metaTitle', 'Blog | Summa Social'),
    notConfigured: tr('blog.notConfigured', "El blog no està configurat en aquest entorn."),
    title: tr('blog.title', 'Articles i novetats'),
    description: extra.description,
    backToHome: extra.backToHome,
    readArticle: extra.readArticle,
    browseBlog: extra.browseBlog,
    browseUpdates: extra.browseUpdates,
    discoverFeatures: extra.discoverFeatures,
    panelTitle: extra.panelTitle,
    panelPoints: extra.panelPoints,
    detailAside: extra.detailAside,
    emptyTitle: extra.emptyTitle,
    emptyDescription: extra.emptyDescription,
    continueTitle: extra.continueTitle,
    continueDescription: extra.continueDescription,
  }
}
