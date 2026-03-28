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

type BlogExtraCopy = {
  title: string
  metaDescription: string
  description: string
  readArticle: string
  browseBlog: string
  emptyTitle: string
  emptyDescription: string
}

const EXTRA_COPY: Record<PublicLocale, BlogExtraCopy> = {
  ca: {
    title: 'El blog de Summa Social',
    metaDescription:
      'Criteri operatiu i lectures útils per a entitats que volen ordenar tresoreria, quotes, donacions i fiscalitat amb més seguretat.',
    description:
      'Articles pensats per responsables d’administració d’entitats que volen decidir amb context, evitar urgències d’última hora i arribar als tancaments amb la base ben feta.',
    readArticle: 'Llegir ara',
    browseBlog: 'Veure tots els articles',
    emptyTitle: 'Encara no hi ha articles publicats',
    emptyDescription:
      'Quan activem noves peces editorials, apareixeran aquí amb el mateix criteri visual que la resta del web.',
  },
  es: {
    title: 'El blog de Summa Social',
    metaDescription:
      'Criterio operativo y lecturas útiles para entidades que quieren ordenar tesorería, cuotas, donaciones y fiscalidad con más seguridad.',
    description:
      'Artículos pensados para responsables de administración de entidades que quieren decidir con contexto, evitar urgencias de última hora y llegar a los cierres con la base bien hecha.',
    readArticle: 'Leer ahora',
    browseBlog: 'Ver todos los artículos',
    emptyTitle: 'Todavía no hay artículos publicados',
    emptyDescription:
      'Cuando activemos nuevas piezas editoriales, aparecerán aquí con el mismo criterio visual que el resto de la web.',
  },
  fr: {
    title: 'Le blog de Summa Social',
    metaDescription:
      'Critères opérationnels et lectures utiles pour les entités qui veulent mieux structurer trésorerie, cotisations, dons et fiscalité.',
    description:
      'Des articles pensés pour les responsables administratifs d’entités qui veulent décider avec contexte, éviter les reconstructions de dernière minute et arriver aux clôtures avec une base solide.',
    readArticle: 'Lire maintenant',
    browseBlog: 'Voir tous les articles',
    emptyTitle: 'Aucun article publié pour le moment',
    emptyDescription:
      'Quand nous activerons de nouvelles pièces éditoriales, elles apparaîtront ici avec le même langage visuel que le reste du site.',
  },
  pt: {
    title: 'O blog da Summa Social',
    metaDescription:
      'Critério operacional e leituras úteis para entidades que querem organizar tesouraria, quotas, doações e fiscalidade com mais segurança.',
    description:
      'Artigos pensados para responsáveis de administração de entidades que querem decidir com contexto, evitar reconstruções de última hora e chegar aos fechos com a base bem feita.',
    readArticle: 'Ler agora',
    browseBlog: 'Ver todos os artigos',
    emptyTitle: 'Ainda não há artigos publicados',
    emptyDescription:
      'Quando ativarmos novas peças editoriais, elas aparecerão aqui com o mesmo critério visual do resto do site.',
  },
}

export function getBlogCopy(locale: PublicLocale = 'ca') {
  const tr = TR_BY_LOCALE[locale]
  const extra = EXTRA_COPY[locale]

  return {
    metaDescription: extra.metaDescription,
    metaTitle: tr('blog.metaTitle', 'Blog | Summa Social'),
    notConfigured: tr('blog.notConfigured', "El blog no està configurat en aquest entorn."),
    title: extra.title,
    description: extra.description,
    readArticle: extra.readArticle,
    browseBlog: extra.browseBlog,
    emptyTitle: extra.emptyTitle,
    emptyDescription: extra.emptyDescription,
  }
}
