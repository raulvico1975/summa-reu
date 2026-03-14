import type { HelpContent, HelpRouteKey } from '../help-types';

export const HELP_CONTENT_ES: Partial<Record<HelpRouteKey, HelpContent>> = {
  '/dashboard': {
    title: 'Ayuda · Dashboard',
    intro:
      'Esta pantalla es la foto rápida: te dice cómo está la organización hoy. Todo lo que ves aquí son datos derivados de otras pantallas.',
    steps: [
      'Revisa el balance general: te indica el saldo actual de la cuenta.',
      'Mira los pendientes: cuántos movimientos sin contacto, sin categoría o con devol. pendiente.',
      'Valora si hay que actuar o no: el dashboard señala, no obliga.',
      'Accede a la pantalla concreta si quieres resolver algo.',
    ],
    tips: [
      'El dashboard no se edita: es un reflejo de otras pantallas.',
      'No hace falta tener 0 pendientes para estar "bien": usa criterio.',
      'Los filtros rápidos te llevan al sitio correcto si quieres profundizar.',
    ],
    extra: {
      order: {
        title: 'Orden recomendado (2 minutos)',
        items: [
          'Mira el balance.',
          'Valora pendientes.',
          'Si algo pide atención, entra en la pantalla correspondiente.',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Intentar editar aquí (no se puede: es solo lectura).',
          'Obsesionarse con cero pendientes sin criterio.',
          'Ignorar avisos de desbalanceo importantes.',
        ],
      },
      whenNot: {
        title: 'Cuándo no hace falta preocuparse',
        items: [
          'Un puñado de pendientes no significa caos: prioriza lo que importa.',
          'Si acabas de sincronizar, es normal que haya cosas por clasificar.',
        ],
      },
      manual: {
        label: 'Manual de usuario · Entender el Dashboard',
        href: '/dashboard/manual#14-entendre-el-dashboard',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Leer el Dashboard en 2 minutos y decidir si hay que actuar',
      },
    },
    keywords: ['dashboard', 'balance', 'pendientes', 'resumen', 'contacto', 'categoría', 'devol.'],
  },

  '/dashboard/movimientos': {
    title: 'Ayuda · Movimientos',
    intro:
      'Esta pantalla es el centro de control del día a día: aquí revisas lo que entra y sale del banco, detectas pendientes y evitas que los errores crezcan.',
    steps: [
      'Empieza por los pendientes: filtra por "Sin contacto", "Sin categoría" y "Devoluciones pendientes" si aparecen.',
      'Asigna primero el contacto (donante, proveedor o trabajador): da contexto al movimiento.',
      'Asigna después la categoría cuando el contacto ya esté claro.',
      'Revisa ingresos agrupados (remesas): divídelas antes de continuar si hace falta.',
      'Adjunta documentos solo cuando aporten valor (facturas, justificantes relevantes).',
    ],
    tips: [
      'Orden recomendado: contacto → categoría → documento. Cambiar el orden suele generar dudas después.',
      'Si un movimiento te genera duda, déjalo pendiente y sigue con el resto.',
      'Una revisión regular de pendientes evita acumulaciones difíciles de revisar.',
    ],
    extra: {
      order: {
        title: 'Orden recomendado de trabajo',
        items: [
          'Filtrar pendientes (qué está sin resolver).',
          'Asignar contactos.',
          'Asignar categorías.',
          'Revisar remesas y devoluciones.',
          'Adjuntar documentos cuando aporten valor.',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Asignar categoría sin haber definido el contacto.',
          'Forzar una asignación solo por "dejarlo limpio".',
          'Dividir remesas demasiado tarde, con otros campos ya tocados.',
          'Generar informes sin haber revisado devoluciones.',
        ],
      },
      whenNot: {
        title: 'Cuándo no hace falta hacer nada',
        items: [
          'No hace falta asignar proyecto si solo controlas el día a día.',
          'No hace falta adjuntar documento a movimientos pequeños y evidentes.',
          'No hace falta resolver todas las dudas al momento: dejar pendientes con criterio también es control.',
        ],
      },
      returns: {
        title: 'Devoluciones (control rápido)',
        items: [
          'Prioridad: asignar el donante correcto. Si no hay donante, fiscalmente no resta donde toca.',
          'En remesas de devoluciones, el padre no lleva contacto: el donante va en las hijas.',
          'Si hay pendientes, resuélvelos antes de exportar 182/certificados (evitas totales inflados).',
          'Si dudas, deja pendiente consciente y sigue; pero no lo olvides antes de cierre.',
        ],
      },
      remittances: {
        title: 'Remesas (cuotas y Stripe)',
        items: [
          'Remesa = un movimiento que agrupa muchas cuotas. Divídela antes de asignar contacto/categoría a mano.',
          'Tras dividir, trabaja sobre las cuotas hijas (son las que cuentan por donante).',
          'Stripe: usa "Dividir remesa Stripe" y revisa pendientes de asignación (matching por email).',
          'Si una remesa ya está procesada, no la vuelvas a tocar: revisa el detalle desde el badge/modal.',
        ],
      },
      contacts: {
        title: 'Contactos (criterio rápido)',
        items: [
          'Asigna primero el contacto: da contexto y hace que la categoría sea más fiable.',
          'Si es una nómina → Trabajador. Si es una factura de un tercero → Proveedor. Si es un ingreso de cuota/donación → Donante.',
          'Si no tienes claro el contacto, déjalo pendiente y busca pistas en el concepto bancario o el documento.',
          'Evita crear contactos nuevos para casos puntuales pequeños: crea solo los recurrentes o relevantes.',
        ],
      },
      categories: {
        title: 'Categorías (criterio rápido)',
        items: [
          'Asigna la categoría después del contacto: el contacto suele sugerir la categoría correcta (categoría por defecto).',
          'Si dudas entre dos categorías, elige la más estable y coherente con el histórico (consistencia > precisión ficticia).',
          'No fuerces categorías "para dejarlo limpio": un pendiente consciente es mejor que una categoría equivocada.',
          'Para volúmenes grandes, filtra pendientes y aplica un criterio repetible antes de entrar al detalle.',
        ],
      },
      documents: {
        title: 'Documentos (criterio rápido)',
        items: [
          'No hace falta adjuntar documento a cada movimiento: resérvalo para facturas, justificantes importantes o requisitos de subvención.',
          'Si adjuntas desde el modal del movimiento, el documento queda vinculado automáticamente.',
          'Un nombre de archivo claro (fecha + concepto) ayuda después a encontrarlo sin buscar.',
          'Para justificación de proyectos, el documento puede ser obligatorio: revísalo antes de cerrar.',
        ],
      },
      bankAccounts: {
        title: 'Multi-cuenta bancaria (criterio rápido)',
        items: [
          'Cada cuenta sincroniza por separado: si tienes más de una, filtra por cuenta cuando revises pendientes.',
          'Los saldos del Dashboard suman todas las cuentas: no interpretes como problema un saldo global diferente del que ves en el banco.',
          'Las transferencias internas aparecen como salida de una cuenta y entrada en la otra: asigna la misma categoría (p. ej. Transferencias internas) y no las cuentes dos veces como gasto/ingreso real.',
          'Cuando sincronices una nueva cuenta, revisa los datos iniciales (saldo apertura, fecha inicio) antes de continuar.',
        ],
      },
      ai: {
        title: 'Categorización con IA (cuándo usarla)',
        items: [
          'Uso ideal: muchos movimientos sin categoría y patrones repetitivos.',
          'Regla de oro: la IA sugiere, tú validas. No asumas que siempre acierta.',
          'Si el contacto está claro, asigna primero el contacto: la categoría suele salir más limpia.',
          'Después de usar IA, revisa una muestra (5–10) antes de darlo por bueno.',
        ],
      },
      bulk: {
        title: 'Acciones masivas (para limpiar rápido)',
        items: [
          'Filtra primero (pendientes) y luego selecciona en bloque: así no tocas lo que ya está bien.',
          'Aplica cambios repetibles (misma categoría) a grupos coherentes, no a "todo el mes".',
          'Si tienes dudas, hazlo en lotes pequeños: es más fácil deshacer y revisar.',
          'Después de una acción masiva, revisa 3–5 filas al azar para validar.',
        ],
      },
      importing: {
        title: 'Importar extracto (sin sorpresas)',
        items: [
          'Descarga el extracto del banco en CSV/XLSX y súbelo tal cual.',
          'Evita abrir y guardar el CSV con Excel si cambia formatos: puede romper separadores y decimales.',
          'Antes de importar, revisa la previsualización: fechas, importes y descripciones.',
          'Si detectas duplicados o importes extraños, para y revisa el fichero antes de seguir.',
        ],
      },
      filters: {
        title: 'Filtros (para trabajar rápido)',
        items: [
          'Regla: filtra antes de editar. Primero encuentra el grupo de pendientes y luego actúa.',
          'Filtros clave: Sin contacto, Sin categoría, Devoluciones pendientes.',
          'Para revisar una tarea concreta, combina filtro + búsqueda (nombre, importe, palabra clave).',
          'Con mucho volumen, trabaja en lotes pequeños (por semana o por tipo) y valida al final.',
        ],
      },
      manual: {
        label: 'Manual de usuario · Gestión de Movimientos',
        href: '/dashboard/manual#5-gestio-de-moviments',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Cómo mantener Movimientos bajo control en 10 minutos',
      },
    },
    keywords: [
      'control',
      'pendientes',
      'contacto',
      'categoría',
      'remesa',
      'devoluciones',
      'documento',
      'día a día',
      'ia',
      'masivo',
      'importar',
      'filtros',
    ],
  },
  '/dashboard/movimientos/liquidacions': {
    title: 'Ayuda · Liquidaciones',
    intro:
      'Esta pantalla sirve para preparar liquidaciones de gastos de viaje: tickets, kilometraje y PDF final. No es la pantalla de remesas.',
    steps: [
      'Crea o abre una liquidación y revisa el periodo antes de continuar.',
      'Sube tickets o justificantes y déjalos vinculados a la liquidación correcta.',
      'Añade kilometraje solo cuando toque y valida importes antes de generar nada.',
      'Revisa los pendientes antes de generar el PDF final.',
      'Genera el PDF solo cuando la liquidación ya esté completa y coherente.',
    ],
    tips: [
      'Trabaja una liquidación cada vez: mezclar casos complica la revisión.',
      'Un ticket sin revisar no es cierre: es trabajo pendiente.',
      'Si la duda es de imputación a proyecto, sigue luego en Asignación de gastos.',
    ],
    extra: {
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Confundir liquidaciones de viaje con remesas o cobro de cuotas.',
          'Generar el PDF sin revisar todos los tickets.',
          'Mezclar kilometraje y otros gastos sin validar importes.',
        ],
      },
      manual: {
        label: 'Manual de usuario · Liquidaciones de gastos de viaje',
        href: '/dashboard/manual#6c-liquidacions-de-despeses-de-viatge',
      },
    },
    keywords: ['liquidaciones', 'viaje', 'tickets', 'kilometraje', 'pdf', 'gastos'],
  },

  '/dashboard/donants': {
    title: 'Ayuda · Donantes',
    intro:
      'Esta pantalla es la base fiscal de la entidad: si DNI/CIF y Código Postal son correctos, el Modelo 182 y los certificados salen limpios.',
    steps: [
      'Prioriza DNI/CIF y Código Postal: es lo que más suele bloquear o ensuciar el 182.',
      'Evita duplicados: si importas, actualiza existentes en lugar de crear nuevos.',
      'Mantén Activo/Baja al día para una lista limpia sin perder histórico.',
      'Asigna categoría por defecto si ayuda a categorizar movimientos de forma consistente.',
      'Antes de certificados o 182, valida 2–3 donantes representativos (con y sin devoluciones).',
    ],
    tips: [
      'Orden operativo: DNI/CP → estado → (si aplica) categoría por defecto.',
      'Si una devolución está mal asignada, distorsiona el total neto del certificado.',
      'No todo donante necesita una ficha perfecta: fiscal mínimo y listo.',
    ],
    extra: {
      order: {
        title: 'Orden recomendado',
        items: [
          'Completar DNI/CIF y Código Postal.',
          'Revisar estado Activo/Baja.',
          'Evitar duplicados (actualizar).',
          'Validar devoluciones si las hay.',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Dejar DNI o Código Postal vacío esperando que el 182 salga bien.',
          'Crear duplicados por falta de criterio en importaciones.',
          'Ignorar devoluciones e inflar totales netos.',
        ],
      },
      whenNot: {
        title: 'Cuándo no hace falta complicarlo',
        items: [
          'No hace falta rellenar todos los datos si no aportan valor (prioriza fiscal).',
          'No hace falta generar certificados masivos si aún hay datos fiscales pendientes.',
        ],
      },
      returns: {
        title: 'Devoluciones (impacto fiscal)',
        items: [
          'Una devolución asignada al donante resta del total neto (certificado y Modelo 182).',
          'Si la devolución no tiene donante asignado, no resta a nadie: el total queda inflado.',
          'Si una devolución está asignada al donante equivocado, distorsiona a dos donantes a la vez.',
          'Antes de cerrar el año, revisa devoluciones pendientes y las de donantes con importes extraños.',
        ],
      },
      quality: {
        title: 'Calidad fiscal (check rápido)',
        items: [
          'DNI/CIF y Código Postal completos: mínimo para 182.',
          'Evitar duplicados: un donante por DNI (actualiza, no dupliques).',
          'Coherencia de estado: baja cuando toca, activo si sigue aportando.',
          'Muestra de validación: 2–3 donantes representativos antes de exportaciones masivas.',
        ],
      },
      manual: {
        label: 'Manual de usuario · Gestión de Donantes',
        href: '/dashboard/manual#3-gestio-de-donants',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Dejar Donantes listos para el Modelo 182 (10 minutos)',
      },
    },
    keywords: ['donantes', 'socios', 'dni', 'cif', 'código postal', 'modelo 182', 'certificados', 'baja', 'devoluciones', 'calidad'],
  },
  '/dashboard/donants/remeses-cobrament': {
    title: 'Ayuda · Remesas de cobro',
    intro:
      'Esta pantalla sirve para generar la remesa SEPA de cobro de cuotas. Aquí preparas el XML pain.008; no es la pantalla para dividir remesas bancarias ya importadas.',
    steps: [
      'Comprueba primero que la cuenta bancaria tiene informado el ICS en Configuración.',
      'Selecciona cuenta y fecha de cobro antes de revisar los socios incluidos.',
      'Revisa los socios excluidos o con avisos antes de generar la remesa.',
      'Genera el XML solo cuando el importe total y el número de socios sean coherentes.',
      'Sube el fichero al banco fuera de Summa: la app lo genera pero no lo envía automáticamente.',
    ],
    tips: [
      'Si faltan socios, revisa IBAN, cuota y periodicidad antes de forzar nada.',
      'Un XML bien generado no sustituye la revisión previa del listado.',
      'Si el problema es una remesa ya procesada del banco, no es esta pantalla.',
    ],
    extra: {
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Confundir esta pantalla con el divisor de remesas de Movimientos.',
          'Generar la remesa sin ICS configurado en la cuenta bancaria.',
          'Ignorar los socios excluidos y descubrirlo solo en el banco.',
        ],
      },
      manual: {
        label: 'Manual de usuario · Remesas SEPA de cobro',
        href: '/dashboard/manual#6a-remeses-sepa-de-cobrament',
      },
    },
    keywords: ['remesas', 'sepa', 'cobro', 'pain.008', 'cuotas', 'ics'],
  },

  '/dashboard/proveidors': {
    title: 'Ayuda · Proveedores',
    intro:
      'Esta pantalla ordena los terceros que te facturan. Si el CIF y la identificación están bien, el Modelo 347 sale sin limpiezas de última hora.',
    steps: [
      'Crea proveedores para gastos recurrentes o relevantes (no para todo).',
      'Completa nombre + CIF: es el campo crítico para el Modelo 347.',
      'Define categoría por defecto si casi siempre es el mismo tipo de gasto.',
      'Usa activo/inactivo para limpiar la lista sin perder histórico.',
    ],
    tips: [
      'CIF correcto > cualquier otro dato.',
      'Si cambia el nombre comercial pero no el CIF, actualiza el mismo proveedor.',
      'La categoría por defecto acelera Movimientos, pero revísala si hay excepciones.',
    ],
    extra: {
      order: {
        title: 'Orden recomendado',
        items: [
          'Crear solo los recurrentes.',
          'Validar CIF.',
          'Definir categoría por defecto.',
          'Marcar inactivos los que ya no se usan.',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Crear duplicados del mismo proveedor con el mismo CIF.',
          'Dejar el CIF vacío esperando que el 347 salga bien.',
          'Mezclar proveedores con trabajadores (cada tipo cumple una función).',
        ],
      },
      whenNot: {
        title: 'Cuándo no hace falta',
        items: [
          'No hace falta crear proveedor para gastos puntuales pequeños.',
          'No hace falta rellenar datos extra si no los vas a usar.',
        ],
      },
      manual: {
        label: 'Manual de usuario · Proveedores y Trabajadores',
        href: '/dashboard/manual#4-gestio-de-proveidors-i-treballadors',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Preparar Proveedores para el Modelo 347 (8 minutos)',
      },
    },
    keywords: ['proveedor', 'cif', 'modelo 347', 'terceros', 'categoría por defecto', 'inactivo', 'duplicados'],
  },

  '/dashboard/treballadors': {
    title: 'Ayuda · Trabajadores',
    intro:
      'Esta pantalla sirve para ordenar gastos de personal (nóminas y pagos recurrentes). Bien mantenida, el día a día queda más limpio y coherente.',
    steps: [
      'Crea un trabajador cuando tengas pagos recurrentes de personal (nóminas, dietas fijas, etc.).',
      'Introduce nombre y DNI: aporta trazabilidad y evita confusiones con nombres parecidos.',
      'Define categoría por defecto (normalmente Nóminas) para agilizar la asignación en Movimientos.',
      'Mantén el estado Activo/Inactivo cuando una persona entra o sale (no hace falta borrar).',
      'Al asignar un movimiento, revisa que contacto + categoría reflejen lo que es (nómina vs otros pagos).',
    ],
    tips: [
      'Objetivo: coherencia. No es una herramienta de RRHH, es clasificación operativa.',
      'Inactivo > eliminar: mantienes histórico y evitas perder contexto.',
      'Si hay pagos mixtos, no fuerces la categoría por defecto: ajusta puntualmente.',
    ],
    extra: {
      order: {
        title: 'Orden recomendado',
        items: [
          'Crear solo recurrentes.',
          'Poner DNI.',
          'Categoría por defecto.',
          'Estado activo/inactivo.',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Mezclar trabajadores con proveedores (cada tipo cumple una función).',
          'Borrar trabajadores y perder histórico.',
          'Aplicar siempre la categoría por defecto aunque no corresponda.',
        ],
      },
      whenNot: {
        title: 'Cuándo no hace falta complicarlo',
        items: [
          'No hace falta crear trabajadores para pagos puntuales irrelevantes.',
          'No hace falta rellenar campos extra si no los vas a usar.',
        ],
      },
      manual: {
        label: 'Manual de usuario · Proveedores y Trabajadores',
        href: '/dashboard/manual#4-gestio-de-proveidors-i-treballadors',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Ordenar nóminas y gastos de personal (8 minutos)',
      },
    },
    keywords: ['trabajadores', 'nóminas', 'personal', 'dni', 'categoría por defecto', 'activo', 'inactivo'],
  },

  '/dashboard/informes': {
    title: 'Ayuda · Informes',
    intro:
      'Esta pantalla sirve para generar los outputs para la gestoría: Modelo 182, Modelo 347 y certificados. Aquí no se corrigen datos; aquí se verifican y se exportan.',
    steps: [
      'Elige el año fiscal y trabaja siempre con un solo año cada vez.',
      'Modelo 182: resuelve primero las alertas de donantes (sobre todo DNI/CIF y Código Postal).',
      'Revisa devoluciones asignadas: afectan directamente al total del 182 y de los certificados.',
      'Genera el Modelo 182 y envíalo a la gestoría.',
      'Modelo 347: solo aparecerán proveedores que superen el umbral anual; comprueba el CIF antes de exportar.',
      'Genera certificados individuales o en lote cuando corresponda.',
    ],
    tips: [
      'Si el 182 no cuadra, casi siempre es por devoluciones o por datos incompletos de donantes.',
      'Valida 2–3 casos representativos antes de enviar certificados masivos.',
      'Trabaja siempre con un solo año abierto para evitar confusiones.',
    ],
    extra: {
      order: {
        title: 'Orden recomendado cuando toca hacer informes',
        items: [
          'Seleccionar el año fiscal.',
          'Resolver alertas de donantes (DNI/CP).',
          'Revisar devoluciones.',
          'Generar Modelo 182.',
          'Generar Modelo 347.',
          'Generar certificados.',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Generar el 182 con donantes sin DNI o Código Postal.',
          'Olvidar devoluciones pendientes e inflar los totales.',
          'Mezclar años (corregir datos de un año mientras exportas otro).',
          'Generar certificados masivos sin validar ningún caso antes.',
        ],
      },
      checks: {
        title: 'Checks finales antes de enviar a gestoría',
        items: [
          '182: ninguna alerta crítica pendiente.',
          '182: totales coherentes con lo esperado.',
          '347: proveedores con CIF correcto.',
          'Certificados: firma y cargo configurados.',
        ],
      },
      manual: {
        label: 'Manual de usuario · Informes fiscales',
        href: '/dashboard/manual#9-informes-fiscals',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Preparar Modelo 182 y certificados sin sorpresas (15 minutos)',
      },
    },
    keywords: [
      'modelo 182',
      'modelo 347',
      'certificados',
      'gestoría',
      'año fiscal',
      'devoluciones',
      'alertas',
      'exportar',
    ],
  },

  '/dashboard/configuracion': {
    title: 'Ayuda · Configuración',
    intro:
      'Aquí dejas la organización "a punto": datos fiscales, logo y firma. Si esto está bien, certificados e informes salen consistentes.',
    steps: [
      'Completa los datos fiscales (nombre, CIF, dirección): es lo que aparece en los outputs.',
      'Sube el logo y configura firma + cargo: es lo que da validez a los certificados.',
      'Revisa categorías con criterio: añade lo que falta y evita cambios agresivos.',
      'Gestiona miembros y roles: edición solo para quien realmente la necesita.',
    ],
    tips: [
      'Prioridad real: fiscal + firma. El resto es secundario.',
      'Mejor añadir categorías que renombrarlas si ya hay histórico.',
      'Roles de lectura evitan errores accidentales.',
    ],
    extra: {
      order: {
        title: 'Orden recomendado (10 minutos)',
        items: [
          'Datos fiscales.',
          'Logo.',
          'Firma y cargo.',
          'Categorías y roles.',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Dejar firma/cargo a medias y generar certificados.',
          'Renombrar categorías ya en uso y perder coherencia.',
          'Dar permisos de edición a quien solo debe consultar.',
        ],
      },
      whenNot: {
        title: 'Cuándo no hace falta tocar nada',
        items: [
          'Si solo quieres trabajar Movimientos, no hace falta "pulir" Configuración cada día.',
          'No hace falta tener todo perfecto para empezar (excepto fiscal/firma).',
        ],
      },
      manual: {
        label: 'Manual de usuario · Configuración inicial',
        href: '/dashboard/manual#2-configuracio-inicial',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Configurar Summa Social bien desde el primer día (8 minutos)',
      },
    },
    keywords: ['configuración', 'cif', 'dirección', 'logo', 'firma', 'cargo', 'categorías', 'miembros', 'roles'],
  },

  '/dashboard/ejes-de-actuacion': {
    title: 'Ayuda · Ejes de actuación',
    intro:
      'Esta pantalla sirve para clasificar internamente ingresos y gastos por áreas de trabajo. No es el módulo Proyectos: es una etiqueta de gestión interna.',
    steps: [
      'Crea un eje cuando necesites analizar gastos por líneas de trabajo (p. ej. sensibilización, incidencia, cooperación).',
      'Pon nombres estables y claros: deberían durar años, no solo un trimestre.',
      'Asigna movimientos a ejes cuando te ayude a explicar presupuesto interno o reporting a junta.',
      'Evita inflar ejes: pocos y útiles es mejor que muchos y confusos.',
      'Si hay dudas, deja el movimiento sin eje y decide cuando tengas criterio.',
    ],
    tips: [
      'Un eje es clasificación interna; un proyecto del módulo Proyectos es otra cosa.',
      'No fuerces ejes para cuadrar: deben reflejar una lógica real de trabajo.',
      'Si cambias el nombre de un eje, piensa en el histórico (consistencia > estética).',
    ],
    extra: {
      order: {
        title: 'Orden recomendado',
        items: [
          'Definir 4–8 ejes estables.',
          'Asignar eje solo cuando aporta valor.',
          'Revisar anualmente y ajustar lo mínimo.',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Confundir ejes de actuación con proyectos del módulo Proyectos.',
          'Crear un eje por cada actividad y perder perspectiva.',
          'Reclasificar demasiado y romper el histórico.',
        ],
      },
      whenNot: {
        title: 'Cuándo no hace falta',
        items: [
          'Si no usas análisis por ejes, no hace falta asignarlos por rutina.',
          'No hace falta aplicar eje a todo: solo a lo que quieres analizar.',
        ],
      },
      manual: {
        label: 'Manual de usuario · Proyectos / Ejes de actuación',
        href: '/dashboard/manual#8-projectes-eixos-dactuacio',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Definir ejes de actuación útiles (6 minutos)',
      },
    },
    keywords: ['ejes', 'clasificación', 'área', 'seguimiento', 'reporting', 'junta', 'interno'],
  },

  '/dashboard/project-module/expenses': {
    title: 'Ayuda · Asignación de gastos (Proyectos)',
    intro:
      'Esta bandeja es el inbox de gastos asignables: aquí decides a qué proyecto y a qué partida va cada gasto, de forma rápida y reversible.',
    steps: [
      'Entiende lo que ves: cada fila es un gasto (bancario o de terreno) con estado 0% / parcial / 100%.',
      'Empieza por los pendientes: filtra por "No asignadas" (0%) para priorizar lo que aún no está imputado.',
      'Quick Assign 100%: usa la acción rápida para asignar todo el gasto a un proyecto y (si aplica) a una partida concreta.',
      'Split (asignación múltiple): si un gasto se reparte entre proyectos o partidas, usa la asignación múltiple y reparte importes hasta que cuadren.',
      'Revisa el estado: el porcentaje debe reflejar la realidad (100% cuando está totalmente imputado; parcial cuando solo una parte).',
      'Desasignar: si te equivocas, deshaz la asignación y vuelve a 0% (o ajusta la distribución).',
      'Asignación masiva: selecciona varios gastos y aplica una asignación en bloque para los casos repetitivos (mismo proyecto/partida).',
      'Cierre de revisión: antes de dar un proyecto por bueno, verifica que los gastos relevantes están al 100% y que los splits no dejan importes "colgados".',
    ],
    tips: [
      'Cuando un proyecto está sobreejecutado en una partida, el split parcial es la forma realista de cuadrar sin inventar gastos.',
      'Si un gasto no encaja en ningún proyecto, es mejor dejarlo a 0% que forzar una asignación incorrecta.',
      'No verás automáticamente todos los gastos bancarios: solo entran los que en Movimientos ya tienen categoría asignada.',
      'Los gastos de terreno suelen subirse primero y asignarse después: prioriza la coherencia de la imputación, no la velocidad de entrada.',
    ],
    extra: {
      manual: {
        label: 'Manual de usuario · Asignación de gastos',
        href: '/dashboard/manual#6-assignacio-de-despeses',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Asignar gastos a proyectos de forma ágil (10 minutos)',
      },
    },
    keywords: [
      'asignación',
      'proyecto',
      'partida',
      'quick assign',
      'split',
      '100%',
      'parcial',
      'desasignar',
      'masivo',
      'terreno',
    ],
  },

  '/dashboard/project-module/projects': {
    title: 'Ayuda · Gestión de proyectos',
    intro:
      'Aquí creas y gestionas los proyectos del módulo de Proyectos, que luego usarás para asignarles gastos.',
    steps: [
      'Crea un proyecto cuando necesites agrupar gastos bajo un mismo paraguas (p. ej., una subvención, un programa o un periodo de trabajo concreto).',
      'Pon un nombre claro y reconocible: es el que verás en la bandeja de asignación de gastos.',
      'Añade un código o referencia si trabajas con justificaciones externas (opcional pero recomendable).',
      'Revisa el estado del proyecto: activo mientras se asignan gastos; cerrado cuando ya no debe usarse.',
      'Si el proyecto tiene presupuesto, introdúcelo o gestiona las partidas desde su pantalla económica.',
      'El proyecto cobra sentido cuando le asignas gastos desde "Asignación de gastos".',
      'Evita crear proyectos duplicados por pequeñas variaciones: mejor pocos proyectos bien definidos.',
      'Cuando el proyecto termina, ciérralo para mantener el orden y evitar asignaciones accidentales.',
    ],
    tips: [
      'Si dudas si un gasto debe ir a un proyecto, déjalo sin asignar hasta tener criterio.',
      'Un proyecto bien definido hace que la pantalla de asignación sea más rápida y con menos errores.',
      'Cerrar proyectos antiguos reduce ruido y evita selecciones equivocadas.',
    ],
    extra: {
      manual: {
        label: 'Manual de usuario · Gestión de proyectos',
        href: '/dashboard/manual#6-gestio-de-projectes',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Crear y gestionar proyectos de forma eficiente (8 minutos)',
      },
    },
    keywords: ['proyecto', 'crear', 'editar', 'cerrar', 'código', 'presupuesto', 'partidas', 'asignación'],
  },

  '/dashboard/manual': {
    title: 'Ayuda · Manual de usuario',
    intro:
      'Esta página es la referencia completa del producto: aquí encuentras la explicación detallada de cada pantalla, flujo y criterio de uso.',
    steps: [
      'Navega desde el TOC (tabla de contenidos): es la forma más rápida de ir a un apartado concreto.',
      'Usa Cmd/Ctrl+F para buscar palabras clave si no encuentras lo que buscas.',
      'Cuando otra pantalla te enlaza aquí, llegas directamente al ancla (p. ej., #5-gestio-de-moviments).',
      'Los anclas se pueden compartir: copia la URL si quieres pasar un enlace directo a otra persona.',
    ],
    tips: [
      'El manual no sustituye la ayuda de pantalla: aquí hay más detalle, pero allí hay contexto inmediato.',
      'Si llegas desde un enlace de ayuda, vuelve atrás con el navegador; no hace falta cerrar.',
      'Los vídeos (cuando estén disponibles) cubren los mismos apartados que el manual.',
    ],
    extra: {
      order: {
        title: 'Cómo usar el manual (rápido)',
        items: [
          'Usar TOC para saltar.',
          'Ctrl+F para buscar.',
          'Guardar ancla si es útil.',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Leer de arriba abajo sin ir al grano.',
          'Ignorar que las anclas permiten enlaces directos.',
          'Confundir manual con changelog (el changelog está en Novedades).',
        ],
      },
      whenNot: {
        title: 'Cuándo no hace falta',
        items: [
          'Si tienes una duda puntual, la ayuda de pantalla suele ser suficiente.',
          'Si el producto ya te es familiar, no hace falta releer el manual cada vez.',
        ],
      },
      manual: {
        label: 'Ir al inicio del manual',
        href: '/dashboard/manual#top',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Cómo encontrar respuestas rápidas en el manual (3 minutos)',
      },
    },
    keywords: ['manual', 'toc', 'anclas', 'referencia', 'documentación', 'búsqueda'],
  },

  '/redirect-to-org': {
    title: 'Ayuda · Acceso a la organización',
    intro:
      'Esta pantalla te redirige a tu organización. Si tienes acceso a más de una, el sistema te envía a la correcta según tus permisos.',
    steps: [
      'Espera unos segundos: la redirección es automática.',
      'Si no redirige, comprueba que tienes sesión iniciada.',
      'Si sigues aquí, puede que no tengas acceso a ninguna organización activa.',
    ],
    tips: [
      'Si usas un ordenador compartido, cierra sesión al terminar.',
      'Si te han cambiado rol u organización recientemente, puede que debas entrar de nuevo.',
    ],
    extra: {
      order: {
        title: 'Qué hacer',
        items: [
          'Esperar redirección',
          'Reiniciar sesión si hace falta',
          'Contactar con el admin si no tienes acceso',
        ],
      },
      pitfalls: {
        title: 'Errores habituales',
        items: [
          'Pensar que es un error de la app cuando es falta de permisos',
          'Sesión caducada (browser session)',
        ],
      },
      whenNot: {
        title: 'Cuándo no preocuparse',
        items: ['Si en 5–10 segundos te lleva al Dashboard, todo está bien.'],
      },
      manual: {
        label: 'Manual de usuario · Primeros pasos',
        href: '/dashboard/manual#1-primers-passos',
      },
      video: {
        label: 'Vídeo (próximamente)',
        note: 'Entrar en Summa Social y entender la redirección (2 minutos)',
      },
    },
    keywords: ['acceso', 'organización', 'redirección', 'permisos', 'sesión'],
  },
};
