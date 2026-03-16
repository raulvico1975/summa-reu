# SUMMA SOCIAL - Manual de Usuario

**Versión**: 1.46
**Última actualización**: 16 marzo 2026

---

## Nota de esta iteración

Este manual runtime alinea ya los 8 microflujos activos de ayuda en español.

Flujos alineados en esta iteración:
- Importar extracto bancario
- Detectar duplicados al importar
- Editar datos de un donante
- Cambiar cuota de un socio
- Dividir remesa
- Deshacer remesa
- Importar devoluciones del banco
- Generar el Modelo 182

Fuera de esta iteración, algunas secciones siguen resumidas a propósito para conservar anchors y navegación sin rediseñar el producto.

---

## 14. Entender el dashboard [id:14-entendre-el-dashboard]

Sección conservada para navegación.

En esta iteración no se amplía su contenido. Usa el `?` del dashboard para ayuda inmediata y entra al manual de la tarea concreta cuando trabajes con movimientos, donantes o informes.

---

## 2. Configuración inicial [id:2-configuracio-inicial]

Sección conservada para navegación.

En esta iteración no se amplía. Si vas a trabajar remesas o informes, verifica antes que los datos de la organización y las cuentas bancarias estén completos.

---

## 3. Gestión de donantes [id:3-gestio-de-donants]

### 3.6 Editar datos de un donante y cambiar la cuota de un socio

#### Qué es

La ficha del donante es el lugar donde mantienes al día los datos que afectan operativa, remesas y fiscalidad. Desde aquí editas la ficha y, si es socio, también la cuota.

#### Cuándo se utiliza

- Cuando ha cambiado un dato del donante
- Cuando un socio cambia la cuota o la periodicidad
- Cuando quieres corregir datos antes de una remesa o del Modelo 182

#### Paso a paso

1. Ve a **Donantes** y abre la ficha del donante.
2. Haz clic en **"Editar"**.
3. Actualiza solo los datos que hayan cambiado: nombre, DNI/CIF, código postal, email, teléfono o IBAN.
4. Si es socio, revisa **Importe de cuota (por cobro)** y **Periodicidad**.
5. Haz clic en **"Guardar donante"**.

#### Errores habituales

- Crear un donante nuevo cuando lo correcto era editar el registro existente
- Cambiar la cuota sin revisar IBAN o datos fiscales antes de remesas o del Modelo 182

#### Dónde encontrarlo en Summa

**Donantes > Ficha del donante > Editar**

---

## 4. Gestión de proveedores y trabajadores [id:4-gestio-de-proveidors-i-treballadors]

Sección conservada para navegación.

En esta iteración no se amplía.

---

## 5. Gestión de movimientos [id:5-gestio-de-moviments]

### 5.1 Importar extracto bancario

#### Qué es

Es el flujo para cargar nuevos movimientos del banco en Summa sin crear duplicados ni mezclar cuentas.

#### Cuándo se utiliza

- Cuando descargas un CSV o Excel del banco
- Cuando necesitas cargar un periodo nuevo en **Movimientos**
- Cuando quieres validar si un fichero ya se había importado

#### Paso a paso

1. Descarga el extracto del banco en **CSV** o **Excel**.
2. Ve a **Movimientos** y haz clic en **"Importar"**.
3. Selecciona la cuenta bancaria correcta antes de subir el fichero.
4. Revisa la previsualización y el bloque de **duplicados seguros** antes de confirmar.
5. Importa solo cuando fechas, importes y descripciones cuadren.

#### Errores habituales

- Confirmar la importación sin revisar cuenta, previsualización o duplicados
- Abrir y guardar el CSV con Excel si eso altera separadores o decimales

#### Dónde encontrarlo en Summa

**Movimientos > Importar extracto bancario**

### Detectar duplicados al importar

Usa el mismo flujo de importación. Antes de confirmar, revisa el bloque **Duplicados seguros** y, si hace falta, **Ver por qué**. No confirmes hasta tener claro qué líneas son nuevas y cuáles ya existían.

---

## 6. Divisor de remesas [id:6-divisor-de-remeses]

### 6.3 Dividir remesa

#### Qué es

Es el flujo posterior al banco para separar una remesa operativa en líneas individuales dentro de **Movimientos**.

#### Cuándo se utiliza

- Cuando has importado un ingreso grande que agrupa muchas cuotas o recibos
- Cuando necesitas identificar cada línea antes de continuar
- Cuando la remesa todavía no se ha procesado

#### Paso a paso

1. Ve a **Movimientos** y abre el detalle de la remesa.
2. Haz clic en **"Dividir remesa"**.
3. Sube el fichero de detalle del banco si hace falta y revisa el mapeo.
4. Revisa el matching antes de procesar.
5. Confirma solo cuando tengas claro qué líneas quedarán en cada remesa.

#### Errores habituales

