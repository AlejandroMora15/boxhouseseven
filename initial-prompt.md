## Nombre del proyecto:

Boxhouseseven

## Descripción general:

Boxhouseven es un gym de boxeo de la ciudad de Cartago, Valle del Cauca. Los
días de entreno habilitados son de lunes a viernes, en clases de 1h con máximo 7
personas. Los horarios de entreno son: de 6am a 7am, de 7am a 8am, de 8am a 9am,
y en la tarde de 3pm a 4pm, de 4pm a 5pm, de 5pm a 6pm, de 6pm a 7pm y de 7pm a
8pm. En cuanto a las mensualidades, se tienen 2 modalidades: 3 veces por semana
(130.000 COP) y todos los días (150.000 COP). Con una clase de cortesía
totalmente gratuita para los nuevos usuarios.

En este sentido, el gym se ha encontrado con inconvenientes para gestionar la
cantidad de clientes que van a determinada hora, teniendo en cuenta que hay
usuarios que se inscriben en diferentes modalidades y horarios, lo que dificulta
la planificación y el control de las clases. Sumado a esto, los clientes de 3
días, si bien al principio definen los 3 días por defecto a los que asistirán,
algunos cambias días entre la semana. También se desearía tener un sistema que
permita modificar los días de asistencia según sea necesario. También se
desearía tener un sistema para agendar las clases de prueba.

Por esta razón, se plantea la creación de una aplicación web pero 100%
responsive que permita gestionar de manera eficiente la asistencia de los
clientes a las clases, así como agendar las clases de prueba. Se desea tener dos
roles: administrador y cliente. El administrador podrá gestionar los horarios,
las clases y los usuarios, mientras que el cliente podrá ver su historial de
asistencia, agendar clases de prueba y gestionar su perfil.

El administrador debe tener los siguientes módulos:

- Agenda: Esta debe ser la pantalla más importante, ya que debe mostrar de
  manera clara y organizada todos los horarios y la asistencia de los clientes a
  la misma, permitiendo al administrador ver la asistencia de los clientes y ver
  clientes que asistirán como clases de prueba. Me lo imagino como un vistazo
  tipo agenda (ver un día completo de un vistazo) con las franjas de horario de
  clase marcadas claramente, y una vista previa de los asistentes. Al entrar al
  detalle de cada clase, el admin podrá ver la lista completa de asistentes y la
  información relevante de cada uno (demarcando que cliente es clase de prueba).
  También podrá marcar la asistencia (o añadir un usuario que ese día asistió),
  desde esta vista, no existe la restricción de 7 clientes por clase, ya que el
  admin puede añadir a tantos clientes como sea necesario.
- Clientes: listado de clientes registrados, con opción de agregar, editar y
  eliminar toda la información del cliente. Así como ver su historial de
  asistencia, información de contacto y modalidad de suscripción. Debe poder
  filtrar por nombre.
- Clases de prueba: listado de usuarios que se inscribieron como clases de
  prueba, con opción de "convertir a cliente".
- Clases: Este apartado es para que el entrenador pueda planificar la clase (un
  campo de texto para describir la planificación de la clase) por día, puede ser
  una vista tipo calendario o agenda.
- Configuración: apartado para configurar el listado de horarios disponibles,
  con opción de agregar, editar y eliminar. También podrá configurar el número
  máximo de clientes por clase.

El cliente podrá ver los siguientes módulos:

- Agenda: El cliente podrá ver su agenda personal, con los horarios de las
  clases a las que está inscrito y su asistencia. Al entrar al detalle de la
  clase, no podrá ver quienes van por privacidad, pero si podrá reagendar esa
  clase a otro día (obviamente primero validando la disponibilidad de esa otra
  clase, teniendo en cuenta la cantidad de asistentes por clase). Solo se podrá
  reagendar una clase si hay disponibilidad en la nueva fecha. Solo podrá
  reagendar una clase en esa misma semana, por ejemplo, si tengo la mensualidad
  de 3 días, no podré reagendar una clase fuera de esa semana.
- Perfil: El cliente podrá ver y editar su información personal, como nombre,
  documento y celular (solo ver). El cliente podrá ver su modalidad de
  suscripción y los días de asistencia, pero no podrá modificarlos. No podrá
  cambiar su modalidad de suscripción ni los días de asistencia, ya que esto
  solo lo puede hacer el administrador.
- Nota: Si la cuenta de un cliente está inactiva, al hacer login se le debe
  mostrar un modal donde indique que debe hablar con el administrador

Clientes de prueba:

- Se debe disponer de una url externa para poner el redes y promocionar la
  agendada de clases de prueba. Debe ser un formulario simple, donde se valide
  primero que no existe este cliente ni como cliente ni como un usuario que haya
  agendado antes una clase de prueba. Después, se debe mostrar la agenda con los
  días disponibles para agendar la clase de prueba, teniendo en cuenta la
  disponibilidad de cupos por clase. No se debe mostrar quien asiste a la clase,
  solo la disponibilidad de cupos.

Nota: se debe tener en cuenta que para la modalidad de 3 días por semana, se
debe seleccionar que 3 días que serán los que el cliente asistirá por defecto.

## Descripción técnica:

- Versión de node: v24.11.1
- Versión de npm: 11.6.2

Debe ser una Web responsive desarrollada en Nextjs, usando la versión de nodejs
especificada. Se deben usar las rutas y edge functions de Nextjs, y se debe usar
Supabase como base de datos.

Tienes permitido usar cualquier librería npm, que sea compatible con la versión
de nodejs especificada, para el desarrollo de la aplicación.

