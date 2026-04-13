import assert from 'node:assert/strict'

import { handleBlogUnpublish } from '@/app/api/blog/unpublish/handler'
import { getAdminDb } from '@/lib/api/admin-sdk'
import { getBlogPostsCollectionPath, resolveBlogOrgId } from '@/lib/blog/firestore'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForVisible(url: string, expectedTitle: string) {
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    const response = await fetch(url, { redirect: 'follow', cache: 'no-store' })
    const text = await response.text()
    if (response.ok && text.includes(expectedTitle)) {
      return { attempt, finalUrl: response.url }
    }

    await sleep(5000)
  }

  throw new Error('The published post did not become visible on the public blog in time.')
}

async function waitForHidden(url: string, expectedTitle: string) {
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    const response = await fetch(url, { redirect: 'follow', cache: 'no-store' })
    const text = await response.text()
    const redirectedAway = response.url !== url
    const missingTitle = !text.includes(expectedTitle)

    if (redirectedAway && missingTitle) {
      return { attempt, finalUrl: response.url }
    }

    await sleep(5000)
  }

  throw new Error('The unpublished post is still visible on the public blog after waiting for revalidation.')
}

async function main() {
  const publishSecret = requiredEnv('BLOG_PUBLISH_SECRET')
  const blogOrgId = requiredEnv('BLOG_ORG_ID')
  const publishEndpoint =
    process.env.BLOG_PUBLISH_ENDPOINT?.trim() ||
    'https://studio--summa-social.us-central1.hosted.app/api/blog/publish'

  const slug = `prova-tecnica-temporal-${Date.now()}`
  const title = `Prova tècnica temporal del blog ${new Date().toISOString()}`
  const publishedAt = new Date().toISOString()
  const publicUrl = `https://summasocial.app/ca/blog/${slug}`

  const payload = {
    title,
    slug,
    seoTitle: `${title} | Summa Social`,
    metaDescription:
      'Publicació temporal de prova per verificar el flux de publicar i retirar del blog públic.',
    excerpt:
      'Publicació temporal de prova per verificar el flux de publicar i retirar del blog públic.',
    contentHtml:
      '<p>Aquesta és una publicació temporal de prova. Es despublicarà automàticament després de la verificació.</p>',
    tags: ['prova-tecnica'],
    category: 'criteri-operatiu',
    publishedAt,
    baseLocale: 'ca' as const,
  }

  const publishResponse = await fetch(publishEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publishSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const publishBody = (await publishResponse.json()) as Record<string, unknown>
  if (!publishResponse.ok || publishBody.success !== true) {
    throw new Error(`Publish failed: ${JSON.stringify(publishBody)}`)
  }

  const visible = await waitForVisible(publicUrl, title)

  const unpublishResponse = await handleBlogUnpublish({
    headers: new Headers({ Authorization: `Bearer ${publishSecret}` }),
    json: async () => ({ slug }),
  } as Parameters<typeof handleBlogUnpublish>[0])

  const unpublishBody = (await unpublishResponse.json()) as Record<string, unknown>
  if (!unpublishResponse.ok || unpublishBody.success !== true) {
    throw new Error(`Unpublish failed: ${JSON.stringify(unpublishBody)}`)
  }

  const db = getAdminDb()
  const resolvedOrgId = await resolveBlogOrgId(db, blogOrgId)
  const deletedSnap = await db.doc(`${getBlogPostsCollectionPath(resolvedOrgId)}/${slug}`).get()
  assert.equal(deletedSnap.exists, false)

  const hidden = await waitForHidden(publicUrl, title)

  console.log(
    JSON.stringify(
      {
        slug,
        publishUrl: publicUrl,
        publishResponseStatus: publishResponse.status,
        visibleAfterAttempt: visible.attempt,
        hiddenAfterAttempt: hidden.attempt,
        hiddenFinalUrl: hidden.finalUrl,
      },
      null,
      2
    )
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