- Asignar contacto o categoría al movimiento padre antes de dividir la remesa
- Procesar toda la remesa sin revisar el matching

#### Dónde encontrarlo en Summa

**Movimientos > Detalle de remesa > Dividir remesa**

### 6.7 Deshacer remesa

#### Qué es

Es el flujo de undo para devolver una remesa procesada al punto anterior y poder revisarla o reprocesarla bien.

#### Cuándo se utiliza

- Cuando la remesa se ha procesado con el fichero equivocado
- Cuando el matching o la separación han quedado mal
- Cuando necesitas volver al estado original antes de repetir el proceso

#### Paso a paso

1. Ve a **Movimientos** y localiza la remesa procesada.
2. Abre su detalle desde el movimiento padre o desde el badge.
3. Haz clic en **"Deshacer remesa"**.
4. Revisa la información mostrada y confirma.
5. Cuando vuelva al estado original, ya podrás procesarla otra vez correctamente.

#### Errores habituales

- Reprocesar la remesa por encima sin haber hecho antes **Deshacer remesa**
- Intentar arreglarla borrando líneas a mano

#### Dónde encontrarlo en Summa

**Movimientos > Detalle de remesa > Deshacer remesa**

---

## 6.a Remesas SEPA de cobro [id:6a-remeses-sepa-de-cobrament]

Sección conservada para navegación.

No forma parte de esta iteración. Aquí no se mezclan las remesas SEPA de cobro con las remesas operativas que se dividen o deshacen desde **Movimientos**.

---

## 6b. Documentos pendientes y remesas SEPA OUT [id:6b-documents-pendents]

Sección conservada para navegación.

No forma parte de esta iteración.

---

## 6c. Liquidaciones de gastos de viaje [id:6c-liquidacions-de-despeses-de-viatge]

Sección conservada para navegación.

No forma parte de esta iteración.

---

## 7. Devoluciones bancarias [id:7-gestio-de-devolucions]

### 7.4 Importar devoluciones del banco

#### Qué es

Es el flujo para cargar el fichero de detalle de devoluciones y asignar cada devolución al donante correcto.

#### Cuándo se utiliza

- Cuando el banco ha devuelto recibos y tienes el fichero de detalle
- Cuando hay demasiadas devoluciones para asignarlas una a una
- Cuando quieres dejar cerrada la parte fiscal antes de informes

#### Paso a paso

1. Ve a **Movimientos** y abre **"Importar devoluciones del banco"**.
2. Sube el fichero CSV o Excel que te ha dado el banco.
3. Revisa el matching antes de confirmar cada asignación.
4. Procesa solo cuando las devoluciones resueltas tengan el donante correcto.
5. Deja las no resueltas como pendientes conscientes para revisarlas después.

#### Errores habituales

- Confirmar el proceso sin revisar el matching
- Asignar la devolución al padre de la remesa en lugar del donante correcto

#### Dónde encontrarlo en Summa

**Movimientos > Importar devoluciones del banco**

---

## 8. Donaciones vía Stripe [id:8-donacions-via-stripe]

Sección conservada para navegación.

No forma parte de esta iteración.

---

## 9. Informes fiscales [id:9-informes-fiscals]

### 9.1 Generar el Modelo 182

#### Qué es

Es el flujo para generar el fichero del **Modelo 182** a partir de datos fiscales correctos y movimientos ya revisados.

#### Cuándo se utiliza

- Cuando estás preparando el cierre fiscal anual
- Cuando la gestoría te pide el fichero del 182
- Cuando quieres verificar que el total neto por donante es correcto

#### Paso a paso

1. Ve a **Informes > Modelo 182** y selecciona el año fiscal.
2. Revisa las alertas antes de exportar, sobre todo donantes sin datos fiscales y devoluciones pendientes.
3. Corrige lo que falte en **Donantes** o **Movimientos** y vuelve a **Informes**.
4. Genera el fichero solo cuando los totales sean coherentes.
5. Descárgalo y envíalo a la gestoría.

#### Errores habituales

- Generar el Modelo 182 con donantes sin **DNI/CIF** o **código postal**
- Exportar mientras aún revisas otro año o quedan devoluciones pendientes

#### Dónde encontrarlo en Summa

**Informes > Modelo 182**

---

## 10. Proyectos y justificación de subvenciones [id:10-projectes]

### Gestión de proyectos [id:6-gestio-de-projectes]

Sección conservada para navegación. No forma parte de esta iteración.

### Asignación de gastos [id:6-assignacio-de-despeses]

Sección conservada para navegación. No forma parte de esta iteración.

---

## 11. Resolución de problemas [id:11-resolucio-de-problemes]

Si una tarea de esta iteración no cuadra:
- vuelve a la pantalla base del flujo
- revisa primero alertas y pendientes
- usa el `?` de la pantalla para el resumen corto
- usa el bot para localizar la card exacta del microflujo