No se debe empaquetar la aplicación, ni subirla a un servidor, ni desplegarla en
Vercel. Solo se debe entregar el código fuente de la aplicación que se pueda
ejecutar con 'npm run dev' en un entorno local. Puedes crear los archivos
necesarios, como .env.local, para la configuración de la base de datos.

## Requerimientos:

- Clientes: A los clientes se les pide nombre completo, documento, celular,
  email. Se requiere un sistema de autenticación simple, tipo JWT, que permita a
  los usuarios iniciar sesión y cerrar sesión. La contraseña es el documento.
  Usa encriptación hash para la clave (con bycrypt o algo así simple pero
  funcional). El registro de clientes lo hará el administrador, y un cliente
  siempre debe contar con la información de mensualidad y modalidad de
  suscripción. El cliente puede ser editado solo por el administrador, cambiando
  cualquier dato necesario, incluso la modalidad de suscripción. Sumado a esto,
  el cliente debe tener una etiqueta que indique si está activo o inactivo. Solo
  el admin cambia esto e influye en si cuenta como que asistirá a clase o no. Es
  decir, un cliente inactivo no debe contar como asistente a ninguna clase.

  Los cliente de prueba deben ser una tabla aparte, el usuario debe tener una
  ruta externa (url externa) donde se muestra una pantalla con la información de
  nombre completo, documento, celular y email. Al darle siguiente, primero se
  valida que no haya agendado una clase de prueba previamente. Luego entonces
  debe mostrar el calendario, con los días disponibles para agendar clase.
  (Recuerda la restricción de la cantidad de alumnos máximos por clase). Si es
  viable, debe mostrar un mensaje de confirmación de la clase de prueba
  agendada. Durante el flujo de la clase de prueba, se debe tener una
  descripción donde indique el usuario solo debe llevar agua, toalla y ropa
  deportiva.

  La idea es que, en uno de los módulos del admin será "Clases de prueba". Aquí
  el administrador podrá ver todos los usuarios que agendaron clase de prueba,
  con la posibilidad de homologar un usuario de prueba a cliente, asignando
  entonces su información correspondiente (tipo de modalidad y días si aplica) y
  trasladándolo a la tabla de clientes.

  - Administrador:
    - Puede gestionar clientes y clientes para clases de prueba.
    - Puede homologar clientes de prueba a clientes regulares.
    - Puede ver y gestionar todas las clases agendadas.
    - Puede cambiar el estado de los clientes (activo/inactivo).
    - Tiene acceso a todas las rutas protegidas según su rol.
    - Crea uno por defecto que sea: email boxhouseseven.tech@gmail.com,
      contraseña: 123456

Las rutas deben ser protegidas, es decir, que solo los usuarios autenticados
puedan acceder a ellas (teniendo en cuenta su rol).

Al usar JWT, usa estrategias para mantener la sesión activa y segura, como la
renovación de tokens antes de que expiren y la invalidación de tokens al cerrar
sesión. Para que no toque estar constantemente iniciando sesión, se debe
implementar la renovación automática de tokens antes de que expiren.

- UI/UX:

Debe tener una interfaz de usuario simple, pero agradable, que sea fácil de usar
y navegar. Se debe usar un diseño responsive para que se vea bien en
dispositivos móviles y de escritorio. El logo lo encontrarás en esta misma
carpeta, bajo el nombre 'logo.jpg'. Utiliza el esquema de colores y tipografías
que se considere adecuado para mantener una apariencia consistente y agradable,
recuerda que es un gym de boxeo y que los colores en el logo son blanco y negro,
puedes agregar otros colores para que hagan contraste.

Recuerda que la experiencia del usuario es fundamental, por lo que se debe
prestar atención a los detalles y garantizar que la aplicación sea fácil de usar
y agradable visualmente. La idea es que sea fácil de usar y navegar, por eso
recuerda agregar filtros en las listas y tablas donde sea necesario. Así como
también paginación para mejorar la experiencia de usuario en caso de que haya
muchos registros. Nota: recuerda que utilizamos muchas agendas/calendario, la
idea es que exista un "jump to" para ir a un día en específico, por ejemplo. La
navegación debe ser intuitiva y permitir al usuario moverse fácilmente entre
diferentes secciones y días del calendario.

Recuerda aplicar buenas prácticas de desarrollo web, como el uso de componentes
reutilizables, separación de lógica y presentación, y manejo adecuado del estado
de la aplicación. Además de usar buenas prácticas de UI/UX, como el uso de
colores y tipografías consistentes, y la creación de una experiencia de usuario
intuitiva y agradable. Feedback visual para las acciones del usuario, como
animaciones o cambios de color al hacer clic en botones, también es importante.

El login solo debe pedir email y la contraseña (que en este caso el documento es
la contraseña). No debe haber flujo de cambio de clave.

- Rendimiento: La aplicación debe ser rápida y eficiente, minimizando los
  tiempos de carga y el uso de recursos. Se deben implementar técnicas de
  optimización. Me preocupa que la consulta de días hábiles sea muy pesada/lenta
  y afecte el rendimiento general de la aplicación. Se deben considerar
  estrategias como la indexación adecuada en la base de datos, el uso de caché y
  la optimización de las consultas para mejorar la eficiencia.

- Prueba:

Realiza todas las pruebas necesarias para garantizar que la aplicación funcione
correctamente y cumpla con los requerimientos especificados. Asegúrate de probar
todas las funcionalidades, con todos los roles de usuario y en diferentes
escenarios posibles y casos bordes.

## Conexión a Supabase:

npm install @supabase/supabase-js @supabase/ssr

- Conexión a supabase:
  NEXT_PUBLIC_SUPABASE_URL=https://qstaeonkrldmwiybxzkc.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fUs7vUG_r-Zoxau6OOmDDA_KYCrhnj6
- Database Password: rjKEpxUJcW40DZ8F
