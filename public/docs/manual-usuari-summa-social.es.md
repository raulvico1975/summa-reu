# SUMMA SOCIAL - Manual de Usuario

**Versión**: 1.17
**Última actualización**: Diciembre 2025

---

## Nota sobre el idioma

El manual de usuario completo está disponible actualmente en catalán. Estamos trabajando en la versión en español.

Mientras tanto, puedes:
- Usar el traductor de tu navegador para traducir la versión en catalán
- Consultar la ayuda contextual (`?` en cada pantalla), que sí está disponible en español
- Usar el bot de ayuda para dudas operativas cortas
- Abrir el manual cuando necesites el flujo completo

---

## Secciones principales

1. **Primeros Pasos**: Cómo acceder y navegar por la aplicación
2. **Configuración Inicial**: Datos de la organización, cuentas bancarias, categorías
3. **Gestión de Donantes**: Alta, edición, certificados de donación
4. **Gestión de Proveedores y Trabajadores**: Alta y gestión de contactos
5. **Gestión de Movimientos**: Importar extractos, categorizar, conciliar
6. **Divisor de Remesas**: Separar cobros agrupados
7. **Devoluciones Bancarias**: Gestión de impagos
8. **Donaciones via Stripe**: Conciliación con pagos online
9. **Informes Fiscales**: Modelo 182, certificados, exports
10. **Proyectos y Justificación de Subvenciones**: Módulo de proyectos
11. **Resolución de Problemas**: FAQ y soluciones comunes
12. **Glosario**: Definiciones de términos

---

## Ayuda dentro de Summa

Los tres puntos de ayuda reales son:

1. **Ayuda contextual (`?`)** para la pantalla donde estás.
2. **Manual** para procesos largos o sensibles.
3. **Bot** para dudas operativas cortas y para llevarte al destino correcto.

---

## Remesas SEPA de cobro [id:6a-remeses-sepa-de-cobrament]

1. Ve a **Donantes > Remesas de cobro**
2. Comprueba que la cuenta tenga configurado el ICS
3. Revisa la fecha y los socios incluidos
4. Genera el XML `pain.008`
5. Súbelo al banco fuera de Summa

---

## Liquidaciones de gastos de viaje [id:6c-liquidacions-de-despeses-de-viatge]

1. Ve a **Movimientos > Liquidaciones**
2. Crea o abre una liquidación
3. Sube tickets y completa, si hace falta, el kilometraje
4. Revisa pendientes antes de generar el PDF
5. Genera el PDF final solo cuando todo cuadre

---

## Dividir un payout de Stripe [id:stripe]

1. Ve a **Movimientos** y busca el ingreso de Stripe
2. Menú **⋮** → **"Dividir remesa Stripe"**
3. Sube el CSV exportado de Stripe (Pagos → export)
4. Verifica que el neto cuadra con el banco
5. Procesa: se crean donaciones (hijos) + comisiones (gasto)

---

## Captura de tickets en viaje [id:capture]

1. Abre **Captura de tickets** desde el menú (ideal desde el móvil)
2. Sube foto del ticket — uno por recibo
3. El documento queda "pendiente de revisión"
4. Cuando vuelvas: ve a **Asignación de gastos** y revisa los pendientes
5. Asigna proyecto/partida según necesites

---

Para consultar el manual completo en catalán, cambia el idioma en la configuración.
