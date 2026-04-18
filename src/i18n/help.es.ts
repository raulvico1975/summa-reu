import type { HelpContent } from "@/src/i18n/help.ca";

export const helpEs: HelpContent = {
  navLabel: "Ayuda",
  title: "Centro de ayuda",
  manualIntro:
    "Te damos la bienvenida a Summa Reu. Esta guía te acompañará paso a paso para que puedas sacar el máximo provecho de la plataforma sin complicaciones.",
  faqIntro:
    "Aquí encontrarás respuestas a las preguntas más habituales sobre Summa Reu.",
  faqContact:
    "¿No has encontrado tu pregunta? Escríbenos a hola@summareu.app y te ayudaremos.",
  manualSections: [
    {
      title: "¿Qué es Summa Reu?",
      content:
        "Summa Reu es una herramienta pensada para entidades, asociaciones y equipos que necesitan coordinar reuniones de forma ágil. En un solo lugar puedes:\n\n• Proponer fechas y recoger la disponibilidad de todos.\n• Convocar la reunión con la fecha que mejor encaje.\n• Grabar la reunión y obtener un acta generada automáticamente con inteligencia artificial.\n• Editar, guardar y exportar el acta como documento de texto o añadirla al calendario.\n\nTodo esto sin que los participantes tengan que crear ninguna cuenta. Solo tú, como responsable de la entidad, necesitas acceder con contraseña.",
    },
    {
      title: "Dar de alta tu entidad",
      content:
        "Necesitarás el nombre de tu entidad, un correo electrónico, una contraseña segura (mínimo 8 caracteres) y una tarjeta de pago.\n\n1. Ve a summareu.app y haz clic en \"Dar de alta entidad\".\n2. Rellena el formulario: nombre de la entidad, persona responsable, idioma de las actas (catalán o castellano), correo y contraseña.\n3. Haz clic en \"Crear entidad\".\n4. Completa el pago en la página de pago segura.\n5. Una vez completado, se abrirá directamente el panel.\n\nTus datos de pago se gestionan por una plataforma segura y certificada. Summa Reu no almacena datos de tarjeta en ningún momento.",
    },
    {
      title: "Iniciar sesión",
      content:
        "1. Ve a summareu.app y haz clic en \"Acceso entidad\".\n2. Escribe tu correo y tu contraseña.\n3. Haz clic en \"Entrar\".\n\nSi pasas mucho tiempo sin actividad, verás un aviso que te permitirá continuar o volver a entrar. Esto protege tu cuenta.",
    },
    {
      title: "El panel: tu centro de control",
      content:
        "El panel es la primera pantalla que ves al entrar. Desde aquí lo controlas todo:\n\n• Votaciones activas: verás una lista de todas las votaciones creadas, con su estado (Abierta, Cerrada...), la fecha de creación y el número de votos recibidos.\n• Reuniones pasadas: en la parte inferior encontrarás las reuniones ya celebradas.\n\nJunto a cada votación tienes los botones \"Resultados\" (para ver qué fechas han recibido más disponibilidad) y \"Gestionar\" (para compartir el enlace, cerrar la votación y crear la reunión).",
    },
    {
      title: "Crear una votación",
      content:
        "1. Desde el panel, haz clic en \"Crear votación\".\n2. Escribe un título claro (por ejemplo, \"Asamblea de primavera\") y opcionalmente una descripción.\n3. Selecciona las franjas horarias:\n   • Elige cuántos días quieres proponer: 5, 7 o 10 días a partir de hoy.\n   • Define la ventana horaria con las ventanas rápidas (Jornada laboral, Mañana, Tarde, Noche) o manualmente.\n   • Haz clic en las franjas que quieras proponer en la cuadrícula visual.\n   • Puedes usar \"Seleccionar visibles\" o \"Limpiar selección\".\n4. Haz clic en \"Crear votación\".\n\nPuedes proponer hasta 20 franjas por votación. Si necesitas más, crea una segunda votación.",
    },
    {
      title: "Compartir la votación con el equipo",
      content:
        "Ningún participante necesita crear cuenta: solo les hace falta el enlace.\n\n1. En la página de gestión de la votación, haz clic en \"Copiar enlace de votación\".\n2. Envíalo como quieras: WhatsApp, correo, Telegram, Signal... cualquier canal sirve.\n\nCuando abran el enlace, los participantes verán el título y la descripción, podrán introducir su nombre y marcar las fechas que les van bien. No hace falta registro, ni contraseña, ni correo.",
    },
    {
      title: "Para los participantes: votar sin registro",
      content:
        "Esta sección la puedes compartir directamente con los participantes si tienen dudas.\n\n1. Abre el enlace que te han compartido.\n2. Escribe tu nombre.\n3. Marca las fechas y horas en las que estás disponible.\n4. Haz clic en \"Guardar disponibilidad\".\n\nMientras la votación esté abierta, puedes volver y modificar tus respuestas. Después de votar, puedes hacer clic en \"Ver resultados\" para consultar qué fechas tienen más disponibilidad y una tabla con el voto de cada participante.",
    },
    {
      title: "Consultar los resultados",
      content:
        "Tanto el responsable de la entidad como los participantes pueden ver los resultados en cualquier momento.\n\nLos resultados muestran:\n• Las fechas ordenadas de más a menos disponibilidad.\n• La mejor opción destacada (o las mejores, si hay empate).\n• Una tabla donde puedes ver exactamente quién ha votado qué.\n\nComo participante, haz clic en \"Ver resultados\" desde la página de votación. Como responsable, haz clic en \"Resultados\" en el panel.",
    },
    {
      title: "Cerrar la votación y convocar la reunión",
      content:
        "Cuando ya tengas suficientes respuestas:\n\n1. Ve a la página de gestión de la votación (desde el panel, haz clic en \"Gestionar\").\n2. En la sección \"Cerrar votación\", elige la opción ganadora.\n3. Haz clic en el botón para cerrar.\n\nCuando cierras la votación, se crea automáticamente una reunión con la fecha y hora seleccionadas y se prepara una sala de videoconferencia. Si algo falla al crear la sala, verás un botón para reintentar sin tener que repetir todo el proceso.",
    },
    {
      title: "La reunión: entrar, grabar y gestionar",
      content:
        "La reunión sigue tres pasos sencillos:\n\nPaso 1 — Abrir la reunión:\n1. Haz clic en \"Entrar en la reunión\".\n2. Se abrirá la videoconferencia (en una pestaña nueva o dentro de la misma página).\n\nSi la videoconferencia no se carga dentro de la página, haz clic en \"Abrir en una pestaña nueva\".\n\nPaso 2 — Compartir el enlace de la sala:\n1. Desde el panel de control, copia el enlace de la sala.\n2. Envíalo a los participantes por el canal que prefieras.\n\nPaso 3 — Grabar la reunión:\n1. Cuando todos estén conectados, vuelve a la página de control.\n2. Haz clic en \"Iniciar grabación\".\n3. Cuando la reunión termine, haz clic en \"Detener grabación\".\n\nEs necesario que haya al menos una persona dentro de la reunión para poder iniciar la grabación.\n\nDespués de detener la grabación, Summa Reu la procesa automáticamente. La página se actualiza sola mientras espera. Cuando esté listo, verás la transcripción y el acta en la misma página.",
    },
    {
      title: "Transcripción y acta automática",
      content:
        "La grabación se convierte en texto automáticamente (transcripción). A partir de ahí, la inteligencia artificial genera un borrador de acta con:\n\n• Resumen de la reunión.\n• Asistentes identificados.\n• Puntos del orden del día.\n• Decisiones tomadas (con responsable y fecha límite).\n• Tareas asignadas (con responsable, fecha límite y estado).\n\nEl acta se genera en el idioma configurado (catalán o castellano).\n\nSi no has podido grabar la reunión dentro de Summa Reu, puedes subir un archivo de audio o vídeo, o pegar tus notas, y Summa Reu generará el acta igualmente.",
    },
    {
      title: "Editar y exportar el acta",
      content:
        "El acta generada es un borrador. Siempre puedes — y conviene que la — revisar y ajustar.\n\nPara editar: modifica el texto directamente en la sección de acta y haz clic en \"Guardar cambios del acta\".\n\nPara exportar tienes dos opciones:\n• \"Descargar acta (.md)\": un archivo de texto con el acta completa, que se puede abrir con cualquier editor.\n• \"Descargar ICS\": añade la reunión a tu calendario (Google Calendar, Outlook, Apple Calendar...).",
    },
    {
      title: "Eliminar una reunión",
      content:
        "Si necesitas eliminar una reunión pasada:\n\n1. Ve a la página de la reunión.\n2. En la parte inferior, haz clic en \"Eliminar reunión\".\n3. Confirma la acción.\n\nSe eliminarán la reunión, las grabaciones, la transcripción, el acta y todos los archivos asociados. Esta acción no se puede deshacer. Asegúrate de exportar el acta antes si quieres conservarla.\n\nSolo se pueden eliminar reuniones ya pasadas, no reuniones futuras o activas.",
    },
    {
      title: "Configuración de la cuenta",
      content:
        "Desde el menú, accede a \"Configuración\" para:\n\n• Cambiar el nombre de la entidad.\n• Cambiar el idioma de las actas (catalán o castellano). Esto afecta a las futuras actas; las ya generadas no cambian.\n• Cambiar la contraseña.\n• Eliminar la cuenta definitivamente (se eliminarán todos los datos: votaciones, reuniones, grabaciones y actas). Será necesario escribir el nombre de la entidad para confirmar. Esta acción es irreversible.",
    },
  ],
  faqCategories: [
    {
      title: "Primeros pasos y cuenta",
      items: [
        {
          q: "¿Qué necesito para empezar a usar Summa Reu?",
          a: "Solo tres cosas: un correo electrónico, una contraseña y una tarjeta de pago para activar la suscripción. En menos de cinco minutos tendrás tu espacio creado.",
        },
        {
          q: "¿Puedo probar Summa Reu antes de pagar?",
          a: "Ahora mismo es necesario activar la suscripción para empezar. Una vez dentro, puedes crear votaciones y reuniones de inmediato.",
        },
        {
          q: "¿Pueden dos personas gestionar la misma entidad?",
          a: "Cada entidad tiene un único responsable con acceso. Si necesitáis que otra persona acceda, podéis compartir las credenciales de forma segura entre vosotros.",
        },
        {
          q: "¿Qué significa \"entidad\" en Summa Reu?",
          a: "Una entidad es cualquier organización, asociación, grupo o equipo que usa Summa Reu. Puede ser una asociación de vecinos, un club deportivo, una cooperativa, una junta directiva... cualquier colectivo que se reúna periódicamente.",
        },
        {
          q: "¿En qué idiomas funciona Summa Reu?",
          a: "La plataforma está disponible en catalán y castellano. Puedes elegir el idioma durante el alta y cambiarlo en cualquier momento desde la configuración.",
        },
        {
          q: "¿Puedo usar Summa Reu desde el móvil?",
          a: "Sí. La interfaz se adapta a móviles, tabletas y ordenadores. No hace falta instalar ninguna aplicación: funciona directamente desde el navegador.",
        },
        {
          q: "¿Desde qué navegadores puedo usar Summa Reu?",
          a: "Summa Reu funciona con los navegadores modernos más habituales: Chrome, Firefox, Safari y Edge. Recomendamos tener el navegador actualizado.",
        },
        {
          q: "¿Puedo cambiar el correo de acceso de mi entidad?",
          a: "Actualmente no se puede cambiar el correo de acceso desde la aplicación. Si lo necesitas, escríbenos a hola@summareu.app.",
        },
      ],
    },
    {
      title: "Crear y gestionar votaciones",
      items: [
        {
          q: "¿Cuántas votaciones puedo crear?",
          a: "Tantas como necesites. No hay límite de votaciones con la suscripción activa.",
        },
        {
          q: "¿Cuántas franjas horarias puedo proponer?",
          a: "Hasta 20 franjas por votación. Si necesitas más opciones, puedes crear una segunda votación complementaria.",
        },
        {
          q: "¿Puedo proponer franjas de más de 30 minutos?",
          a: "Las franjas se definen en bloques de 30 minutos, pero puedes seleccionar franjas consecutivas para cubrir períodos más largos.",
        },
        {
          q: "¿Puedo añadir opciones a una votación ya creada?",
          a: "No. Una vez creada, las opciones quedan fijadas. Si necesitas nuevas franjas, crea una votación nueva.",
        },
        {
          q: "¿Puedo editar el título o la descripción de una votación?",
          a: "Actualmente no se pueden modificar una vez creada. Revisa bien el título y la descripción antes de crear la votación.",
        },
        {
          q: "¿Puedo borrar una votación?",
          a: "Las votaciones se borran automáticamente cuando eliminas la reunión asociada. No se pueden borrar de forma independiente.",
        },
        {
          q: "¿Puedo reabrir una votación cerrada?",
          a: "No. Una vez cerrada, no se puede reabrir. Si necesitas volver a consultar disponibilidades, crea una nueva.",
        },
        {
          q: "¿Qué pasa si hay un empate entre fechas?",
          a: "Se muestran todas las opciones empatadas como \"mejores opciones\". Tú, como responsable, eliges cuál conviene más.",
        },
        {
          q: "¿Recibo algún aviso cuando alguien vota?",
          a: "Sí. Cada vez que un participante vota, recibirás un correo electrónico con el nombre del votante.",
        },
        {
          q: "¿Puedo crear una votación sin descripción?",
          a: "Sí. La descripción es opcional. Solo el título es obligatorio.",
        },
      ],
    },
    {
      title: "Participantes y votación pública",
      items: [
        {
          q: "¿Los participantes necesitan crear una cuenta para votar?",
          a: "No. Solo necesitan el enlace que les compartas. Pueden votar introduciendo su nombre, sin registro, sin contraseña y sin dar ningún correo.",
        },
        {
          q: "¿Puedo votar en mi propia votación?",
          a: "Sí. Si abres el enlace público de la votación, puedes votar como cualquier otro participante.",
        },
        {
          q: "¿Un participante puede cambiar su voto?",
          a: "Sí. Mientras la votación esté abierta, cualquier participante puede volver al enlace y modificar sus respuestas.",
        },
        {
          q: "¿Qué pasa si alguien intenta votar con la votación cerrada?",
          a: "Verá la votación marcada como \"Cerrada\" y no podrá modificar nada. El formulario se desactiva automáticamente.",
        },
        {
          q: "¿Pueden votar dos personas con el mismo nombre?",
          a: "Sí. Cada voto se registra de forma independiente, aunque coincidan los nombres. En la tabla de resultados aparecerán ambos.",
        },
        {
          q: "¿Un participante puede ver qué han votado los demás?",
          a: "Sí. Después de votar, puede hacer clic en \"Ver resultados\" y verá una tabla con el voto de cada participante.",
        },
        {
          q: "¿Cuánta gente puede votar en una misma votación?",
          a: "No hay límite de participantes. Puedes enviar el enlace a tantas personas como necesites.",
        },
        {
          q: "¿Puedo saber cuántos votos ha recibido la votación sin ir a resultados?",
          a: "Sí. En la página de gestión de la votación y en el panel puedes ver el número de votos recibidos en todo momento.",
        },
      ],
    },
    {
      title: "Resultados",
      items: [
        {
          q: "¿Quién puede ver los resultados de una votación?",
          a: "Cualquier persona con el enlace de resultados. Los resultados son públicos para que todos los participantes puedan consultarlos.",
        },
        {
          q: "¿Los resultados se actualizan en tiempo real?",
          a: "Sí. Cada vez que alguien vota o cambia su voto, los resultados reflejan el estado actualizado.",
        },
        {
          q: "¿Puedo acceder a los resultados desde el panel?",
          a: "Sí. Junto a cada votación en el panel hay un botón \"Resultados\".",
        },
      ],
    },
    {
      title: "Reuniones y videoconferencia",
      items: [
        {
          q: "¿Cómo se crea una reunión?",
          a: "Las reuniones se crean automáticamente cuando cierras una votación. Tú eliges la fecha ganadora y Summa Reu prepara la sala de videoconferencia.",
        },
        {
          q: "¿Puedo crear una reunión sin hacer votación?",
          a: "Actualmente, las reuniones se crean a partir del cierre de una votación. Para convocar una reunión, primero crea una votación aunque sea con una sola opción.",
        },
        {
          q: "¿Puedo cambiar la fecha de una reunión ya creada?",
          a: "No. Una vez creada, los datos de la reunión no se pueden modificar. Si necesitas una fecha diferente, crea una nueva votación.",
        },
        {
          q: "¿Qué pasa si la sala de videoconferencia no se crea?",
          a: "Verás un botón para reintentar la creación de la sala. Normalmente se resuelve en el segundo intento.",
        },
        {
          q: "¿La videoconferencia se abre dentro de Summa Reu o en otra ventana?",
          a: "Puede funcionar de las dos maneras. Normalmente se abre dentro de la misma página, pero si el navegador no lo permite, puedes hacer clic en \"Abrir en una pestaña nueva\".",
        },
      ],
    },
    {
      title: "Grabación",
      items: [
        {
          q: "¿Por qué no puedo iniciar la grabación?",
          a: "Es necesario que haya al menos una persona dentro de la sala de videoconferencia. Primero entra en la reunión y luego vuelve a la página de control.",
        },
        {
          q: "¿Cuánto puede durar una grabación?",
          a: "Con el plan básico, las grabaciones pueden durar hasta 90 minutos.",
        },
        {
          q: "¿Puedo grabar con una herramienta externa y subirlo después?",
          a: "Sí. Puedes subir un archivo de audio o vídeo manualmente desde la página de la reunión. Summa Reu generará la transcripción y el acta igualmente.",
        },
        {
          q: "¿Qué formatos de archivo puedo subir?",
          a: "Cualquier archivo de audio (MP3, WAV, M4A...) o de vídeo (MP4, MOV, AVI...).",
        },
        {
          q: "¿Qué pasa si cierro el navegador mientras se está grabando?",
          a: "La grabación no se pierde. Continúa activa hasta que se completa. Cuando vuelvas a abrir Summa Reu, podrás ver el estado de la grabación y gestionarla con normalidad.",
        },
        {
          q: "¿Puedo descargar la grabación de vídeo?",
          a: "La grabación se procesa automáticamente para generar la transcripción y el acta. El archivo de vídeo original no está disponible para descargar directamente.",
        },
      ],
    },
    {
      title: "Transcripción y actas",
      items: [
        {
          q: "¿Cuánto tiempo tarda en generarse el acta?",
          a: "Normalmente entre 1 y 3 minutos después de detener la grabación. La página se actualiza sola: no hace falta que hagas nada.",
        },
        {
          q: "¿Puedo editar el acta una vez generada?",
          a: "Sí, y de hecho te recomendamos que lo hagas. El acta generada es un borrador que puede contener pequeños errores. Modifica lo que haga falta y haz clic en \"Guardar cambios del acta\".",
        },
        {
          q: "¿En qué idioma se genera el acta?",
          a: "En el idioma configurado para tu entidad: catalán o castellano. Puedes cambiarlo desde la configuración.",
        },
        {
          q: "¿Las actas ya generadas cambian si cambio el idioma?",
          a: "No. El cambio de idioma solo afecta a las actas futuras. Las anteriores se mantienen tal como estaban.",
        },
        {
          q: "¿Puedo generar un acta sin grabar la reunión?",
          a: "Sí. Puedes pegar tus notas o una transcripción escrita por ti. Summa Reu las procesará y generará el borrador de acta.",
        },
        {
          q: "¿Qué pasa si el procesamiento del acta falla?",
          a: "Verás un botón para reintentar el procesamiento. Si el problema persiste, puedes subir tus notas manualmente.",
        },
        {
          q: "¿El acta es perfecta o tengo que revisarla?",
          a: "Siempre conviene revisarla. La inteligencia artificial hace un muy buen trabajo, pero puede perder matices o nombres propios. Piensa en el borrador como un punto de partida muy avanzado que tú acabas de pulir.",
        },
      ],
    },
    {
      title: "Exportación",
      items: [
        {
          q: "¿En qué formatos puedo exportar el acta?",
          a: "Tienes dos opciones: documento de texto (archivo .md que se puede abrir con cualquier editor) y evento de calendario (archivo ICS para importar a Google Calendar, Outlook, etc.).",
        },
        {
          q: "¿Puedo compartir el acta con los participantes?",
          a: "Sí. Descarga el acta como documento de texto y compártela por el canal que prefieras.",
        },
        {
          q: "¿Puedo exportar el acta más de una vez?",
          a: "Sí. Puedes descargarla tantas veces como quieras, y siempre obtendrás la versión más reciente.",
        },
      ],
    },
    {
      title: "Pago y suscripción",
      items: [
        {
          q: "¿Cuánto cuesta Summa Reu?",
          a: "El plan básico es de 39 €/mes e incluye votaciones ilimitadas y grabaciones de hasta 90 minutos por reunión.",
        },
        {
          q: "¿Qué método de pago aceptáis?",
          a: "Tarjeta de crédito o débito. El pago se gestiona por una plataforma segura y certificada. Summa Reu no almacena datos de tarjeta.",
        },
        {
          q: "¿Puedo cancelar la suscripción en cualquier momento?",
          a: "Sí. Una vez cancelada, las funciones de gestión quedarán desactivadas, pero podrás seguir consultando los datos existentes.",
        },
        {
          q: "¿Qué pasa si el pago falla?",
          a: "No podrás crear nuevas votaciones ni reuniones hasta que regularices la situación. Los datos existentes se mantienen intactos.",
        },
      ],
    },
    {
      title: "Seguridad y privacidad",
      items: [
        {
          q: "¿Mis datos están seguros?",
          a: "Sí. Todas las conexiones son seguras, cada entidad solo puede acceder a sus propios datos, y los datos de pago se gestionan por una plataforma externa segura.",
        },
        {
          q: "¿Quién puede ver mis votaciones y reuniones?",
          a: "Solo tú, como responsable de la entidad. Los participantes solo ven la página de votación y los resultados públicos.",
        },
        {
          q: "¿Las grabaciones de las reuniones son privadas?",
          a: "Sí. Solo el responsable de la entidad puede acceder a las grabaciones, transcripciones y actas.",
        },
        {
          q: "¿Qué pasa con los datos si elimino la cuenta?",
          a: "Se eliminarán todos los datos de forma permanente. Descarga todo lo que quieras conservar antes de eliminar la cuenta.",
        },
      ],
    },
    {
      title: "Problemas frecuentes",
      items: [
        {
          q: "No puedo iniciar sesión.",
          a: "Comprueba que el correo y la contraseña sean correctos. Si sigues teniendo problemas, escríbenos a hola@summareu.app.",
        },
        {
          q: "El enlace de votación no funciona para los participantes.",
          a: "Asegúrate de que has copiado el enlace completo. Prueba a abrirlo tú en una ventana nueva. Si la votación ya está cerrada, los participantes verán la página pero no podrán votar.",
        },
        {
          q: "La grabación no se inicia.",
          a: "La grabación necesita que haya al menos una persona dentro de la sala. Primero entra en la reunión y luego vuelve a la página de control.",
        },
        {
          q: "El procesamiento lleva mucho tiempo.",
          a: "Normalmente tarda entre 1 y 3 minutos. Si pasa más tiempo, verás un botón para reintentar. Si el problema persiste, puedes subir las notas manualmente.",
        },
        {
          q: "La videoconferencia no se carga.",
          a: "Haz clic en \"Abrir en una pestaña nueva\" para acceder a la reunión directamente. La grabación la puedes seguir controlando desde la página de Summa Reu.",
        },
        {
          q: "He cerrado la votación por error.",
          a: "Una vez cerrada, la votación no se puede reabrir. Puedes crear una votación nueva si necesitas volver a consultar disponibilidades.",
        },
        {
          q: "He borrado una reunión y quiero recuperar el acta.",
          a: "La eliminación es permanente. Por eso recomendamos siempre descargar el acta antes de eliminar la reunión.",
        },
        {
          q: "Veo que la suscripción no está activa.",
          a: "Ve a la sección de facturación para activar o regularizar la suscripción.",
        },
      ],
    },
  ],
};
