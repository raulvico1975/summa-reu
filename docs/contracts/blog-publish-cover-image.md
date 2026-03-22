# Contracte extern: blog amb portada

Summa no genera imatges de blog. OpenClaw o el sistema extern genera la imatge, la puja a Summa i publica el post amb la URL retornada.

## Auth

- Header: `Authorization: Bearer <BLOG_PUBLISH_SECRET>`

## Pas 1: upload de portada

- Mètode: `POST`
- Ruta: `/api/blog/upload-cover`

Body JSON:

```json
{
  "slug": "post-de-prova",
  "imageBase64": "iVBORw0KGgoAAA...",
  "mimeType": "image/png"
}
```

Resposta OK:

```json
{
  "success": true,
  "coverImageUrl": "https://firebasestorage.googleapis.com/...",
  "path": "blog/covers/post-de-prova-12345678.png",
  "storage": "firebase"
}
```

Notes:

- `imageBase64` pot ser base64 pur o `data:image/...;base64,...`
- MIME admès: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- En local es desa a fitxer i retorna URL local
- En entorn real es desa a Firebase Storage i retorna una URL pública permanent

## Pas 2: publish del post

- Mètode: `POST`
- Ruta: `/api/blog/publish`

Body JSON:

```json
{
  "title": "Post de prova",
  "slug": "post-de-prova",
  "seoTitle": "Post de prova | Summa Social",
  "metaDescription": "Resum curt per SEO",
  "excerpt": "Resum curt visible al llistat",
  "contentHtml": "<p>Contingut HTML del post</p>",
  "tags": ["blog", "producte"],
  "category": "Producte",
  "publishedAt": "2026-03-22T12:00:00.000Z",
  "coverImageUrl": "https://firebasestorage.googleapis.com/...",
  "coverImageAlt": "Portada del post"
}
```

## Flux complet

1. OpenClaw genera la imatge.
2. OpenClaw crida `/api/blog/upload-cover`.
3. Summa retorna `coverImageUrl`.
4. OpenClaw crida `/api/blog/publish` amb aquesta URL.
5. El blog mostra la imatge al llistat i al detall.
