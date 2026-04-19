# SUMMA SOCIAL - Manual de Usuario Completo

**Versión**: 1.46
**Última actualización**: 19 abril 2026

---

## ¡Hola!

Este manual está pensado para una persona que lleva la gestión económica de una entidad pequeña o mediana y necesita una guía fiable, práctica y sin teoría innecesaria.

La idea es simple:
- saber dónde entrar
- saber qué hacer en cada pantalla
- saber qué revisar antes de confirmar algo sensible
- saber cómo deshacerlo si algo no cuadra

No hace falta leerlo entero de una vez. Úsalo como referencia operativa.

---

## Índice

1. [Primeros pasos](#1-primers-passos)
2. [Configuración inicial](#2-configuracio-inicial)
3. [Gestión de donantes](#3-gestio-de-donants)
4. [Gestión de proveedores y trabajadores](#4-gestio-de-proveidors-i-treballadors)
5. [Gestión de movimientos](#5-gestio-de-moviments)
6. [Divisor de remesas](#6-divisor-de-remeses)
6a. [Remesas SEPA de cobro](#6a-remeses-sepa-de-cobrament)
6b. [Documentos pendientes y remesas SEPA OUT](#6b-documents-pendents)
6c. [Liquidaciones de gastos de viaje](#6c-liquidacions-de-despeses-de-viatge)
7. [Gestión de devoluciones bancarias](#7-gestio-de-devolucions)
8. [Donaciones vía Stripe](#8-donacions-via-stripe)
9. [Informes fiscales](#9-informes-fiscals)
10. [Proyectos y justificación de subvenciones](#10-projectes)
10b. [Paquete de cierre](#10b-paquet-de-tancament)
11. [Resolución de problemas](#11-resolucio-de-problemes)
12. [Glosario](#12-glossari)

---

# 1. Primeros pasos [id:1-primers-passos]

## 1.1 Cómo acceder a la aplicación

### Paso a paso

1. Abre tu navegador habitual.
2. Entra en `https://summasocial.app`.
3. Escribe tu email.
4. Escribe tu contraseña.
5. Haz clic en **"Iniciar sesión"**.

### Si es tu primera vez

Normalmente una persona administradora de tu entidad te habrá enviado una invitación por correo. Si no la encuentras:
- revisa spam
- pide que te la reenvíen

### Sobre la seguridad

Para proteger los datos de la entidad:
- la sesión se cierra al cerrar el navegador
- la sesión puede caducar por inactividad
- en un equipo compartido conviene cerrar sesión manualmente al terminar

### Sobre las copias de seguridad

La copia de seguridad general del sistema no depende del trabajo diario de la usuaria. Si necesitas una extracción formal de datos o un paquete para auditoría, usa el **Paquete de cierre** o pide soporte operativo.

## 1.2 Idioma de la aplicación

### Cómo cambiarlo

1. Ve a **Configuración**.
2. Busca el bloque de idioma.
3. Selecciona catalán, castellano o francés.
4. El cambio se aplica al momento.

Cada miembro puede tener su idioma sin afectar a los demás.

## 1.3 Navegación por la aplicación

Las pantallas principales son:
- **Dashboard**: resumen económico y alertas
- **Movimientos**: extracto bancario y operaciones
- **Donantes**: socios, donantes y su histórico
- **Proveedores** y **Trabajadores**
- **Informes**: 182, 347 y certificados
- **Configuración**
- **Proyectos** si tenéis el módulo activo

## 1.4 Entender el dashboard [id:14-entendre-el-dashboard]

El dashboard es la vista rápida para saber:
- cuánto ha entrado y salido
- qué alertas hay pendientes
- si quedan devoluciones por revisar
- cuándo vencen obligaciones fiscales

### Bloque económico

Te da una lectura rápida del periodo seleccionado:
- ingresos
- gastos
- saldo
- bloques específicos según el módulo activo

### Alertas

Las alertas no significan necesariamente un error grave. Normalmente señalan:
- movimientos sin revisar
- devoluciones pendientes
- datos fiscales incompletos

### Selector de periodo

El periodo afecta al dashboard y sirve para revisar mes, trimestre, año o rango libre.

### Obligaciones fiscales

Encontrarás recordatorios como:
- **Modelo 182**
- **Modelo 347**

## 1.5 Tu primer mes con Summa Social

### Qué es normal los primeros días

Es normal ver:
- movimientos sin categorizar
- donantes con datos incompletos
- dudas sobre qué revisar primero

### En qué centrarte primero

Orden recomendado:
1. Completa los datos básicos de la entidad.
2. Registra los bancos.
3. Importa el extracto del último mes cerrado.
4. Importa la base de donantes si la tienes.
5. Categoriza lo evidente.
6. Revisa devoluciones si las hay.

### Después de 1-2 meses

La rutina habitual suele ser:
- importar extracto
- revisar categorizaciones
- dividir remesas o imputar Stripe si toca
- revisar devoluciones
- generar informes cuando corresponda

## 1.6 Flujo mensual recomendado

Para una entidad pequeña, el orden de trabajo mensual más seguro suele ser:

1. Importar el extracto bancario pendiente.
2. Revisar movimientos nuevos y categorizar lo dudoso.
3. Resolver remesas, cobros SEPA o pagos pendientes si toca.
4. Revisar devoluciones.
5. Imputar Stripe si hay abonos online.
6. Adjuntar o ordenar documentos importantes.
7. Mirar el dashboard del periodo cerrado para ver si queda alguna alerta relevante.

Si trabajas así durante el año, enero deja de convertirse en un mes de reconstrucción manual.

---

# 2. Configuración inicial [id:2-configuracio-inicial]

## 2.1 Configuración de usuario y del equipo

### Idioma de la aplicación

Se cambia desde **Configuración** y es individual para cada usuaria.

### Cambiar contraseña

1. Ve a **Configuración**.
2. Busca **Cambiar contraseña**.
3. Escribe la actual, la nueva y la confirmación.
4. Guarda.

### Miembros

Si tienes rol de administración:
1. Ve a **Configuración > Miembros**.
2. Haz clic en **Invitar miembro**.
3. Indica email y rol.
4. Envía la invitación.

Puntos importantes:
- el rol general no siempre equivale a todos los permisos específicos
- los informes fiscales suelen requerir permiso adicional

## 2.2 Datos de la organización

### Qué conviene revisar

Antes de trabajar en serio revisa:
- nombre legal
- CIF/NIF
- dirección
- código postal
- datos que luego aparecerán en certificados o informes

### Certificados de donación dentro de Configuración

Si vais a emitir certificados, revisa también:
- logo
- firma digitalizada
- datos fiscales correctos

## 2.3 Gestionar categorías

### Acciones habituales

Desde **Configuración > Categorías** puedes:
- crear categorías nuevas
- revisar si faltan categorías habituales
- archivar categorías cuando ya no deban usarse

Conviene mantenerlas ordenadas porque afectan a:
- dashboard
- movimientos
- informes
- asignaciones automáticas

## 2.4 Cuentas bancarias

Registra aquí todos los bancos de la entidad.

Es importante para:
- importar extractos correctamente
- filtrar movimientos por cuenta
- generar remesas SEPA

Si usáis remesas de cobro, comprueba que el banco tenga informado el **ICS / Identificador de acreedor SEPA**.

## 2.5 Módulos opcionales

Algunas entidades usan solo:
- movimientos
- donantes
- informes

Otras además usan:
- proyectos
- documentos pendientes
- liquidaciones

No hace falta arrancar con todo el mismo día.

## 2.6 Logo y firma digitalizada

### Logo

Sirve para reforzar:
- certificados
- documentos exportados

### Firma

Es especialmente útil para certificados de donación.

Sube una imagen limpia y legible.

---

# 3. Gestión de donantes [id:3-gestio-de-donants]

## 3.1 Por qué importa tener datos completos

Los donantes bien informados facilitan:
- el Modelo 182
- los certificados
- el matching en remesas
- el seguimiento histórico

### Datos obligatorios para el Modelo 182

Como mínimo revisa:
- nombre completo
- DNI/CIF
- código postal

### Datos muy recomendables

También ayudan mucho:
- email
- IBAN cuando sea socio domiciliado
- periodicidad
- categoría por defecto si procede

## 3.2 Añadir un donante manualmente

### Paso a paso

1. Ve a **Donantes**.
2. Haz clic en **Nuevo donante**.
3. Rellena los datos básicos.
4. Guarda.

### Persona de contacto

Si el donante es una entidad y gestionáis una persona de contacto, conviene dejarla informada para no perder contexto.

### Qué es la categoría por defecto

Si un donante o socio siempre entra por una categoría concreta, la categoría por defecto ayuda a clasificar automáticamente futuros ingresos.

## 3.3 Importar donantes desde Excel

### Paso a paso

1. Ve a **Donantes**.
2. Abre el importador.
3. Descarga la plantilla oficial si la necesitas.
4. Sube el Excel.
5. Revisa la detección de columnas.
6. Importa.

### Columnas de la plantilla oficial

La plantilla oficial es la vía más segura porque minimiza el mapeo manual.

### Categoría por defecto

Puede importarse si ya la tienes clara y existe en la entidad.

## 3.4 Actualizar donantes existentes

### Paso a paso

1. Usa la importación de actualización.
2. Sube el Excel.
3. Revisa qué campos se modificarán.
4. Confirma.

### Qué se actualiza y qué no

La importación sirve para mantener datos vivos, pero conviene revisar campos sensibles como:
- NIF
- IBAN
- periodicidad

## 3.5 Gestionar el estado del donante

### Cómo dar de baja a un donante

No lo borres si solo ha dejado de colaborar. Márcalo como baja para conservar:
- histórico
- certificados de años anteriores
- relación con remesas y devoluciones

### Cómo reactivarlo

Abre su ficha y vuelve a dejarlo activo.

## 3.6 La ficha del donante

Desde la ficha puedes revisar:
- datos personales o fiscales
- histórico de cuotas y donaciones
- devoluciones asociadas
- resumen anual

## 3.7 Asignación automática de cuotas y aportaciones

Cuando procesas una remesa o imputas ciertos flujos, Summa puede repartir automáticamente el ingreso a la persona correcta si el matching es suficiente.

## 3.8 Cómo impactan las devoluciones en el donante

Las devoluciones no son un detalle menor:
- reducen el neto anual del donante
- afectan al Modelo 182
- pueden dejar un certificado en cero o sin generar

## 3.9 Exportar la lista de donantes

Úsalo cuando necesites:
- compartir datos con gestoría
- revisar fuera de la app
- preparar limpieza de datos

## 3.10 Filtrar donantes

### Filtros disponibles

Según la pantalla y permisos, puedes filtrar por:
- estado
- periodicidad
- tipo de donante
- texto

### Cómo funciona

Los filtros sirven para trabajar por lotes sin tocar toda la base.

## 3.11 Dinámica de donantes

Es la parte pensada para entender mejor:
- socios activos
- donantes activos
- bajas
- recurrencia

Úsala para seguimiento, no como sustituto de la ficha individual.

---

# 4. Gestión de proveedores y trabajadores [id:4-gestio-de-proveidors-i-treballadors]

## 4.1 Gestionar proveedores

### Cuándo es importante

Especialmente cuando:
- trabajas con facturas recurrentes
- generas remesas de pago
- necesitas preparar el Modelo 347

### Paso a paso para añadir un proveedor

1. Ve a **Proveedores**.
2. Crea un proveedor nuevo o impórtalo.
3. Completa datos básicos y, si aplica, el IBAN.
4. Guarda.

### Importar proveedores desde Excel

Si ya los tienes en hoja de cálculo, la importación ahorra mucho tiempo.

### Categoría por defecto

Puede ayudarte a clasificar pagos recurrentes al mismo proveedor.

### Proveedores eliminados y reimportación

Si una entidad ya existía y fue archivada o eliminada del circuito habitual, revísalo antes de crear duplicados.

## 4.2 Gestionar trabajadores

### Paso a paso

1. Ve a **Trabajadores**.
2. Crea o importa la ficha.
3. Completa los datos relevantes.
4. Guarda.

Esto ayuda a ordenar:
- nóminas
- seguridad social
- informes internos

---

# 5. Gestión de movimientos [id:5-gestio-de-moviments]

## 5.1 Importar el extracto del banco

### Formatos soportados

Summa admite importación bancaria en formatos habituales como CSV y Excel, según el banco.

### Paso a paso

1. Ve a **Movimientos**.
2. Haz clic en **Importar extracto**.
3. Selecciona el archivo.
4. Revisa la vista previa.
5. Confirma la importación.

### Sobre los duplicados

El sistema intenta detectar duplicados antes de escribir:
- referencia bancaria
- fecha operativa
- importe
- otros invariantes del flujo

Si el sistema marca un solapamiento, revisa antes de confirmar.

## 5.2 Cómo funciona la autoasignación inteligente

### Fase 1: matching por nombre

Intenta reconocer personas o entidades conocidas a partir de la descripción del banco.

### Fase 2: inteligencia artificial

Si no basta con reglas simples, la IA puede sugerir categoría, siempre dentro de las opciones reales.

### Fase 3: categoría por defecto

Si un contacto tiene categoría por defecto, Summa puede aprovecharla para acelerar la clasificación.

### Reglas automáticas de categorización

Hay reglas deterministas para casos típicos, por ejemplo:
- lotería
- voluntariado
- Bizum
- subvenciones
- nóminas
- seguridad social
- impuestos
- suministros
- telecomunicaciones

Si la regla no encuentra una categoría compatible real, no fuerza nada y deja seguir el flujo normal.

## 5.3 La tabla de movimientos

### El botón "Filtros"

Te permite acotar por:
- fecha
- categoría
- contacto
- cuenta bancaria
- origen
- pendientes

### El menú de opciones (⋮)

Desde aquí haces acciones importantes como:
- editar
- marcar una donación fiscal
- abrir Stripe si aplica
- otras acciones según el tipo de movimiento

## 5.4 Editar movimientos

Se usa para corregir o completar:
- categoría
- contacto
- notas
- algunos campos editables del registro

## 5.4b Marcar una donación para que cuente en el 182 [id:5-4b-marcar-donacio-fiscal-182]

### Qué es

Sirve para indicar que un ingreso concreto debe tratarse como donación fiscal dentro del producto.

### Cuándo se usa

Cuando el ingreso no viene ya resuelto por:
- una remesa dividida
- una imputación Stripe correcta
- otro flujo que ya deja la donación fiscal bien identificada

### Paso a paso

1. Abre el movimiento.
2. Revisa que el contacto sea correcto.
3. Marca la opción fiscal correspondiente.
4. Guarda.

### Qué cuenta automáticamente sin tocar este botón

Ya entran por su propio flujo:
- cuotas de remesas IN bien divididas
- Stripe correctamente imputado a donante
- desgloses manuales ya creados como donación

### Errores habituales

- marcar como donación algo que en realidad es otro ingreso
- no revisar el donante antes de confirmar
- olvidar que las devoluciones reducen el neto del año

### Dónde encontrarlo en Summa

**Movimientos > detalle del movimiento**

## 5.5 Adjuntar documentos con drag & drop

### Paso a paso

1. Ve a la tabla de movimientos.
2. Arrastra el archivo sobre la fila o abre el cargador.
3. Espera a que quede vinculado.

Úsalo para:
- facturas
- tickets
- justificantes
- documentos asociados al movimiento

## 5.6 Captura de tickets en viaje [id:capture]

### Paso a paso

1. Desde móvil o escritorio, abre la captura rápida o el flujo disponible.
2. Sube el ticket.
3. Completa datos mínimos si faltan.
4. Guarda.

La idea es capturar rápido y completar después si hace falta.

## 5.7 Selección múltiple y acciones en bloque [id:bulk-actions]

### Paso a paso

1. Selecciona varias filas.
2. Revisa cuántas has marcado.
3. Aplica la acción masiva.
4. Verifica el resultado.

Suele ser útil para:
- asignar categoría
- quitar categoría
- limpiar trabajo repetitivo

## 5.8 Banner de devoluciones pendientes

Si el sistema detecta devoluciones sin resolver, verás un aviso para entrar a revisarlas.

No conviene ignorarlo si se acerca:
- cierre mensual
- emisión de certificados
- Modelo 182

---

# 6. Divisor de remesas [id:6-divisor-de-remeses]

## 6.1 Qué es una remesa

Una remesa de cobro entra al banco como un ingreso agrupado. Para saber quién pagó qué y dejar trazabilidad por socio, hace falta dividirla.

### Por qué hay que dividirla

Sin división:
- no ves el detalle real por persona
- el histórico del donante queda incompleto
- el 182 puede salir mal

## 6.2 Qué necesitas antes de empezar

1. El movimiento agregado ya importado en **Movimientos**.
2. El fichero de detalle de la remesa.
3. La base de donantes razonablemente actualizada.

## 6.3 Dividir remesa

### Qué es

Es el flujo para convertir un único cobro agregado en cuotas o aportaciones individuales.

### Cuándo se usa

Cuando recibes un ingreso agrupado del banco y necesitas repartirlo por socio o donante.

### Paso a paso

1. Ve a **Movimientos**.
2. Localiza la remesa.
3. Abre el menú **⋮**.
4. Elige **Dividir remesa**.
5. Sube el fichero de detalle.
6. Mapea columnas si hace falta.
7. Revisa el matching.
8. Procesa.

### Errores habituales

- usar el fichero del mes equivocado
- procesar sin revisar suficientes pendientes
- asumir que todo el matching es correcto sin mirar casos dudosos

### Dónde encontrarlo en Summa

**Movimientos > fila de la remesa > ⋮ > Dividir remesa**

## 6.4 Socios de baja detectados

Si una remesa contiene personas dadas de baja:
- revísalo antes de procesar
- confirma si realmente debían estar en ese cobro

## 6.5 Vista agrupada de remesas

La remesa puede seguir viéndose como una sola línea en la tabla, pero con acceso al detalle procesado.

### Cómo ver el detalle de las cuotas

Haz clic en el badge o en el detalle asociado a la remesa.

## 6.6 Guardar la configuración de columnas

Si siempre trabajas con el mismo banco o el mismo fichero, guardar la configuración te ahorra repetir el mapeo.

## 6.7 Deshacer remesa

### Qué es

Permite revertir una remesa ya procesada para volver a dejar el movimiento padre en estado original.

### Cuándo se usa

Cuando:
- has subido el fichero equivocado
- el matching está mal
- el mes no corresponde

### Paso a paso

1. Localiza la remesa procesada.
2. Abre su detalle.
3. Haz clic en **Deshacer remesa**.
4. Confirma.

### Errores habituales

- intentar reprocesar sin deshacer antes
- no revisar qué parte del trabajo dependía ya de esa remesa

### Dónde encontrarlo en Summa

**Detalle de la remesa procesada**

## 6.a Remesas SEPA de cobro [id:6a-remeses-sepa-de-cobrament]

### Antes de empezar

Para generar la remesa:
- el banco debe tener ICS informado
- los socios deben tener IBAN válido
- la periodicidad debe estar razonablemente bien informada

### Cómo generar la remesa

1. Ve a **Donantes > Remesas de cobro**.
2. Selecciona cuenta y periodicidad.
3. Revisa la preselección automática.
4. Añade o quita socios si hace falta.
5. Genera el XML.
6. Súbelo manualmente al banco.

### Compatibilidad bancaria

Conviene validar el XML con el banco si es la primera vez.

### Validaciones y casos habituales

Problemas comunes:
- socio sin IBAN
- periodicidad no informada
- ICS ausente

### Después del cobro

Cuando el banco ejecute la remesa:
1. importa el extracto
2. localiza el ingreso agregado
3. usa el divisor de remesas si necesitas el detalle individual

---

# 6b. Documentos pendientes y remesas SEPA OUT [id:6b-documents-pendents]

## 6b.1 Qué son los documentos pendientes

Es la bandeja para trabajar facturas, nóminas o justificantes que todavía no han pasado a pago definitivo.

Sirve para:
- subir documentos
- completar datos
- preparar remesas de pago
- conciliar luego la salida bancaria

## 6b.2 Subir documentos pendientes

### Opción A: con el botón "Subir"

1. Entra en **Movimientos > Pendientes**.
2. Haz clic en **Subir**.
3. Selecciona archivos.
4. Revisa lo extraído o completa lo que falte.

### Opción B: arrastrando archivos

También puedes arrastrarlos directamente a la pantalla.

### Renombrado sugerido

El sistema puede sugerir nombres útiles para mantener orden documental.

### Estados de un documento

Los estados ayudan a saber si:
- falta revisar
- ya está preparado
- ya fue incluido en remesa
- ya quedó conciliado

## 6b.3 Generar remesa SEPA (pain.001)

### Requisitos

Antes de incluir un documento en la remesa revisa:
- beneficiario correcto
- IBAN
- importe

### Paso a paso

1. Selecciona los documentos válidos.
2. Haz clic en **Generar remesa SEPA**.
3. Revisa el resumen.
4. Genera el XML.

### Qué hacer con el XML

El fichero no se envía solo. Debes subirlo tú al portal del banco.

## 6b.4 Desagregar y conciliar

### Cómo funciona la detección

Cuando importas el extracto y aparece un pago agregado, Summa intenta relacionarlo con la remesa pendiente.

### Paso a paso para conciliar

1. Importa el extracto.
2. Localiza el movimiento de salida.
3. Abre la propuesta de conciliación.
4. Revisa el detalle.
5. Confirma.

### Qué pasa al hacer clic en "Confirmar"

La remesa queda vinculada al movimiento agregado y evita doble cómputo.

### Resultado final

Tendrás:
- movimiento padre claro
- pagos vinculados
- documentos ya situados en su estado correcto

## 6b.5 Casos especiales

### Documentos a los que les faltan datos

No conviene meterlos en remesa sin revisar:
- importe
- beneficiario
- IBAN

### Remesa parcialmente ejecutada

Si el banco rechaza parte de la remesa, hay que revisar los pagos afectados manualmente.

### Archivar documentos

Archiva cuando ya no deban estar en trabajo operativo.

---

# 6c. Liquidaciones de gastos de viaje [id:6c-liquidacions-de-despeses-de-viatge]

## 6c.1 Dos formas de trabajar

Normalmente trabajarás con:
- tickets y justificantes
- kilometraje

## 6c.2 Cómo se organiza la pantalla

La vista suele separar:
- resumen
- tickets
- kilometraje
- export o PDF

## 6c.3 Añadir tickets con drag & drop

Arrastra el ticket o súbelo desde la pantalla de liquidación.

## 6c.4 Kilometraje

Registra los kilómetros y revisa el cálculo antes de cerrar.

## 6c.5 Generar PDF

Cuando la liquidación esté lista:
1. revisa el contenido
2. genera el PDF
3. compártelo o guárdalo según el circuito de la entidad

---

# 7. Gestión de devoluciones bancarias [id:7-gestio-de-devolucions]

## 7.1 Qué es una devolución

Es un recibo que el banco no ha podido cobrar y devuelve.

### Motivos habituales

- cuenta cancelada
- saldo insuficiente
- IBAN erróneo

### Por qué es importante gestionarla bien

Porque afecta a:
- neto anual del donante
- histórico real
- Modelo 182
- certificados

## 7.2 Cómo saber si tengo devoluciones pendientes

Lo verás en:
- dashboard
- banner de movimientos
- listados específicos

## 7.3 Asignar devoluciones manualmente

### Paso a paso

1. Abre la devolución.
2. Busca el donante correcto.
3. Asócialo manualmente.
4. Guarda.

Úsalo cuando hay pocos casos o el fichero bancario no ayuda.

## 7.4 Importar devoluciones del banco

### Bancos soportados

Depende del formato bancario disponible en el flujo.

### Paso a paso

1. Ve a **Movimientos**.
2. Abre **Importar devoluciones del banco**.
3. Sube el fichero.
4. Revisa propuestas de matching.
5. Corrige pendientes.
6. Procesa.

### Cómo hace el matching

Se basa en la información disponible del banco y en la base de donantes ya existente.

## 7.5 Devoluciones agrupadas (remesas)

Si el banco agrupa varias devoluciones en un único movimiento, Summa permite tratarlas como remesa de devoluciones.

## 7.6 Remesas parciales

Cuando solo parte de la remesa puede resolverse:
- procesa solo cuando entiendas lo que queda pendiente
- corrige datos y vuelve a revisar

## 7.7 Impacto en los informes

Las devoluciones:
- restan al neto del donante
- pueden sacar a una persona del 182 si el total neto queda en cero o menos

## 7.8 Deshacer una remesa de devoluciones

### Paso a paso

1. Localiza la remesa de devoluciones ya procesada.
2. Abre el detalle.
3. Haz clic en **Deshacer remesa**.
4. Confirma.

Usa esto si se procesó mal o si el matching era incorrecto.

## 7.9 Checklist mensual de devoluciones

### Flujo mensual

1. Importa el extracto del mes.
2. Revisa si hay banner de devoluciones pendientes.
3. Sube el fichero de devoluciones si lo tienes.
4. Corrige los casos no resueltos.
5. Comprueba el impacto en la ficha del donante.

### Antes de enero

Antes de generar el 182:
- deja resueltas las devoluciones del año
- comprueba que no queda pendiente nada fiscalmente relevante

---

# 8. Donaciones vía Stripe [id:8-donacions-via-stripe]

## 8.1 Qué es Stripe y cómo funciona

Stripe agrupa varias donaciones online y transfiere al banco un neto después de comisiones.

### El problema

En el banco ves una sola transferencia, pero realmente puede incluir:
- varias donaciones
- comisiones
- ajustes

## 8.2 Cómo imputar un payout de Stripe [id:stripe]

### Paso 1: localiza el movimiento

Ve a **Movimientos** y busca el abono de Stripe.

### Paso 2: abre la imputación

Menú **⋮** → **Imputar Stripe**

### Paso 3: importa desde Stripe

1. Haz clic en **Importar desde Stripe**.
2. Summa carga payouts recientes en estado `paid`.
3. Elige el que cuadra con el banco.
4. Cárgalo.

Esta es la vía principal.

### Paso 4: usa CSV solo como vía secundaria

Si la sync no está disponible:
1. entra en Stripe
2. exporta pagos con columnas estándar
3. sube el CSV a Summa

No conviene abrirlo ni modificarlo con Excel antes.

### Paso 5: revisa el matching

El sistema intenta identificar por email.

Estados habituales:
- **Identificado**
- **Pendiente de asignación**

No confirmes si todavía quedan pendientes críticos.

### Paso 6: verifica que cuadra

Revisa:
- total imputado
- importe del banco
- diferencia

Si hay diferencia, entiéndela antes de confirmar.

### Paso 7: confirma la imputación

Al confirmar:
- el movimiento del banco se conserva como padre
- el payout queda marcado como imputado
- la imputación se escribe en `donations`
- el ledger principal no se llena de líneas hijas nuevas

Si te equivocas:
- usa **Deshacer imputación Stripe**
- vuelve a imputar el payout limpio

## 8.3 Buenas prácticas

- empieza por **Importar desde Stripe**
- deja el CSV o la edición manual como plan B
- revisa todos los pendientes de asignación
- no intentes arreglarlo creando movimientos manuales en el ledger
- si algo salió mal, deshaz y repite limpio

---

# 9. Informes fiscales [id:9-informes-fiscals]

### Acceso a la generación fiscal (182 / 347)

Los modelos fiscales se generan desde **Informes** y pueden requerir permiso específico.

## 9.1 Modelo 182 — Declaración de donaciones

### Qué es

La declaración informativa de donativos.

### Plazo

**31 de enero** del año siguiente.

### Requisitos por donante

Revisa como mínimo:
- nombre
- DNI/CIF
- código postal

### Paso a paso (Excel para gestoría)

1. Ve a **Informes > Modelo 182**.
2. Elige el año.
3. Revisa alertas y excluidos.
4. Corrige datos si hace falta.
5. Genera el Excel.

### De dónde sale lo que ves en el 182

Dentro de Summa cuentan como donación fiscal:
- ingresos marcados correctamente
- remesas IN bien divididas
- Stripe imputado a donante
- desgloses manuales ya clasificados como donación

No entran:
- pendientes sin revisar
- Stripe sin donante
- devoluciones sin imputar

### Exportación directa a la AEAT (fichero oficial)

Además del Excel, Summa puede generar el fichero oficial `.txt`.

Paso corto:
1. genera el informe
2. haz clic en **Export AEAT (fichero oficial)**
3. descarga el `.txt`
4. súbelo a la sede electrónica

Si hay donantes excluidos, revísalos antes de presentar.

## 9.2 Modelo 347 — Operaciones con terceros

### Qué es

La declaración de operaciones con terceros que superan el umbral legal.

### Plazo

**28 de febrero**

### Paso a paso

1. Ve a **Informes > Modelo 347**.
2. Elige el año.
3. Revisa NIF y datos mínimos.
4. Genera el CSV o export correspondiente.

## 9.3 Certificados de donación

### Certificado individual

1. Abre la ficha del donante.
2. Haz clic en **Generar certificado**.
3. Elige el año.
4. Descarga el PDF.

### Certificados masivos

1. Ve a **Informes > Certificados**.
2. Elige el año.
3. Genera todos o una selección.

### Enviar certificados por email desde Summa

Si el flujo está habilitado:
- puedes enviar individualmente
- o en bloque

Antes de enviar revisa:
- que el donante tenga email
- que el total neto sea positivo
- que el año sea correcto

## 9.4 Cierre de mes

Circuito recomendado:

1. Importa el último extracto pendiente.
2. Revisa movimientos sin categoría o sin contacto.
3. Resuelve remesas, devoluciones y Stripe pendientes.
4. Comprueba si faltan documentos relevantes.
5. Revisa el dashboard con el mes ya cerrado.
6. Si necesitas compartir el resultado, prepara el resumen o el paquete del periodo.

No se trata de bloquear el mes de forma contable dentro de la app, sino de dejar el periodo suficientemente limpio para gobernanza interna, junta o gestoría.

## 9.5 Cierre de año fiscal

Antes de generar el 182 y los cierres anuales, revisa como mínimo:

1. Donantes con DNI/CIF o código postal incompletos.
2. Devoluciones sin asignar.
3. Stripe sin donante asignado.
4. Remesas todavía sin dividir cuando afectan a cuotas o donaciones.
5. Certificados y datos de entidad si vais a enviarlos desde la app.
6. Paquete de cierre si debes entregar documentación a contabilidad o auditoría.

La mejor estrategia es llegar a enero con el trabajo revisado durante el año, no empezar entonces desde cero.

---

# 10. Proyectos y justificación de subvenciones [id:10-projectes]

## 10.1 Ejes de actuación (uso básico) [id:8-projectes-eixos-dactuacio]

### Cuándo usarlos

Cuando necesitas una clasificación básica por área o línea de trabajo sin entrar todavía en el módulo avanzado.

### Crear un proyecto

1. Ve a **Proyectos**.
2. Crea el eje o proyecto.
3. Pon nombre y datos mínimos.
4. Guarda.

### Asignar movimientos

Una vez creado, podrás vincular movimientos relacionados.

## 10.2 Módulo de Proyectos (avanzado) [id:6-gestio-de-projectes]

### Antes de empezar

Tiene sentido cuando necesitas:
- justificar subvenciones
- repartir gastos por proyecto
- trabajar presupuesto y ejecución

### Navegación

Dentro del módulo verás vistas de:
- proyectos
- gastos
- presupuesto
- asignaciones

### Pantalla de Gestión Económica [id:6-assignacio-de-despeses]

Es la pantalla clave para revisar y repartir gasto real.

### Qué encontrarás en esta pantalla

Suele incluir:
- listado de gastos
- filtros
- detalle
- asignaciones

### Buscador y filtros

Úsalos para localizar:
- un gasto concreto
- un proyecto
- pendientes de revisión

### Imputar un gasto a proyecto

1. Abre el gasto.
2. Selecciona proyecto o partida.
3. Indica porcentaje o importe según el flujo.
4. Guarda.

### Cuando un gasto va a varios proyectos

El mismo gasto puede repartirse si la pantalla lo permite. Revisa siempre el total antes de confirmar.

### Cómo se ve en el listado general

El listado principal debe dejar claro:
- si el gasto está asignado
- a qué proyecto
- con qué reparto

### Cómo se ve dentro de cada proyecto

Cada proyecto debería reflejar solo la parte que realmente le corresponde.

### Qué pasa si cambias el porcentaje

El reparto y los importes vinculados se actualizan según el flujo de asignación.

### Crear y editar gastos de terreno

Si trabajas con gastos de terreno o captura rápida, puedes crear registros específicos y completarlos más adelante.

### Gestión de documentos en la misma tabla

Puedes adjuntar justificantes en el propio circuito del gasto para no irte a herramientas externas.

### Detalle de un gasto bancario

Desde el detalle puedes revisar:
- origen
- documento
- asignación
- proyecto

## 10.3 Gestión económica del proyecto (presupuesto)

### Dónde encontrarla

Dentro del proyecto o en la vista de presupuesto.

### Qué encontrarás

- partidas
- importe previsto
- ejecución
- desvíos

### Si todavía no tienes partidas

Puedes empezar con una estructura mínima y refinar después.

### Crear partidas manualmente

Útil cuando el presupuesto es pequeño o todavía no tienes Excel definitivo.

### Importar partidas desde Excel

Útil cuando la subvención o el presupuesto ya viene estructurado.

### Entender cada partida

Conviene revisar:
- nombre
- importe previsto
- agrupación
- ejecución asociada

### Editar o eliminar partidas

Hazlo con cuidado si ya hay gasto asignado.

### Moneda local y tipo de cambio (FX)

Si el proyecto trabaja con moneda local:
- revisa el tipo de cambio
- entiende cuándo es manual y cuándo se reaplica

### Transferencias FX

Las transferencias en moneda extranjera requieren revisar la conversión para no deformar la justificación.

### Reaplicar tipo de cambio

Solo conviene hacerlo si entiendes qué registros dependen de ese valor.

### Ver gastos del proyecto o de una partida

Usa los filtros del propio módulo para bajar al detalle real.

## 10.4 Modo "Cuadrar justificación"

### Dos modos

Este modo ayuda a decidir si:
- trabajas desde el presupuesto hacia el gasto
- o desde el gasto real hacia la justificación

## 10.5 Captura de gastos de terreno

### Cómo funciona

Sirve para capturar rápido:
- facturas
- recibos
- nóminas
- gastos todavía incompletos

### Desde el móvil

Es útil para subir evidencia en el momento y completar después desde escritorio.

## 10.6 Exportar justificación a Excel

### Cómo hacerlo

1. Abre el proyecto.
2. Ve a la vista de justificación o presupuesto.
3. Exporta el Excel.

### Qué contiene el Excel

Normalmente incluye:
- gastos asignados
- partidas
- importes
- datos de apoyo para revisión

## 10.7 Drag & drop de documentos

### Qué conviene saber

Ayuda a mantener unidos:
- el gasto
- el justificante
- la futura exportación o auditoría

---

# 10b. Paquete de cierre

## 10b.1 Qué es el Paquete de cierre

Es un ZIP pensado para cierres, revisión externa o gestoría.

Puede incluir:
- Excel de movimientos
- documentos adjuntos
- resumen
- material de apoyo

## 10b.2 Cómo generarlo

### Paso a paso

1. Ve a **Movimientos**.
2. Abre el menú **⋮**.
3. Elige **Paquete de cierre**.
4. Selecciona el periodo.
5. Genera el ZIP.

### Límites

Si el periodo es demasiado grande o tiene demasiados documentos, prueba por meses o trimestres.

## 10b.3 Contenido del ZIP

Revísalo antes de enviarlo fuera de la entidad.

## 10b.4 `movimientos.xlsx`

Es el fichero principal para revisión contable u operativa.

### Cómo relacionar movimientos con documentos

La gracia del paquete es que el Excel y los documentos se puedan seguir sin entrar en la app.

## 10b.5 Carpeta `debug/`

Es material técnico. Normalmente no hace falta enviarlo.

## 10b.6 Qué enviar a contabilidad

Para un cierre estándar suele bastar con:
- ZIP principal
- Excel de movimientos
- documentos relevantes

## 10b.7 Preguntas frecuentes

### Por qué faltan documentos

Suele significar que:
- no estaban adjuntos
- o no se pudieron descargar correctamente

### Puedo generar paquetes de periodos anteriores

Sí, si los datos y documentos siguen estando en el sistema.

### El ZIP tarda mucho

Es normal si el periodo tiene muchos documentos.

### Los importes salen como texto en Excel

Puede depender de la configuración regional de Excel.

---

# 11. Resolución de problemas [id:11-resolucio-de-problemes]

## 11.0 Cómo buscar ayuda dentro de Summa

Dentro del producto tienes tres ayudas reales:
- `?` contextual
- manual
- bot

Úsalas así:
- si estás dentro de una pantalla concreta, empieza por `?`
- si el proceso es largo o sensible, abre el manual
- si no sabes ni por dónde empezar, pregunta al bot

## 11.1 Problemas de acceso

Casos típicos:
- email o contraseña incorrectos
- invitación no encontrada
- sesión cerrada por seguridad

Si no recuerdas la contraseña, usa el flujo de recuperación desde login.

## 11.2 Problemas con datos

Casos típicos:
- importaste el extracto dos veces
- no ves algo por el filtro de fechas
- un dato fiscal está incompleto

## 11.3 Problemas con remesas

Casos típicos:
- el fichero no corresponde
- el matching es malo
- necesitas deshacer para volver a procesar

## 11.3b Problemas con remesas SEPA (pain.008)

Casos típicos:
- falta ICS
- el socio no tiene IBAN
- la periodicidad no permite preselección
- el banco rechaza el XML

## 11.4 Problemas con informes

Casos típicos:
- el 182 excluye donantes
- las devoluciones no cuadran
- el certificado no se genera

## 11.5 Mensajes de error habituales

Ejemplos típicos:
- falta de permisos
- datos incompletos
- IBAN no válido
- duplicado detectado

Cuando haya duda:
1. copia el mensaje exacto
2. anota qué estabas haciendo
3. reintenta
4. si persiste, usa bot o soporte con el texto literal

---

# 12. Glosario [id:12-glossari]

| Término | Definición |
|---|---|
| Remesa | Cobro o pago agrupado |
| Devolución | Recibo retornado por el banco |
| Payout | Transferencia de Stripe al banco |
| Modelo 182 | Declaración informativa de donaciones |
| Modelo 347 | Operaciones con terceros |
| Socio | Donante recurrente |
| Matching | Identificación automática de la persona o entidad correcta |
| Proyecto | Estructura para justificar y ordenar gasto |
| Paquete de cierre | ZIP con movimientos y documentos para revisión externa |

---

# Nota final

La idea de Summa no es que sepas contabilidad técnica avanzada dentro de la app, sino que puedas llevar una operativa limpia, revisable y fiscalmente defendible sin depender de hojas sueltas.

Si algo no cuadra, no fuerces el dato:
- revisa
- deja pendiente lo dudoso
- usa el flujo correcto
- y deshaz cuando el producto lo permita

Eso es mucho más seguro que improvisar.
